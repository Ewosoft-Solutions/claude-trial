'use client';

import Link from 'next/link';
import { Fingerprint, ShieldCheck } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';

interface BiometricEnrollmentBannerProps {
  required: boolean;
  requiredBy: string[];
  setupHref?: string;
  onSetup?: () => void;
  setupPending?: boolean;
  onSnooze?: () => void;
  onSuppress?: () => void;
}

function requirementCopy(requiredBy: string[]): string {
  if (requiredBy.length === 1) {
    return `${requiredBy[0]} requires you to create a passkey. Password and recovery options remain available.`;
  }
  if (requiredBy.length > 1) {
    return `${requiredBy.length} of your schools require you to create a passkey. Password and recovery options remain available.`;
  }
  return 'Your school requires you to create a passkey. Password and recovery options remain available.';
}

export function BiometricEnrollmentBanner({
  required,
  requiredBy,
  setupHref,
  onSetup,
  setupPending = false,
  onSnooze,
  onSuppress,
}: BiometricEnrollmentBannerProps) {
  return (
    <section
      aria-labelledby="biometric-enrollment-title"
      aria-live="polite"
      className={`mx-[var(--content-padding)] mt-3 flex shrink-0 flex-wrap items-center gap-3 rounded-[var(--radius)] border px-4 py-3 shadow-xs ${
        required
          ? 'border-warning/40 bg-warning/10'
          : 'border-info/35 bg-info/10'
      }`}
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-inset ${
          required
            ? 'bg-warning/15 text-warning ring-warning/25'
            : 'bg-info/15 text-info ring-info/25'
        }`}
        aria-hidden="true"
      >
        {required ? (
          <ShieldCheck className="size-5" />
        ) : (
          <Fingerprint className="size-5" />
        )}
      </span>

      <div className="min-w-0 flex-1 basis-64">
        <h2
          id="biometric-enrollment-title"
          className="text-sm font-semibold text-foreground text-pretty"
        >
          {required
            ? 'Biometric sign-in is required'
            : 'Set up biometric sign-in'}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
          {required
            ? requirementCopy(requiredBy)
            : 'Create a passkey to sign in with Face ID, Touch ID, Windows Hello, or your device unlock—without typing your password.'}
        </p>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        {required ? null : (
          <>
            <Button variant="ghost" size="sm" onClick={onSnooze}>
              Remind me later
            </Button>
            <Button variant="ghost" size="sm" onClick={onSuppress}>
              Don&apos;t remind me in this app
            </Button>
          </>
        )}

        {setupHref ? (
          <Button asChild size="sm">
            <Link href={setupHref}>
              {required ? 'Set up now' : 'Set up biometric sign-in'}
            </Link>
          </Button>
        ) : (
          <Button size="sm" onClick={onSetup} disabled={setupPending}>
            {setupPending
              ? 'Switching school…'
              : required
                ? 'Set up now'
                : 'Set up biometric sign-in'}
          </Button>
        )}
      </div>
    </section>
  );
}
