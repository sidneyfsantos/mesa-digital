import { Controller, Get, Param } from '@nestjs/common';
import { EntryCredentialService } from './entry-credential.service.js';
@Controller('public/entry')
export class PublicEntryController {
  constructor(private readonly credentials: EntryCredentialService) {}
  @Get(':token') resolve(@Param('token') token: string) { return this.credentials.resolvePublic(token); }
}
