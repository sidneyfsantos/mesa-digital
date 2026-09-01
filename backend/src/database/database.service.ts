import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export type DatabaseTransaction = Parameters<
  Parameters<NodePgDatabase['transaction']>[0]
>[0];

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  readonly client = drizzle({ client: this.pool });

  async ping(): Promise<void> {
    await this.pool.query('select 1');
  }

  async transaction<T>(
    callback: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.client.transaction(callback);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
