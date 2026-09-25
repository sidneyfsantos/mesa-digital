import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CapabilitiesGuard } from '../auth/capabilities.guard.js';
import type { PrincipalRequest } from '../auth/principal.js';
import { RequireCapabilities } from '../auth/require-capabilities.decorator.js';
import { OnboardingService } from './onboarding.service.js';

@Controller('onboarding')
@UseGuards(CapabilitiesGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post('start')
  async start(@Body() body: any) {
    return this.onboarding.startOnboarding({
      establishmentName: body.establishmentName,
      establishmentSlug: body.establishmentSlug,
      adminEmail: body.adminEmail,
      adminName: body.adminName,
      adminPassword: body.adminPassword,
    });
  }

  @Get('state')
  @RequireCapabilities('session.read')
  async getState(@Req() r: PrincipalRequest) {
    return this.onboarding.getOnboardingState(r.principal!.tenantId);
  }

  @Patch('step')
  @RequireCapabilities('session.read')
  async updateStep(
    @Req() r: PrincipalRequest,
    @Body() body: { step: string; data?: Record<string, any> },
  ) {
    return this.onboarding.updateOnboardingStep(r.principal!.tenantId, body.step, body.data);
  }

  @Post('complete')
  @RequireCapabilities('session.read')
  async complete(@Req() r: PrincipalRequest) {
    return this.onboarding.completeOnboarding(r.principal!.tenantId);
  }

  @Get('readiness')
  @RequireCapabilities('session.read')
  async checkReadiness(@Req() r: PrincipalRequest) {
    return this.onboarding.checkReadiness(r.principal!.tenantId);
  }
}