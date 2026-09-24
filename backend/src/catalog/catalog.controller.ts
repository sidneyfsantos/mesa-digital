import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CapabilitiesGuard } from '../auth/capabilities.guard.js';
import type { PrincipalRequest } from '../auth/principal.js';
import { RequireCapabilities } from '../auth/require-capabilities.decorator.js';
import { CatalogService } from './catalog.service.js';
import { MediaService } from './media.service.js';
@Controller('admin/catalog')
@UseGuards(CapabilitiesGuard)
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly media: MediaService,
  ) {}
  @Get('categories') @RequireCapabilities('catalog.read') categories(
    @Req() r: PrincipalRequest,
  ) {
    return this.catalog.listCategories(r.principal!.tenantId);
  }
  @Post('categories') @RequireCapabilities('catalog.manage') categoryCreate(
    @Req() r: PrincipalRequest,
    @Body() b: any,
  ) {
    return this.catalog.createCategory(r.principal!.tenantId, b);
  }
  @Patch('categories/:id')
  @RequireCapabilities('catalog.manage')
  categoryUpdate(
    @Req() r: PrincipalRequest,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.catalog.updateCategory(r.principal!.tenantId, id, b);
  }
  @Get('products') @RequireCapabilities('catalog.read') products(
    @Req() r: PrincipalRequest,
  ) {
    return this.catalog.listProducts(r.principal!.tenantId);
  }
  @Post('products') @RequireCapabilities('catalog.manage') productCreate(
    @Req() r: PrincipalRequest,
    @Body() b: any,
  ) {
    return this.catalog.createProduct(r.principal!.tenantId, b);
  }
  @Patch('products/:id') @RequireCapabilities('catalog.manage') productUpdate(
    @Req() r: PrincipalRequest,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.catalog.updateProduct(r.principal!.tenantId, id, b);
  }
  @Get('modifiers') @RequireCapabilities('catalog.read') modifiers(
    @Req() r: PrincipalRequest,
  ) {
    return this.catalog.listGroups(r.principal!.tenantId);
  }
  @Post('modifier-groups') @RequireCapabilities('catalog.manage') groupCreate(
    @Req() r: PrincipalRequest,
    @Body() b: any,
  ) {
    return this.catalog.createGroup(r.principal!.tenantId, b);
  }
  @Patch('modifier-groups/:id')
  @RequireCapabilities('catalog.manage')
  groupUpdate(
    @Req() r: PrincipalRequest,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.catalog.updateGroup(r.principal!.tenantId, id, b);
  }
  @Post('modifier-groups/:id/options')
  @RequireCapabilities('catalog.manage')
  optionCreate(
    @Req() r: PrincipalRequest,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.catalog.createOption(r.principal!.tenantId, id, b);
  }
  @Patch('modifier-options/:id')
  @RequireCapabilities('catalog.manage')
  optionUpdate(
    @Req() r: PrincipalRequest,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.catalog.updateOption(r.principal!.tenantId, id, b);
  }
  @Put('products/:id/modifier-group')
  @RequireCapabilities('catalog.manage')
  associate(
    @Req() r: PrincipalRequest,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.catalog.associateGroup(r.principal!.tenantId, id, b);
  }
  @Put('products/:id/media') @RequireCapabilities('catalog.manage') attach(
    @Req() r: PrincipalRequest,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.catalog.attachMedia(r.principal!.tenantId, id, b);
  }
  @Get('branding') @RequireCapabilities('catalog.read') branding(
    @Req() r: PrincipalRequest,
  ) {
    return this.catalog.getBranding(r.principal!.tenantId);
  }
  @Put('branding') @RequireCapabilities('catalog.manage') brandingUpdate(
    @Req() r: PrincipalRequest,
    @Body() b: any,
  ) {
    return this.catalog.updateBranding(r.principal!.tenantId, b);
  }
  @Post('media')
  @RequireCapabilities('catalog.manage')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  upload(
    @Req() r: PrincipalRequest,
    @UploadedFile() file: any,
    @Body('altText') alt?: string,
  ) {
    return this.media.upload(r.principal!.tenantId, file, alt);
  }
}
