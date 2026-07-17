'use client';

/* ============================================================
   /account/security — biometric sign-in (passkeys)

   Opt-in enrolment of a platform authenticator (Face ID / Touch ID /
   Windows Hello / Android) for faster sign-in, plus management of the
   devices already enrolled. Enrolment runs the WebAuthn credential-
   creation ceremony in the browser (lib/webauthn) and posts the result
   to the biometrics API. The "Set up" affordance only appears when the
   device actually exposes a platform authenticator.

   Enrolling or removing a device first requires an operation-bound step-up
   confirmation (see docs/biometrics-plan.md §4C).
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  Fingerprint,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';

import {
  getPasskeyAvailability,
  guessDeviceLabel,
  signalUnknownPasskey,
  startRegistration,
  type PasskeyAvailability,
} from '@/lib/webauthn';
import { isSafeRedirectPath } from '@/lib/auth-cookies';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import type { BiometricEnrollmentPolicy } from '@/lib/security-governance';
import { useViewer } from '@/app/providers/viewer-provider';
import { StepUpPrompt } from '../../_shared/step-up-prompt';

interface BiometricDevice {
  id: string;
  label: string;
  /** Passkey provider (e.g. "iCloud Keychain"), from the AAGUID, when known. */
  provider?: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

type PendingStepUpAction =
  | { kind: 'enroll' }
  | { kind: 'remove'; deviceId: string };

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { biometricEnrollment } = useViewer();
  const enrollmentCardRef = React.useRef<HTMLDivElement>(null);
  const enrollmentIntentFocusedRef = React.useRef(false);
  const [passkeyAvailability, setPasskeyAvailability] =
    React.useState<PasskeyAvailability | null>(null);
  const [enrollmentPolicy, setEnrollmentPolicy] =
    React.useState<BiometricEnrollmentPolicy>('allow');
  const [devices, setDevices] = React.useState<BiometricDevice[] | null>(null);
  const [enrolling, setEnrolling] = React.useState(false);
  const [pendingRemove, setPendingRemove] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [enrollmentComplete, setEnrollmentComplete] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [pendingStepUp, setPendingStepUp] =
    React.useState<PendingStepUpAction | null>(null);
  const enrollmentIntent = searchParams.get('intent') === 'enroll';
  const requestedReturn = searchParams.get('from');
  const returnTo =
    isSafeRedirectPath(requestedReturn) &&
    !requestedReturn.startsWith('/account')
      ? requestedReturn
      : null;

  const loadDevices = React.useCallback(async () => {
    try {
      const res = await fetch('/api/auth/biometrics/devices');
      setDevices(res.ok ? await res.json() : []);
    } catch {
      setDevices([]);
    }
  }, []);

  React.useEffect(() => {
    // Do not treat the platform-authenticator advisory probe as authoritative:
    // iOS standalone PWAs can report false even when Face ID passkeys work.
    // A user-triggered WebAuthn ceremony is the reliable availability check.
    setPasskeyAvailability(getPasskeyAvailability());
    void loadDevices();
    void fetch('/api/auth/biometrics/policy')
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as {
          policy?: BiometricEnrollmentPolicy;
        };
        if (body.policy) setEnrollmentPolicy(body.policy);
      })
      .catch(() => undefined);
  }, [loadDevices]);

  React.useEffect(() => {
    if (!enrollmentIntent || enrollmentIntentFocusedRef.current) return;
    enrollmentIntentFocusedRef.current = true;

    const frame = window.requestAnimationFrame(() => {
      const target = enrollmentCardRef.current;
      if (!target) return;
      target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'start',
      });
      target.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [enrollmentIntent]);

  async function handleEnroll(stepUpChallengeId: string) {
    setEnrolling(true);
    setEnrollmentComplete(false);
    setError(null);
    setNotice(null);
    try {
      const optRes = await fetch('/api/auth/biometrics/register/options', {
        method: 'POST',
      });
      if (!optRes.ok) {
        throw new Error(
          (await optRes.json())?.error ?? 'Could not start enrolment.',
        );
      }
      const { challengeId, options } = await optRes.json();

      const registrationResponse = await startRegistration(options);

      const verifyRes = await fetch('/api/auth/biometrics/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          registrationResponse,
          label: guessDeviceLabel(),
          stepUpChallengeId,
        }),
      });
      if (!verifyRes.ok) {
        throw new Error((await verifyRes.json())?.error ?? 'Enrolment failed.');
      }

      setNotice('Biometric sign-in is set up on this device.');
      setEnrollmentComplete(true);
      await loadDevices();
      router.refresh();
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'AbortError') {
        setError('Enrolment was cancelled.');
      } else if (name === 'InvalidStateError') {
        setError('This device is already set up for biometric sign-in.');
      } else {
        setError(err instanceof Error ? err.message : 'Enrolment failed.');
      }
    } finally {
      setEnrolling(false);
    }
  }

  async function handleRemove(id: string, stepUpChallengeId: string) {
    setPendingRemove(id);
    setEnrollmentComplete(false);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/auth/biometrics/devices/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepUpChallengeId }),
      });
      if (!res.ok) {
        throw new Error(
          (await res.json())?.error ?? 'Could not remove this device.',
        );
      }

      const removed = (await res.json()) as {
        credentialId?: string | null;
        rpId?: string;
      };
      const signalResult =
        removed.credentialId && removed.rpId
          ? await signalUnknownPasskey({
              rpId: removed.rpId,
              credentialId: removed.credentialId,
            })
          : 'unsupported';

      setNotice(
        signalResult === 'signalled'
          ? 'Passkey removed. Your current password manager was notified and may hide or delete its copy.'
          : 'Passkey removed from this account. Delete it from your password manager too so it is no longer offered.',
      );
      await loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove device.');
    } finally {
      setPendingRemove(null);
    }
  }

  function handleStepUpVerified(stepUpChallengeId: string) {
    const action = pendingStepUp;
    setPendingStepUp(null);
    if (!action) return;

    if (action.kind === 'enroll') {
      void handleEnroll(stepUpChallengeId);
    } else {
      void handleRemove(action.deviceId, stepUpChallengeId);
    }
  }

  function startEdit(device: BiometricDevice) {
    setEditingId(device.id);
    setEditValue(device.label);
    setError(null);
    setNotice(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
  }

  async function handleRename(id: string) {
    const label = editValue.trim();
    if (!label) return;
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/auth/biometrics/devices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) {
        throw new Error(
          (await res.json())?.error ?? 'Could not rename this device.',
        );
      }
      setEditingId(null);
      setEditValue('');
      await loadDevices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not rename this device.',
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Protect this account across every school and role.
        </p>
      </div>
      <div
        ref={enrollmentCardRef}
        id="biometric-enrollment"
        tabIndex={-1}
        aria-labelledby="biometric-enrollment-card-title"
        className={`scroll-mt-4 rounded-[var(--radius)] outline-none transition-shadow ${
          enrollmentIntent ? 'ring-2 ring-primary/35 ring-offset-2' : ''
        }`}
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle
              id="biometric-enrollment-card-title"
              className="flex items-center gap-2 text-base"
            >
              <ShieldCheck className="size-4 text-primary" />
              Biometric sign-in
            </CardTitle>
            <CardDescription>
              Use your device&apos;s Face ID, fingerprint, or PIN to sign in
              faster — no password to type. Your biometric never leaves the
              device; the school only stores a public key. A user-verified
              passkey counts as multi-factor authentication, while password and
              recovery options remain available.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {enrollmentPolicy === 'forbid' ? (
              <p className="text-sm text-muted-foreground">
                Your school does not allow new biometric sign-in enrolment.
                Existing account recovery methods remain available.
              </p>
            ) : passkeyAvailability === 'insecure-context' ? (
              <p className="text-sm text-muted-foreground">
                Passkeys require HTTPS. Remove this Home Screen app, open this
                site over HTTPS in Safari, then add it to the Home Screen again.
              </p>
            ) : passkeyAvailability === 'unsupported' ? (
              <p className="text-sm text-muted-foreground">
                This browser doesn&apos;t expose passkey support. You can still
                set it up later from a browser with Face ID, Touch ID, Windows
                Hello, or Android biometrics.
              </p>
            ) : (
              <div>
                <Button
                  onClick={() => setPendingStepUp({ kind: 'enroll' })}
                  disabled={enrolling || passkeyAvailability === null}
                >
                  <Fingerprint className="size-4" />
                  {enrolling
                    ? 'Waiting for device…'
                    : 'Set up biometric sign-in'}
                </Button>
                {biometricEnrollment.policy === 'require' ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {biometricEnrollment.requiredBy.length === 1
                      ? `Required by ${biometricEnrollment.requiredBy[0]?.schoolName}.`
                      : biometricEnrollment.requiredBy.length > 1
                        ? `Required by ${biometricEnrollment.requiredBy.length} of your schools.`
                        : 'Required by your school.'}{' '}
                    Your final passkey cannot be removed until another one is
                    enrolled.
                  </p>
                ) : null}
              </div>
            )}

            {notice ? (
              <div className="flex flex-wrap items-center gap-2" role="status">
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {notice}
                </p>
                {enrollmentComplete && returnTo ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={returnTo}>Return to previous page</Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Enrolled devices</CardTitle>
          <CardDescription>
            Devices you can use for biometric sign-in. Remove any you no longer
            use or recognise.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {devices === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="size-3 animate-spin" /> Loading…
            </p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No devices enrolled yet.
            </p>
          ) : (
            devices.map((device) => {
              const isEditing = editingId === device.id;
              return (
                <div
                  key={device.id}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3"
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
                    aria-hidden
                  >
                    <Fingerprint className="size-4" />
                  </span>

                  {isEditing ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleRename(device.id);
                      }}
                    >
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        maxLength={60}
                        autoFocus
                        aria-label="Device name"
                        className="h-8"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={savingId === device.id || !editValue.trim()}
                      >
                        <Check className="size-3" />
                        {savingId === device.id ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={savingId === device.id}
                        aria-label="Cancel rename"
                      >
                        <X className="size-3" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="flex min-w-0 flex-col">
                        <span className="break-words text-sm font-semibold text-foreground">
                          {device.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {device.provider ? `${device.provider} · ` : ''}Added{' '}
                          {formatDate(device.createdAt)} · Last used{' '}
                          {formatDate(device.lastUsedAt)}
                        </span>
                      </div>
                      <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
                        {device.backedUp ? (
                          <Badge variant="outline" className="text-xs">
                            Synced
                          </Badge>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(device)}
                          aria-label={`Rename ${device.label}`}
                        >
                          <Pencil className="size-3" />
                          Rename
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingRemove === device.id}
                          onClick={() =>
                            setPendingStepUp({
                              kind: 'remove',
                              deviceId: device.id,
                            })
                          }
                        >
                          <Trash2 className="size-3" />
                          {pendingRemove === device.id ? 'Removing…' : 'Remove'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <StepUpPrompt
        open={pendingStepUp !== null}
        operation={
          pendingStepUp?.kind === 'enroll'
            ? STEP_UP_OPERATION.BIOMETRICS_ENROLL
            : pendingStepUp?.kind === 'remove'
              ? STEP_UP_OPERATION.BIOMETRICS_REMOVE
              : null
        }
        title={
          pendingStepUp?.kind === 'remove'
            ? 'Confirm passkey removal'
            : 'Confirm biometric setup'
        }
        description={
          pendingStepUp?.kind === 'remove'
            ? 'Confirm it is you before removing this sign-in method.'
            : 'Confirm it is you before adding a new sign-in method.'
        }
        onCancel={() => setPendingStepUp(null)}
        onVerified={handleStepUpVerified}
      />
    </div>
  );
}
