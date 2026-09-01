import { pgRole } from 'drizzle-orm/pg-core';

export const applicationRole = pgRole('mesa_digital_app').existing();
