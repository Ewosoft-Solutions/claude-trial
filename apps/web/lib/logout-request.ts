export interface LogoutRequest {
  body: {
    refreshToken: string;
    reason?: 'manual' | 'idle' | 'absolute_expiry' | 'refresh_failed';
  };
  headers: { Authorization: string };
}

/**
 * Sessions are stored by refresh token, while the access token authenticates
 * the request. A remote logout needs both; local cookies are still cleared if
 * either one has already expired or disappeared.
 */
export function buildLogoutRequest(
  accessToken: string | undefined,
  refreshToken: string | undefined,
  reason?: LogoutRequest['body']['reason'],
): LogoutRequest | null {
  if (!accessToken || !refreshToken) return null;

  return {
    body: { refreshToken, ...(reason ? { reason } : {}) },
    headers: { Authorization: `Bearer ${accessToken}` },
  };
}

/**
 * Resume only the page that actually initiated the same-origin logout request.
 * Browser JavaScript cannot forge the Fetch `Referer` header, unlike a JSON
 * `returnTo` field supplied by the client.
 */
export function resolveLogoutReturnPath(
  referrer: string | null,
  allowedOrigins: readonly string[],
): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (!allowedOrigins.includes(url.origin)) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
