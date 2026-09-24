import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaService } from './media.service.js';

describe('MediaService', () => {
  let root: string;
  let service: MediaService;
  const repository = {
    createMedia: vi.fn(async (_tx, _tenant, data) => [
      { id: crypto.randomUUID(), ...data },
    ]),
  };
  const database = {
    withTenantContext: vi.fn(async (_tenant, callback) => callback({})),
  };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mesa-media-'));
    process.env.MEDIA_LOCAL_ROOT = root;
    service = new MediaService(database as never, repository as never);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('rejects spoofed MIME content and unsafe storage keys', async () => {
    await expect(
      service.upload('tenant', {
        buffer: Buffer.from('not an image'),
        mimetype: 'image/png',
        size: 12,
        originalname: '../../x.png',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.read('../secret.png')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('generates the storage key server-side for a valid image', async () => {
    const buffer = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      Buffer.alloc(8),
    ]);
    const result = await service.upload(
      'tenant',
      {
        buffer,
        mimetype: 'image/png',
        size: buffer.length,
        originalname: '../../ignored.exe',
      },
      ' Foto ',
    );
    expect(result.storageKey).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(result.storageKey).not.toContain('ignored');
    expect(await service.read(result.storageKey)).toEqual(buffer);
  });
});
