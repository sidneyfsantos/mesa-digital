import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import type { PrincipalRequest } from '../auth/principal.js';
import { OnboardingService } from './onboarding.service.js';

@Controller('public/onboarding')
export class PublicOnboardingController {
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

  @Get('readiness')
  async checkReadiness(@Req() r: PrincipalRequest) {
    // For public endpoint, we need to get tenant from session or token
    // This is called after login, so principal should be available
    if (!r.principal) {
      throw new BadRequestException('Sessão não autenticada');
    }
    return this.onboarding.checkReadiness(r.principal!.tenantId);
  }
}