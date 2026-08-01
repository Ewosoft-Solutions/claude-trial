import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { EnvConfig } from '../../common/config/env.config';

export interface DownloadTokenClaims {
  tenantId: string;
  documentId: string;
  versionId: string;
  /** epoch seconds */
  exp: number;
}

/**
 * Signed short-lived download URLs (F4 / ADR-08).
 *
 * A token is an HMAC over the exact (tenant, document, version, expiry) it
 * authorizes — it cannot be edited to point at another document or extended in
 * time without the server secret. It is minted only after a server-side
 * permission check; nothing is served from a browsable/static path. Verification
 * is constant-time.
 */
@Injectable()
export class DocumentUrlSigner {
  private readonly secret: string;

  constructor(configService: ConfigService) {
    const cfg = configService.getOrThrow<EnvConfig>('env', { infer: true });
    this.secret = cfg.DOCUMENT_URL_SIGNING_SECRET;
  }

  /** Mint a token valid for `ttlSeconds` (default 5 minutes). */
  sign(
    claims: Omit<DownloadTokenClaims, 'exp'>,
    ttlSeconds = 300,
  ): { token: string; expiresAt: Date } {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const full: DownloadTokenClaims = { ...claims, exp };
    const payload = Buffer.from(JSON.stringify(full)).toString('base64url');
    const mac = this.mac(payload);
    return { token: `${payload}.${mac}`, expiresAt: new Date(exp * 1000) };
  }

  /** Verify a token; returns its claims or null if invalid/tampered/expired. */
  verify(token: string): DownloadTokenClaims | null {
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const payload = token.slice(0, dot);
    const mac = token.slice(dot + 1);
    const expected = this.mac(payload);
    if (!constantTimeEqual(mac, expected)) return null;

    let claims: DownloadTokenClaims;
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (typeof claims.exp !== 'number' || claims.exp < Date.now() / 1000) {
      return null;
    }
    return claims;
  }

  private mac(payload: string): string {
    return createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
