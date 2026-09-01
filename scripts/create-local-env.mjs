import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(projectRoot, '.env');

if (existsSync(envPath)) {
  process.stdout.write('.env local já existe; nenhuma alteração realizada.\n');
  process.exit(0);
}

const password = randomBytes(24).toString('hex');
const content = [
  'POSTGRES_PORT=55432',
  'POSTGRES_DB=mesa_digital',
  'POSTGRES_USER=mesa_digital',
  `POSTGRES_PASSWORD=${password}`,
  `DATABASE_URL=postgresql://mesa_digital:${password}@127.0.0.1:55432/mesa_digital`,
  '',
].join('\n');

writeFileSync(envPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
process.stdout.write('.env local criado com credencial aleatória.\n');
