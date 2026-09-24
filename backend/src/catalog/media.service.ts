import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service.js';
import { CatalogRepository } from '../database/repositories/catalog.repository.js';
type Upload = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};
const types: { [key: string]: { ext: string; magic: (b: Buffer) => boolean } } =
  {
    'image/jpeg': {
      ext: 'jpg',
      magic: (b) =>
        b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    'image/png': {
      ext: 'png',
      magic: (b) =>
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    },
    'image/webp': {
      ext: 'webp',
      magic: (b) =>
        b.length > 12 &&
        b.subarray(0, 4).toString() === 'RIFF' &&
        b.subarray(8, 12).toString() === 'WEBP',
    },
  };
@Injectable()
export class MediaService {
  private readonly root = resolve(
    process.env.MEDIA_LOCAL_ROOT ?? '.data/media',
  );
  constructor(
    private readonly database: DatabaseService,
    private readonly repo: CatalogRepository,
  ) {}
  async upload(tenantId: string, file: Upload | undefined, altText?: string) {
    if (!file) throw new BadRequestException('Image file is required.');
    const type = types[file.mimetype];
    if (
      !type ||
      file.size < 12 ||
      file.size > 5 * 1024 * 1024 ||
      !type.magic(file.buffer)
    )
      throw new BadRequestException('Invalid image file.');
    const storageKey = `${randomUUID()}.${type.ext}`;
    await mkdir(this.root, { recursive: true });
    await writeFile(resolve(this.root, storageKey), file.buffer, {
      flag: 'wx',
    });
    try {
      return await this.database.withTenantContext(
        tenantId,
        async (tx) =>
          (
            await this.repo.createMedia(tx, tenantId, {
              storageKey,
              mimeType: file.mimetype,
              sizeBytes: file.size,
              altText:
                typeof altText === 'string'
                  ? altText.trim().slice(0, 180) || null
                  : null,
            })
          )[0],
      );
    } catch (error) {
      await unlink(resolve(this.root, storageKey)).catch(() => undefined);
      throw error;
    }
  }
  async read(storageKey: string) {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(storageKey))
      throw new NotFoundException();
    const path = resolve(this.root, storageKey);
    if (!path.startsWith(`${this.root}/`)) throw new NotFoundException();
    try {
      return await readFile(path);
    } catch {
      throw new NotFoundException();
    }
  }
  mime(storageKey: string) {
    return storageKey.endsWith('.png')
      ? 'image/png'
      : storageKey.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
  }
}
