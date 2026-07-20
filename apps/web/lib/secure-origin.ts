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

/**
 * Redirect the public `www` alias to the configured canonical web origin.
 * Other hosts are deliberately ignored so a forged Host header cannot turn
 * this into an open redirect and service subdomains (for example `api`) remain
 * independent.
 */
export function buildCanonicalHostRedirectUrl(
  requestUrl: string,
  hostHeader: string | null,
  canonicalOrigin: string | undefined,
): URL | null {
  if (!canonicalOrigin?.trim()) return null;

  let canonical: URL;
  try {
    canonical = new URL(canonicalOrigin);
  } catch {
    return null;
  }
  if (canonical.protocol !== 'https:' || canonical.pathname !== '/') {
    return null;
  }

  const publicHost = (hostHeader ?? '').split(',')[0]?.trim().toLowerCase();
  const publicHostname = publicHost?.split(':')[0];
  if (publicHostname !== `www.${canonical.hostname.toLowerCase()}`) {
    return null;
  }

  const url = new URL(requestUrl);
  url.protocol = canonical.protocol;
  url.hostname = canonical.hostname;
  url.port = canonical.port;
  return url;
}
