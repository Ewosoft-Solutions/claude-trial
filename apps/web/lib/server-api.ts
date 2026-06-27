/**
 * Server-side authenticated fetch helper for the NestJS backend.
 *
 * This module is server-only: it reads httpOnly cookies and must only run in
 * server components, server actions, or Route Handlers. Never import it from
 * a 'use client' module.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { COOKIE_ACCESS_TOKEN } from './auth-cookies';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

/** Returns null (not an error) when no API URL is configured (dev fallback). */
export async function serverApiGet<T>(path: string): Promise<T | null> {
  if (!API_BASE) return null;

  const jar = await cookies();
  const token = jar.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!token) return null;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

/** For use in Route Handlers: forward request with the access-token cookie. */
export function getBearerFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_ACCESS_TOKEN}=([^;]+)`));
  return match?.[1] ?? null;
}
