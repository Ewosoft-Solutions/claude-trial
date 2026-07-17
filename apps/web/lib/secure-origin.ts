/**
 * True when an externally hosted request arrived over HTTP and must be
 * upgraded before serving the app. Localhost remains available for normal
 * local development because browsers treat it as a trustworthy context.
 */
export function shouldRedirectToHttps(
  hostHeader: string | null,
  forwardedProto: string | null,
): boolean {
  const host =
    ((hostHeader ?? '').split(',')[0] ?? '')
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
      .split(':')[0] ?? '';
  const protocol = ((forwardedProto ?? '').split(',')[0] ?? '')
    .trim()
    .toLowerCase()
    .replace(/:$/, '');

  const isLocal =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1';

  return protocol === 'http' && !isLocal;
}

/** Build the public HTTPS URL without leaking a reverse proxy's origin port. */
export function buildHttpsRedirectUrl(
  requestUrl: string,
  hostHeader: string | null,
): URL {
  const url = new URL(requestUrl);
  const publicHost = (hostHeader ?? '').split(',')[0]?.trim();
  const publicHostname = publicHost?.split(':')[0];

  url.protocol = 'https:';
  if (publicHostname) url.hostname = publicHostname;
  url.port = '';
  return url;
}
