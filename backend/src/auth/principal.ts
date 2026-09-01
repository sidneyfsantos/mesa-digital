import { Capability } from './capabilities.js';

export interface Principal {
  userId: string;
  tenantId: string;
  tenantUserId: string;
  capabilities: ReadonlySet<Capability>;
}

export interface PrincipalRequest {
  principal?: Principal;
}
