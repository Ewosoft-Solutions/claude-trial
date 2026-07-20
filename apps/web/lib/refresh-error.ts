/** Only credential failures end the refresh session and clear auth cookies. */
export function isTerminalRefreshFailure(status: number): boolean {
  return status === 401 || status === 403;
}
