import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { PasswordService } from '../auth/password.service.js';
import {
  onboardingStates,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_LABELS,
  type OnboardingStep,
} from '../database/schema/index.js';
import {
  tenants,
  users,
  tenantUsers,
  accessRoles,
  capabilities,
  roleCapabilities,
  tenantUserRoles,
} from '../database/schema/index.js';
import {
  catalogProducts,
  servicePoints,
  entryCredentials,
  productRouting,
  productionStations,
} from '../database/schema/index.js';
import { AuthorizationBootstrapService } from '../auth/authorization-bootstrap.service.js';
import { STANDARD_ROLE_CAPABILITIES, STANDARD_ROLE_NAMES, StandardRole } from '../auth/capabilities.js';
import { type OnboardingStep as OnboardingStepType } from '../database/schema/onboarding.js';

const STANDARD_ROLES = Object.keys(STANDARD_ROLE_NAMES) as StandardRole[];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly passwords: PasswordService,
    private readonly bootstrap: AuthorizationBootstrapService,
  ) {}

  async startOnboarding(input: {
    establishmentName: string;
    establishmentSlug: string;
    adminEmail: string;
    adminName: string;
    adminPassword: string;
  }) {
    const { establishmentName, establishmentSlug, adminEmail, adminName, adminPassword } = input;

    if (!establishmentName?.trim())
      throw new BadRequestException('Nome do estabelecimento é obrigatório.');
    if (!establishmentSlug?.trim())
      throw new BadRequestException('Identificador (slug) é obrigatório.');
    if (!establishmentSlug.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      throw new BadRequestException('Slug inválido. Use apenas letras minúsculas, números e hífens.');
    if (!adminEmail?.trim())
      throw new BadRequestException('E-mail do administrador é obrigatório.');
    if (!adminName?.trim())
      throw new BadRequestException('Nome do administrador é obrigatório.');
    if (!adminPassword || adminPassword.length < 12)
      throw new BadRequestException('A senha deve ter pelo menos 12 caracteres.');

    const normalizedSlug = establishmentSlug.trim().toLowerCase();
    const normalizedEmail = adminEmail.trim().toLowerCase();

    return this.db.transaction(async (tx) => {
      // Check if slug already exists
      const existingTenant = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.slug, normalizedSlug))
        .limit(1);
      if (existingTenant[0])
        throw new ConflictException('Este identificador já está em uso.');

      // Check if email already exists globally
      const existingUser = await tx
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);
      if (existingUser[0])
        throw new ConflictException('Este e-mail já está cadastrado.');

      // Create tenant
      const tenantId = randomUUID();
      await tx.insert(tenants).values({
        id: tenantId,
        name: establishmentName.trim(),
        slug: normalizedSlug,
      });

      // Create user
      const userId = randomUUID();
      const passwordHash = await this.passwords.hash(adminPassword);
      await tx.insert(users).values({
        id: userId,
        email: normalizedEmail,
        name: adminName.trim(),
        passwordHash,
      });

      // Create tenant-user link
      const tenantUserId = randomUUID();
      await tx.insert(tenantUsers).values({
        id: tenantUserId,
        tenantId,
        userId,
      });

      // Bootstrap authorization (roles, capabilities, role_capabilities)
      await this.bootstrap.bootstrapTenant(tenantId);

      // Assign 'owner' role to the admin
      const ownerRole = await tx
        .select()
        .from(accessRoles)
        .where(and(eq(accessRoles.tenantId, tenantId), eq(accessRoles.key, 'owner')))
        .limit(1);
      if (!ownerRole[0])
        throw new BadRequestException('Papel de proprietário não encontrado após bootstrap.');

      await tx.insert(tenantUserRoles).values({
        tenantId,
        tenantUserId,
        roleId: ownerRole[0].id,
      });

      // Create initial onboarding state
      await tx.insert(onboardingStates).values({
        tenantId,
        step: 'BASIC_DATA',
        data: JSON.stringify({}),
      });

      // Set tenant context for subsequent operations
      await tx.execute(sql`select set_config('app.current_tenant_id', ${tenantId}, true)`);

      return {
        tenantId,
        tenantSlug: normalizedSlug,
        userId,
        tenantUserId,
      };
    });
  }

  async getOnboardingState(tenantId: string) {
    const state = await this.db.withTenantContext(tenantId, async (tx) => {
      const result = await tx
        .select()
        .from(onboardingStates)
        .where(eq(onboardingStates.tenantId, tenantId))
        .limit(1);
      return result[0];
    });
    if (!state) return null;
    const step = state.step as OnboardingStepType;
    return {
      ...state,
      label: ONBOARDING_STEP_LABELS[step] || state.step,
      progress: ONBOARDING_STEPS.indexOf(step) + 1,
      totalSteps: ONBOARDING_STEPS.length,
    };
  }

  async updateOnboardingStep(tenantId: string, step: string, data?: Record<string, any>) {
    if (!ONBOARDING_STEPS.includes(step as any))
      throw new BadRequestException('Etapa inválida.');

    return this.db.withTenantContext(tenantId, async (tx) => {
      const existing = await tx
        .select()
        .from(onboardingStates)
        .where(eq(onboardingStates.tenantId, tenantId))
        .limit(1);

      if (!existing[0])
        throw new NotFoundException('Onboarding não encontrado para este estabelecimento.');

      const currentIndex = ONBOARDING_STEPS.indexOf(existing[0].step as any);
      const newIndex = ONBOARDING_STEPS.indexOf(step as any);

      if (newIndex < currentIndex)
        throw new BadRequestException('Não é possível voltar para uma etapa anterior.');

      const mergedData = {
        ...JSON.parse(existing[0].data || '{}'),
        ...(data || {}),
      };

      const [updated] = await tx
        .update(onboardingStates)
        .set({
          step,
          data: JSON.stringify(mergedData),
          completedAt: step === 'COMPLETED' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(onboardingStates.tenantId, tenantId))
        .returning();

      return {
        ...updated,
        label: ONBOARDING_STEP_LABELS[step as OnboardingStepType] || step,
        progress: newIndex + 1,
        totalSteps: ONBOARDING_STEPS.length,
      };
    });
  }

  async completeOnboarding(tenantId: string) {
    return this.updateOnboardingStep(tenantId, 'COMPLETED');
  }

  async checkReadiness(tenantId: string) {
    const state = await this.getOnboardingState(tenantId);
    if (!state) return { ready: false, missing: ['Onboarding não iniciado'] };

    const missing: string[] = [];

    // Check basic data
    if (!state.data) state.data = '{}';
    const data = JSON.parse(state.data);

    if (!data.establishmentName) missing.push('Nome do estabelecimento');
    if (!data.identity?.primaryColor) missing.push('Cor principal da identidade visual');
    if (!data.entryMode?.enabledKinds?.length) missing.push('Modo de atendimento');
    if (!data.servicePoints?.length) missing.push('Pelo menos uma mesa ou comanda');
    if (!data.stations?.length) missing.push('Pelo menos uma estação (cozinha/bar)');
    if (!data.catalog?.categories?.length) missing.push('Pelo menos uma categoria no cardápio');

    // Additional operational readiness checks
    if (!data.servicePoints?.some((sp: any) => sp.id)) missing.push('Pelo menos um ponto de atendimento utilizável');

    // Check database for operational readiness
    try {
      const checks = await this.db.withTenantContext(tenantId, async (tx) => {
        // Check for at least one active/available product with valid price
        const products = await tx
          .select({ id: catalogProducts.id, active: catalogProducts.active, available: catalogProducts.available, priceMinor: catalogProducts.priceMinor })
          .from(catalogProducts)
          .where(
            and(
              eq(catalogProducts.tenantId, tenantId),
              eq(catalogProducts.active, true),
              eq(catalogProducts.available, true),
            ),
          );

        // Check for at least one active ServicePoint with active QR credential
        const servicePointsRows = await tx
          .select({ id: servicePoints.id })
          .from(servicePoints)
          .innerJoin(
            entryCredentials,
            and(
              eq(entryCredentials.tenantId, servicePoints.tenantId),
              eq(entryCredentials.servicePointId, servicePoints.id),
              eq(entryCredentials.kind, 'QR'),
              sql`${entryCredentials.revokedAt} IS NULL`,
            ),
          )
          .where(
            and(
              eq(servicePoints.tenantId, tenantId),
              eq(servicePoints.active, true),
            ),
          );

        // Check if at least one product has routing to a station
        const productsWithRouting = await tx
          .select({ productId: productRouting.productId })
          .from(productRouting)
          .innerJoin(
            productionStations,
            and(
              eq(productionStations.tenantId, productRouting.tenantId),
              eq(productionStations.id, productRouting.stationId),
              eq(productionStations.active, true),
            ),
          )
          .where(eq(productRouting.tenantId, tenantId));

        return { products, servicePoints: servicePointsRows, productsWithRouting };
      });

      const hasValidProduct = checks.products.some(
        (p: any) => p.active && p.available && Number(p.priceMinor) > 0
      );
      if (!hasValidProduct) {
        missing.push('Pelo menos um produto ativo/disponível com preço válido');
      }

      const hasUsableServicePoint = checks.servicePoints.length > 0;
      if (!hasUsableServicePoint) {
        missing.push('Pelo menos um ponto de atendimento com QR ativo');
      }

      const hasRoutableProduct = checks.productsWithRouting.length > 0;
      if (!hasRoutableProduct) {
        missing.push('Pelo menos um produto roteado para uma estação ativa');
      }
    } catch {
      // If DB check fails, don't block readiness - onboarding data takes precedence
    }

    return {
      ready: missing.length === 0 && state.step === 'COMPLETED',
      missing,
      step: state.step,
      progress: state.progress,
    };
  }

  private id(value: unknown) {
    if (typeof value !== 'string' || !UUID.test(value))
      throw new BadRequestException('Identificador inválido.');
  }
}