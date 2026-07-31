import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const APP_ROOT = fileURLToPath(new URL('../app/(app)', import.meta.url));
const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const COMMERCIAL_COPY_PATTERNS = [
  {
    label: 'subscription or trial expiry copy',
    pattern:
      /\b(?:subscription|trial)\b.{0,48}\b(?:expires?|expired|expiring|days? left|remaining)\b/is,
  },
  {
    label: 'subscription or trial expiry copy',
    pattern:
      /\b(?:expires?|expired|expiring|days? left|remaining)\b.{0,48}\b(?:subscription|trial)\b/is,
  },
  {
    label: 'commercial upgrade or renewal CTA',
    pattern: /\b(?:upgrade|renew)\b.{0,32}\b(?:plan|subscription|account)\b/is,
  },
  {
    label: 'premium upsell CTA',
    pattern: /\b(?:unlock|go)\s+premium\b/i,
  },
] as const;

const EXPIRY_PAY_NOW_PATTERN =
  /(?:\bexpires?\b.{0,80}\bpay\s+now\b|\bpay\s+now\b.{0,80}\bexpires?\b)/is;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    const extension = entry.name.slice(entry.name.lastIndexOf('.'));
    return SOURCE_EXTENSIONS.has(extension) ? [path] : [];
  });
}

function isAccountOrPlatformSurface(route: string): boolean {
  return route.startsWith(`account/`) || route.startsWith(`platform/`);
}

function isSchoolPaymentSurface(route: string): boolean {
  return route.startsWith(`finance/`) || route.startsWith(`students/fees/`);
}

function commercialNagLabels(source: string, route: string): string[] {
  const matches: string[] = COMMERCIAL_COPY_PATTERNS.filter(({ pattern }) =>
    pattern.test(source),
  ).map(({ label }) => label);

  if (!isSchoolPaymentSurface(route) && EXPIRY_PAY_NOW_PATTERN.test(source)) {
    matches.push('expiry-linked Pay Now CTA');
  }

  return matches;
}

describe('authenticated workspace copy', () => {
  it('keeps commercial subscription nags out of operational surfaces', () => {
    const files = sourceFiles(APP_ROOT).filter((file) => {
      const route = relative(APP_ROOT, file);
      return !isAccountOrPlatformSurface(route);
    });

    const violations = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const route = relative(APP_ROOT, file);
      const matches = commercialNagLabels(source, route);

      return matches.map((label) => `${relative(WEB_ROOT, file)}: ${label}`);
    });

    // School fees, invoices, payment plans, and receipts are operational facts,
    // so those terms remain valid. This guard targets product-subscription
    // promotion; commercial billing belongs in account/platform administration.
    expect(violations).toEqual([]);
  });

  it('distinguishes the rejected legacy nag from school-payment actions', () => {
    expect(
      commercialNagLabels('Expires 2026-08-31 · Pay Now', 'app-chrome.tsx'),
    ).toContain('expiry-linked Pay Now CTA');

    expect(
      commercialNagLabels(
        'Term 3 fees · due in 6 days · Pay now · Payment plan',
        'students/fees/page.tsx',
      ),
    ).toEqual([]);
  });
});
