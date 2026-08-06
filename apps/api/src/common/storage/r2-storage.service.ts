import { Injectable, Logger } from '@nestjs/common';
import { AwsClient } from 'aws4fetch';
import {
  StorageObject,
  StorageObjectNotFoundError,
  StorageProvider,
} from './storage.types';

/**
 * Cloudflare R2 StorageProvider (S3-compatible object store).
 *
 * The same StorageProvider port as {@link LocalDiskStorageService}; selected by
 * {@link StorageModule} whenever the four `R2_*` env vars are set (else local
 * disk). Requests are signed with SigV4 via `aws4fetch` — a zero-dependency,
 * Web-Crypto-based signer — and issued with the global `fetch`. Keys are the
 * same tenant-scoped, slash-separated object keys the document service already
 * mints (`tenants/<id>/documents/…`); R2 stores them verbatim.
 *
 * Config is read raw off `process.env` (the STORAGE_LOCAL_ROOT / API_DEBUG_ERRORS
 * precedent) so the module can decide the binding without DI wiring. The
 * constructor never throws on a partial/absent config — {@link isConfigured}
 * gates instantiation-for-use — so an unused instance is inert.
 */
@Injectable()
export class R2StorageService implements StorageProvider {
  private readonly logger = new Logger(R2StorageService.name);
  readonly providerName = 'cloudflare-r2';

  private readonly accountId?: string;
  private readonly bucket?: string;
  private readonly accessKeyId?: string;
  private readonly secretAccessKey?: string;
  private client?: AwsClient;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.accountId = env.R2_ACCOUNT_ID?.trim() || undefined;
    this.bucket = env.R2_BUCKET?.trim() || undefined;
    this.accessKeyId = env.R2_ACCESS_KEY_ID?.trim() || undefined;
    this.secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() || undefined;
  }

  /** True only when ALL four R2 settings are present — the switch StorageModule uses. */
  static isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(
      env.R2_ACCOUNT_ID?.trim() &&
      env.R2_BUCKET?.trim() &&
      env.R2_ACCESS_KEY_ID?.trim() &&
      env.R2_SECRET_ACCESS_KEY?.trim(),
    );
  }

  private endpoint(): string {
    // R2's account-scoped S3 endpoint. The bucket + key form the path.
    return `https://${this.accountId}.r2.cloudflarestorage.com`;
  }

  private objectUrl(key: string): string {
    const segments = key.split('/').filter(Boolean);
    if (segments.length === 0) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    // Path-style: <endpoint>/<bucket>/<key>. Each segment is URL-encoded so
    // keys with reserved characters sign + address correctly.
    const path = segments.map((s) => encodeURIComponent(s)).join('/');
    return `${this.endpoint()}/${encodeURIComponent(this.bucket!)}/${path}`;
  }

  private aws(): AwsClient {
    if (!R2StorageService.isConfigured()) {
      // Guarded by StorageModule, so this is a misconfiguration, not a runtime path.
      throw new Error(
        'R2StorageService used without a complete R2_* configuration',
      );
    }
    this.client ??= new AwsClient({
      accessKeyId: this.accessKeyId!,
      secretAccessKey: this.secretAccessKey!,
      service: 's3',
      region: 'auto',
    });
    return this.client;
  }

  async put(key: string, data: Buffer, contentType?: string): Promise<void> {
    const res = await this.aws().fetch(this.objectUrl(key), {
      method: 'PUT',
      // undici's fetch accepts a Buffer body at runtime; the DOM `BodyInit`
      // type is narrower, so cast (a Buffer is a Uint8Array view — no copy).
      body: data as unknown as BodyInit,
      headers: contentType ? { 'Content-Type': contentType } : undefined,
    });
    if (!res.ok) {
      throw new Error(
        `R2 put failed for ${key}: ${res.status} ${await this.errorBody(res)}`,
      );
    }
    this.logger.debug(`Stored ${data.length} bytes at ${key}`);
  }

  async get(key: string): Promise<StorageObject> {
    const res = await this.aws().fetch(this.objectUrl(key), { method: 'GET' });
    if (res.status === 404) {
      throw new StorageObjectNotFoundError(key);
    }
    if (!res.ok) {
      throw new Error(
        `R2 get failed for ${key}: ${res.status} ${await this.errorBody(res)}`,
      );
    }
    const data = Buffer.from(await res.arrayBuffer());
    return {
      data,
      contentType: res.headers.get('content-type') ?? undefined,
    };
  }

  async delete(key: string): Promise<void> {
    const res = await this.aws().fetch(this.objectUrl(key), {
      method: 'DELETE',
    });
    // S3/R2 return 204 whether or not the object existed — delete is a no-op if absent.
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `R2 delete failed for ${key}: ${res.status} ${await this.errorBody(res)}`,
      );
    }
  }

  private async errorBody(res: Response): Promise<string> {
    try {
      return (await res.text()).slice(0, 500);
    } catch {
      return '<no body>';
    }
  }
}
