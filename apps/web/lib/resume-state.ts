import { isSafeRedirectPath } from './auth-cookies';

export const RESUME_STATE_VERSION = 1 as const;
export const RESUME_MAX_AGE_SECONDS = 30 * 60;
export const RESUMABLE_MODAL_KEYS = ['global-search'] as const;
export type ResumableModalKey = (typeof RESUMABLE_MODAL_KEYS)[number];

export interface ResumeState {
  version: typeof RESUME_STATE_VERSION;
  path: string;
  issuedAt: number;
  expiresAt: number;
  tenantId?: string;
  profileId?: string;
  modalKey?: ResumableModalKey;
}

const textEncoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
    .buffer as ArrayBuffer;
}

function getResumeSecret(): string | null {
  const configured = process.env.AUTH_RESUME_SECRET;
  if (configured) return configured;
  return process.env.NODE_ENV === 'production'
    ? null
    : 'schoolwithease-local-resume-state-only';
}

async function importSigningKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export function createResumeState(
  input: Pick<ResumeState, 'path' | 'tenantId' | 'profileId' | 'modalKey'>,
  now = Date.now(),
): ResumeState | null {
  const path = sanitizeResumePath(input.path);
  if (!path) return null;
  return {
    version: RESUME_STATE_VERSION,
    path,
    issuedAt: now,
    expiresAt: now + RESUME_MAX_AGE_SECONDS * 1000,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    ...(input.profileId ? { profileId: input.profileId } : {}),
    ...(input.modalKey && RESUMABLE_MODAL_KEYS.includes(input.modalKey)
      ? { modalKey: input.modalKey }
      : {}),
  };
}

export async function signResumeState(
  state: ResumeState,
): Promise<string | null> {
  const secret = getResumeSecret();
  if (!secret) return null;
  const payload = base64UrlEncode(textEncoder.encode(JSON.stringify(state)));
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(payload),
  );
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyResumeState(
  token: string | undefined,
  now = Date.now(),
): Promise<ResumeState | null> {
  const secret = getResumeSecret();
  if (!secret || !token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  try {
    const key = await importSigningKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      textEncoder.encode(payload),
    );
    if (!valid) return null;
    const parsed = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload)),
    ) as Partial<ResumeState>;
    if (
      parsed.version !== RESUME_STATE_VERSION ||
      typeof parsed.path !== 'string' ||
      typeof parsed.issuedAt !== 'number' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= now ||
      parsed.issuedAt > now + 60_000 ||
      sanitizeResumePath(parsed.path) !== parsed.path
    ) {
      return null;
    }
    if (
      parsed.modalKey &&
      !RESUMABLE_MODAL_KEYS.includes(parsed.modalKey as ResumableModalKey)
    ) {
      return null;
    }
    return parsed as ResumeState;
  } catch {
    return null;
  }
}

const SENSITIVE_QUERY_KEY =
  /(?:token|code|password|secret|credential|redirect|return|from)/i;

export function sanitizeResumePath(path: string): string | null {
  if (!isSafeRedirectPath(path) || path.length > 2048) return null;
  try {
    const url = new URL(path, 'https://resume.invalid');
    if (url.origin !== 'https://resume.invalid') return null;
    const query = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      if (SENSITIVE_QUERY_KEY.test(key)) continue;
      if (key.length <= 80 && value.length <= 300) query.append(key, value);
    }
    const search = query.toString();
    return `${url.pathname}${search ? `?${search}` : ''}`;
  } catch {
    return null;
  }
}
