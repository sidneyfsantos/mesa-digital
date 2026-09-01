import { SetMetadata } from '@nestjs/common';
import { Capability } from './capabilities.js';

export const REQUIRED_CAPABILITIES = Symbol('required-capabilities');
export const RequireCapabilities = (...capabilities: Capability[]) =>
  SetMetadata(REQUIRED_CAPABILITIES, capabilities);
