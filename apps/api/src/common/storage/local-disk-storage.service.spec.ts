import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { LocalDiskStorageService } from './local-disk-storage.service';
import { StorageObjectNotFoundError } from './storage.types';

describe('LocalDiskStorageService', () => {
  let root: string;
  let service: LocalDiskStorageService;
  const originalRoot = process.env.STORAGE_LOCAL_ROOT;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'swe-storage-'));
    process.env.STORAGE_LOCAL_ROOT = root;
    service = new LocalDiskStorageService();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (originalRoot === undefined) delete process.env.STORAGE_LOCAL_ROOT;
    else process.env.STORAGE_LOCAL_ROOT = originalRoot;
  });

  it('round-trips put/get/delete', async () => {
    const key = 'materials/tenant-a/mat-1/notes.pdf';
    const data = Buffer.from('pdf bytes');

    await service.put(key, data, 'application/pdf');
    const object = await service.get(key);
    expect(object.data.equals(data)).toBe(true);

    await service.delete(key);
    await expect(service.get(key)).rejects.toBeInstanceOf(
      StorageObjectNotFoundError,
    );
    // Deleting again is a no-op, not an error.
    await expect(service.delete(key)).resolves.toBeUndefined();
  });

  it('rejects keys that could escape the root', async () => {
    await expect(
      service.put('../outside.txt', Buffer.from('x')),
    ).rejects.toThrow(/Invalid storage key/);
    await expect(
      service.put('materials/../../outside.txt', Buffer.from('x')),
    ).rejects.toThrow(/Invalid storage key/);
    await expect(service.get('')).rejects.toThrow(/Invalid storage key/);
  });
});
