import { AwsClient } from 'aws4fetch';
import { R2StorageService } from './r2-storage.service';
import { StorageObjectNotFoundError } from './storage.types';

jest.mock('aws4fetch');

const R2_ENV = {
  R2_ACCOUNT_ID: 'acct123',
  R2_BUCKET: 'my-bucket',
  R2_ACCESS_KEY_ID: 'akid',
  R2_SECRET_ACCESS_KEY: 'secret',
} satisfies NodeJS.ProcessEnv;

function makeResponse(
  status: number,
  body: Uint8Array = new Uint8Array(),
  contentType?: string,
): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    text: async () => Buffer.from(body).toString('utf8'),
    headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
  } as unknown as Response;
}

describe('R2StorageService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (AwsClient as jest.Mock).mockImplementation(() => ({ fetch: fetchMock }));
    // Ensure the static isConfigured() (reads process.env) sees a full config.
    Object.assign(process.env, R2_ENV);
  });

  afterEach(() => {
    for (const k of Object.keys(R2_ENV)) delete process.env[k];
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('is true only when all four settings are present', () => {
      expect(R2StorageService.isConfigured(R2_ENV)).toBe(true);
      expect(
        R2StorageService.isConfigured({ ...R2_ENV, R2_BUCKET: '' }),
      ).toBe(false);
      expect(R2StorageService.isConfigured({})).toBe(false);
    });
  });

  it('reports its provider name', () => {
    expect(new R2StorageService(R2_ENV).providerName).toBe('cloudflare-r2');
  });

  it('PUTs to the path-style object URL with the content type', async () => {
    fetchMock.mockResolvedValue(makeResponse(200));
    const svc = new R2StorageService(R2_ENV);
    await svc.put('tenants/t1/documents/d1/v1/abc', Buffer.from('hi'), 'image/png');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'https://acct123.r2.cloudflarestorage.com/my-bucket/tenants/t1/documents/d1/v1/abc',
    );
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'Content-Type': 'image/png' });
  });

  it('throws when PUT is not ok', async () => {
    fetchMock.mockResolvedValue(makeResponse(403, Buffer.from('AccessDenied')));
    const svc = new R2StorageService(R2_ENV);
    await expect(
      svc.put('tenants/t1/x', Buffer.from('hi')),
    ).rejects.toThrow(/R2 put failed.*403/);
  });

  it('GETs and returns the bytes + content type', async () => {
    fetchMock.mockResolvedValue(
      makeResponse(200, Buffer.from('payload'), 'application/pdf'),
    );
    const svc = new R2StorageService(R2_ENV);
    const obj = await svc.get('tenants/t1/x');
    expect(obj.data.toString('utf8')).toBe('payload');
    expect(obj.contentType).toBe('application/pdf');
  });

  it('maps a 404 GET to StorageObjectNotFoundError', async () => {
    fetchMock.mockResolvedValue(makeResponse(404));
    const svc = new R2StorageService(R2_ENV);
    await expect(svc.get('tenants/t1/missing')).rejects.toBeInstanceOf(
      StorageObjectNotFoundError,
    );
  });

  it('treats a 404 DELETE as a no-op', async () => {
    fetchMock.mockResolvedValue(makeResponse(404));
    const svc = new R2StorageService(R2_ENV);
    await expect(svc.delete('tenants/t1/missing')).resolves.toBeUndefined();
  });
});
