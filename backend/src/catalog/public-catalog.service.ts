import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { CatalogRepository } from '../database/repositories/catalog.repository.js';
import {
  QR_TOKEN_PATTERN,
  QrTokenService,
} from '../entry-contexts/qr-token.service.js';
@Injectable()
export class PublicCatalogService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repo: CatalogRepository,
    private readonly tokens: QrTokenService,
  ) {}
  async get(token: string) {
    if (!QR_TOKEN_PATTERN.test(token))
      throw new NotFoundException('Catalog not found.');
    return this.database.transaction(async (tx) => {
      const scope = await this.repo.resolveScope(tx, this.tokens.hash(token));
      if (!scope) throw new NotFoundException('Catalog not found.');
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${scope.tenant_id}, true)`,
      );
      const data = await this.repo.publicCatalog(tx, scope.tenant_id);
      const mediaMap = new Map(
        data.media.map((media) => [media.id, media.storageKey]),
      );
      const mediaUrl = (id: string | null) =>
        id && mediaMap.has(id) ? `/media/${mediaMap.get(id)}` : null;
      const groupMap = new Map(
        data.groups.map((g) => [
          g.id,
          {
            id: g.id,
            name: g.name,
            required: g.required,
            minSelections: g.minSelections,
            maxSelections: g.maxSelections,
            options: data.options
              .filter((o) => o.groupId === g.id)
              .map((o) => ({
                id: o.id,
                name: o.name,
                priceDeltaMinor: o.priceDeltaMinor,
              })),
          },
        ]),
      );
      return {
        establishment: {
          displayName: data.branding?.displayName ?? scope.tenant_name,
          primaryColor: data.branding?.primaryColor ?? '#C2410C',
          logoUrl: mediaUrl(data.branding?.logoMediaId ?? null),
          coverUrl: mediaUrl(data.branding?.coverMediaId ?? null),
        },
        entry: {
          kind: 'QR',
          servicePoint: {
            kind: scope.service_point_kind,
            label: scope.service_point_label,
          },
        },
        categories: data.categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          products: data.products
            .filter((p) => p.categoryId === c.id)
            .map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              priceMinor: p.priceMinor,
              currency: p.currency,
              available: p.available,
              photos: data.images
                .filter((m) => m.productId === p.id)
                .map((m) => ({
                  url: `/media/${m.storageKey}`,
                  alt: m.altText ?? p.name,
                })),
              modifierGroups: data.links
                .filter((l) => l.productId === p.id)
                .map((l) => groupMap.get(l.modifierGroupId))
                .filter(Boolean),
            })),
        })),
      };
    });
  }
}
