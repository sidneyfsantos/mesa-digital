import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DatabaseTransaction } from '../database.service.js';
import {
  catalogCategories,
  catalogProducts,
  mediaAssets,
  modifierGroups,
  modifierOptions,
  productMedia,
  productModifierGroups,
  productRouting,
  tenantBranding,
} from '../schema/index.js';
@Injectable()
export class CatalogRepository {
  categories(tx: DatabaseTransaction, tenantId: string) {
    return tx
      .select()
      .from(catalogCategories)
      .where(eq(catalogCategories.tenantId, tenantId))
      .orderBy(asc(catalogCategories.sortOrder), asc(catalogCategories.id));
  }
  createCategory(tx: DatabaseTransaction, tenantId: string, data: any) {
    return tx
      .insert(catalogCategories)
      .values({ tenantId, ...data })
      .returning();
  }
  updateCategory(
    tx: DatabaseTransaction,
    tenantId: string,
    id: string,
    data: any,
  ) {
    return tx
      .update(catalogCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(catalogCategories.tenantId, tenantId),
          eq(catalogCategories.id, id),
        ),
      )
      .returning();
  }
  products(tx: DatabaseTransaction, tenantId: string) {
    return tx
      .select()
      .from(catalogProducts)
      .where(eq(catalogProducts.tenantId, tenantId))
      .orderBy(asc(catalogProducts.sortOrder), asc(catalogProducts.id));
  }
  createProduct(tx: DatabaseTransaction, tenantId: string, data: any) {
    return tx
      .insert(catalogProducts)
      .values({ tenantId, ...data })
      .returning();
  }
  updateProduct(
    tx: DatabaseTransaction,
    tenantId: string,
    id: string,
    data: any,
  ) {
    return tx
      .update(catalogProducts)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(catalogProducts.tenantId, tenantId), eq(catalogProducts.id, id)),
      )
      .returning();
  }
  groups(tx: DatabaseTransaction, tenantId: string) {
    return tx
      .select()
      .from(modifierGroups)
      .where(eq(modifierGroups.tenantId, tenantId))
      .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.id));
  }
  createGroup(tx: DatabaseTransaction, tenantId: string, data: any) {
    return tx
      .insert(modifierGroups)
      .values({ tenantId, ...data })
      .returning();
  }
  updateGroup(
    tx: DatabaseTransaction,
    tenantId: string,
    id: string,
    data: any,
  ) {
    return tx
      .update(modifierGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(modifierGroups.tenantId, tenantId), eq(modifierGroups.id, id)),
      )
      .returning();
  }
  options(tx: DatabaseTransaction, tenantId: string) {
    return tx
      .select()
      .from(modifierOptions)
      .where(eq(modifierOptions.tenantId, tenantId))
      .orderBy(asc(modifierOptions.sortOrder), asc(modifierOptions.id));
  }
  createOption(tx: DatabaseTransaction, tenantId: string, data: any) {
    return tx
      .insert(modifierOptions)
      .values({ tenantId, ...data })
      .returning();
  }
  updateOption(
    tx: DatabaseTransaction,
    tenantId: string,
    id: string,
    data: any,
  ) {
    return tx
      .update(modifierOptions)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(modifierOptions.tenantId, tenantId), eq(modifierOptions.id, id)),
      )
      .returning();
  }
  associateGroup(
    tx: DatabaseTransaction,
    tenantId: string,
    productId: string,
    modifierGroupId: string,
    sortOrder: number,
  ) {
    return tx
      .insert(productModifierGroups)
      .values({ tenantId, productId, modifierGroupId, sortOrder })
      .onConflictDoUpdate({
        target: [
          productModifierGroups.tenantId,
          productModifierGroups.productId,
          productModifierGroups.modifierGroupId,
        ],
        set: { sortOrder },
      })
      .returning();
  }
  attachMedia(
    tx: DatabaseTransaction,
    tenantId: string,
    productId: string,
    mediaId: string,
    sortOrder: number,
  ) {
    return tx
      .insert(productMedia)
      .values({ tenantId, productId, mediaId, sortOrder })
      .onConflictDoUpdate({
        target: [
          productMedia.tenantId,
          productMedia.productId,
          productMedia.mediaId,
        ],
        set: { sortOrder },
      })
      .returning();
  }
  createMedia(tx: DatabaseTransaction, tenantId: string, data: any) {
    return tx
      .insert(mediaAssets)
      .values({ tenantId, ...data })
      .returning();
  }
  findMedia(tx: DatabaseTransaction, tenantId: string, id: string) {
    return tx
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, id)))
      .limit(1);
  }
  branding(tx: DatabaseTransaction, tenantId: string) {
    return tx
      .select()
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, tenantId))
      .limit(1);
  }
  upsertBranding(tx: DatabaseTransaction, tenantId: string, data: any) {
    return tx
      .insert(tenantBranding)
      .values({ tenantId, ...data })
      .onConflictDoUpdate({
        target: tenantBranding.tenantId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
  }
  async resolveScope(tx: DatabaseTransaction, hash: string) {
    const result = await tx.execute<{
      tenant_id: string;
      tenant_name: string;
      credential_id: string;
      service_point_id: string;
      service_point_kind: string;
      service_point_label: string;
    }>(
      sql`select tenant_id, tenant_name, credential_id, service_point_id, service_point_kind, service_point_label from resolve_public_catalog_scope(${hash})`,
    );
    return result.rows[0];
  }
  async publicCatalog(tx: DatabaseTransaction, tenantId: string) {
    const [
      branding,
      categories,
      products,
      groups,
      options,
      links,
      images,
      media,
      routing,
    ] = await Promise.all([
      tx
        .select()
        .from(tenantBranding)
        .where(eq(tenantBranding.tenantId, tenantId))
        .limit(1),
      tx
        .select()
        .from(catalogCategories)
        .where(
          and(
            eq(catalogCategories.tenantId, tenantId),
            eq(catalogCategories.active, true),
          ),
        )
        .orderBy(asc(catalogCategories.sortOrder), asc(catalogCategories.id)),
      tx
        .select()
        .from(catalogProducts)
        .where(
          and(
            eq(catalogProducts.tenantId, tenantId),
            eq(catalogProducts.active, true),
          ),
        )
        .orderBy(asc(catalogProducts.sortOrder), asc(catalogProducts.id)),
      tx
        .select()
        .from(modifierGroups)
        .where(
          and(
            eq(modifierGroups.tenantId, tenantId),
            eq(modifierGroups.active, true),
          ),
        )
        .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.id)),
      tx
        .select()
        .from(modifierOptions)
        .where(
          and(
            eq(modifierOptions.tenantId, tenantId),
            eq(modifierOptions.active, true),
          ),
        )
        .orderBy(asc(modifierOptions.sortOrder), asc(modifierOptions.id)),
      tx
        .select()
        .from(productModifierGroups)
        .where(eq(productModifierGroups.tenantId, tenantId))
        .orderBy(asc(productModifierGroups.sortOrder)),
      tx
        .select({
          productId: productMedia.productId,
          mediaId: mediaAssets.id,
          storageKey: mediaAssets.storageKey,
          mimeType: mediaAssets.mimeType,
          altText: mediaAssets.altText,
          sortOrder: productMedia.sortOrder,
        })
        .from(productMedia)
        .innerJoin(
          mediaAssets,
          and(
            eq(mediaAssets.tenantId, productMedia.tenantId),
            eq(mediaAssets.id, productMedia.mediaId),
          ),
        )
        .where(eq(productMedia.tenantId, tenantId))
        .orderBy(asc(productMedia.sortOrder)),
      tx
        .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
        .from(mediaAssets)
        .where(eq(mediaAssets.tenantId, tenantId)),
      tx
        .select()
        .from(productRouting)
        .where(eq(productRouting.tenantId, tenantId)),
    ]);
    return {
      branding: branding[0],
      categories,
      products,
      groups,
      options,
      links,
      images,
      media,
      routing,
    };
  }
}
