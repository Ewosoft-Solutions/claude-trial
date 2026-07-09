import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import {
  StorageObject,
  StorageObjectNotFoundError,
  StorageProvider,
} from './storage.types';

/**
 * Local-disk StorageProvider (dev default).
 *
 * Objects live under STORAGE_LOCAL_ROOT (default ./storage, relative to the
 * API process cwd). Keys are slash-separated paths; each segment is
 * sanitized so a key can never escape the root. Content type is not
 * persisted — callers keep it in their own rows (LessonMaterial.mimeType).
 */
@Injectable()
export class LocalDiskStorageService implements StorageProvider {
  private readonly logger = new Logger(LocalDiskStorageService.name);
  private readonly root: string;

  readonly providerName = 'local-disk';

  constructor() {
    // Read raw off process.env (the API_DEBUG_ERRORS precedent) so tests can
    // point the root at a temp dir before instantiation.
    this.root = path.resolve(process.env.STORAGE_LOCAL_ROOT ?? './storage');
  }

  private resolveKey(key: string): string {
    const segments = key.split('/').filter(Boolean);
    if (segments.length === 0) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    for (const segment of segments) {
      if (segment === '.' || segment === '..' || segment.includes(path.sep)) {
        throw new Error(`Invalid storage key segment: ${segment}`);
      }
    }
    return path.join(this.root, ...segments);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolveKey(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    this.logger.debug(`Stored ${data.length} bytes at ${key}`);
  }

  async get(key: string): Promise<StorageObject> {
    const filePath = this.resolveKey(key);
    try {
      return { data: await fs.readFile(filePath) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new StorageObjectNotFoundError(key);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKey(key);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
