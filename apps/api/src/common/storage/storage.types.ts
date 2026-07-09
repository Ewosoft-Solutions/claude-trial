/**
 * Storage provider port.
 *
 * File binaries (lesson materials today) live behind this interface so the
 * backing store is swappable: local disk in dev, an S3-compatible object
 * store later — same indirection discipline as the LLM/embeddings ports in
 * src/ai. Rows in the database carry only the storage key.
 */

export interface StorageObject {
  data: Buffer;
  contentType?: string;
}

export interface StorageProvider {
  readonly providerName: string;

  /** Persist `data` under `key` (overwrites). */
  put(key: string, data: Buffer, contentType?: string): Promise<void>;

  /** Load the object at `key`. Throws StorageObjectNotFoundError if absent. */
  get(key: string): Promise<StorageObject>;

  /** Remove the object at `key` (no-op if absent). */
  delete(key: string): Promise<void>;
}

/** Nest injection token for the configured StorageProvider implementation. */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export class StorageObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Storage object not found: ${key}`);
    this.name = 'StorageObjectNotFoundError';
  }
}
