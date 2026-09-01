import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export type DatabaseTransaction = Parameters<
  Parameters<NodePgDatabase['transaction']>[0]
>[0];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  private readonly client = drizzle({ client: this.pool });

  async ping(): Promise<void> {
    await this.pool.query('select 1');
  }

  async transaction<T>(
    callback: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.client.transaction(callback);
  }

  async withTenantContext<T>(
    tenantId: string,
    callback: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    if (!UUID_PATTERN.test(tenantId)) {
      throw new Error('A valid trusted tenant ID is required.');
    }

    return this.client.transaction(async (transaction) => {
      await transaction.execute(
        sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
      );

      return callback(transaction);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
