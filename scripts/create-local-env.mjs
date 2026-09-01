import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(projectRoot, '.env');

const existing = existsSync(envPath)
  ? Object.fromEntries(
      readFileSync(envPath, 'utf8')
        .split('\n')
        .filter((line) => line.includes('='))
        .map((line) => {
          const separator = line.indexOf('=');
          return [line.slice(0, separator), line.slice(separator + 1)];
        }),
    )
  : {};

if (existing.DATABASE_ADMIN_URL && existing.POSTGRES_APP_PASSWORD) {
  process.stdout.write('.env local já está atualizado.\n');
  process.exit(0);
}

const adminPassword = existing.POSTGRES_PASSWORD ?? randomBytes(24).toString('hex');
const applicationPassword = randomBytes(24).toString('hex');
const content = [
  'POSTGRES_PORT=55432',
  'POSTGRES_DB=mesa_digital',
  'POSTGRES_USER=mesa_digital_admin',
  `POSTGRES_PASSWORD=${adminPassword}`,
  'POSTGRES_APP_USER=mesa_digital_app',
  `POSTGRES_APP_PASSWORD=${applicationPassword}`,
  `DATABASE_ADMIN_URL=postgresql://mesa_digital_admin:${adminPassword}@127.0.0.1:55432/mesa_digital`,
  `DATABASE_URL=postgresql://mesa_digital_app:${applicationPassword}@127.0.0.1:55432/mesa_digital`,
  '',
].join('\n');

writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600 });
process.stdout.write('.env local preparado com credenciais separadas.\n');
