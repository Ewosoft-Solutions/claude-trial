'use client';

/* ============================================================
   /account/security — biometric sign-in (passkeys)

   Opt-in enrolment of a platform authenticator (Face ID / Touch ID /
   Windows Hello / Android) for faster sign-in, plus management of the
   devices already enrolled. Enrolment runs the WebAuthn credential-
   creation ceremony in the browser (lib/webauthn) and posts the result
   to the biometrics API. The "Set up" affordance only appears when the
   device actually exposes a platform authenticator.

   Removing a device is a security-sensitive action; in a later phase it
   will require step-up re-verification (see docs/biometrics-plan.md §4C).
   ============================================================ */

import * as React from 'react';
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
  guessDeviceLabel,
  isPlatformAuthenticatorAvailable,
  startRegistration,
} from '@/lib/webauthn';

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

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SecuritySettingsPage() {
  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [devices, setDevices] = React.useState<BiometricDevice[] | null>(null);
  const [enrolling, setEnrolling] = React.useState(false);
  const [pendingRemove, setPendingRemove] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const loadDevices = React.useCallback(async () => {
    try {
      const res = await fetch('/api/auth/biometrics/devices');
      setDevices(res.ok ? await res.json() : []);
    } catch {
      setDevices([]);
    }
  }, []);

  React.useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setSupported);
    void loadDevices();
  }, [loadDevices]);

  async function handleEnroll() {
    setEnrolling(true);
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
        }),
      });
      if (!verifyRes.ok) {
        throw new Error((await verifyRes.json())?.error ?? 'Enrolment failed.');
      }

      setNotice('Biometric sign-in is set up on this device.');
      await loadDevices();
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

  async function handleRemove(id: string) {
    setPendingRemove(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/auth/biometrics/devices/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(
          (await res.json())?.error ?? 'Could not remove this device.',
        );
      }
      await loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove device.');
    } finally {
      setPendingRemove(null);
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
      setError(err instanceof Error ? err.message : 'Could not rename this device.');
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
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" />
            Biometric sign-in
          </CardTitle>
          <CardDescription>
            Use your device&apos;s Face ID, fingerprint, or PIN to sign in
            faster — no password to type. Your biometric never leaves the
            device; the school only stores a public key. This is optional and
            doesn&apos;t replace multi-factor authentication if your school
            requires it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {supported === false ? (
            <p className="text-sm text-muted-foreground">
              This device or browser doesn&apos;t support biometric sign-in. You
              can still set it up later from a device with Face ID, Touch ID,
              Windows Hello, or Android biometrics.
            </p>
          ) : (
            <div>
              <Button
                onClick={handleEnroll}
                disabled={enrolling || supported === null}
              >
                <Fingerprint className="size-4" />
                {enrolling ? 'Waiting for device…' : 'Set up biometric sign-in'}
              </Button>
            </div>
          )}

          {notice ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {notice}
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

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
                          onClick={() => handleRemove(device.id)}
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
    </div>
  );
}
