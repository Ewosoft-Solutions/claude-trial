'use client';

import * as React from 'react';
import {
  Fingerprint,
  KeyRound,
  LifeBuoy,
  Loader2,
  Smartphone,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/components/drawer';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';

import type { StepUpOperation, StepUpOptionsResponse } from '@/lib/step-up';
import { startAuthentication } from '@/lib/webauthn';

interface StepUpPromptProps {
  open: boolean;
  operation: StepUpOperation | null;
  title: string;
  description: string;
  onCancel: () => void;
  onVerified: (challengeId: string) => void;
}

async function responseError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return body.error ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function StepUpPrompt({
  open,
  operation,
  title,
  description,
  onCancel,
  onVerified,
}: StepUpPromptProps) {
  const [options, setOptions] = React.useState<StepUpOptionsResponse | null>(
    null,
  );
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [totpCode, setTotpCode] = React.useState('');
  const [recoveryCode, setRecoveryCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const onVerifiedRef = React.useRef(onVerified);

  React.useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  React.useEffect(() => {
    if (!open || !operation) return;

    const controller = new AbortController();
    setOptions(null);
    setPassword('');
    setTotpCode('');
    setRecoveryCode('');
    setError(null);
    setLoadingOptions(true);

    void fetch('/api/auth/step-up/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseError(
              response,
              'Could not prepare identity confirmation.',
            ),
          );
        }
        const nextOptions = (await response.json()) as StepUpOptionsResponse;
        if (!nextOptions.required) {
          onVerifiedRef.current('');
          return;
        }
        setOptions(nextOptions);
      })
      .catch((cause: unknown) => {
        if ((cause as { name?: string })?.name !== 'AbortError') {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not prepare identity confirmation.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingOptions(false);
      });

    return () => controller.abort();
  }, [open, operation]);

  async function verifyFactor(payload: Record<string, unknown>) {
    if (!operation) return;
    const response = await fetch('/api/auth/step-up/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, ...payload }),
    });
    if (!response.ok) {
      throw new Error(
        await responseError(response, 'Identity confirmation failed.'),
      );
    }
    const result = (await response.json()) as { challengeId: string };
    onVerified(result.challengeId);
  }

  function verifyWithPasskey() {
    if (!operation || !options?.hasPasskey || !options.options) return;
    const authenticationOptions = options.options;
    const challengeId = options.challengeId;

    startTransition(async () => {
      setError(null);
      try {
        const webauthnResponse = await startAuthentication(
          authenticationOptions,
        );
        await verifyFactor({
          challengeId,
          webauthnResponse,
        });
      } catch (cause) {
        const name = (cause as { name?: string })?.name;
        setError(
          name === 'NotAllowedError' || name === 'AbortError'
            ? 'Passkey confirmation was cancelled. You can try again or use your password.'
            : cause instanceof Error
              ? cause.message
              : 'Identity confirmation failed.',
        );
      }
    });
  }

  function verifyWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operation || !password) return;

    startTransition(async () => {
      setError(null);
      try {
        await verifyFactor({ password });
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Identity confirmation failed.',
        );
      }
    });
  }

  function verifyWithCode(
    event: React.FormEvent<HTMLFormElement>,
    factor: 'totpCode' | 'recoveryCode',
  ) {
    event.preventDefault();
    const value = factor === 'totpCode' ? totpCode : recoveryCode;
    if (!operation || !value) return;
    startTransition(async () => {
      setError(null);
      try {
        await verifyFactor({ [factor]: value });
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Identity confirmation failed.',
        );
      }
    });
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-5 px-4 pb-2">
          {loadingOptions ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Preparing secure
              confirmation…
            </p>
          ) : options?.hasPasskey ? (
            <Button
              type="button"
              className="w-full"
              disabled={isPending}
              onClick={verifyWithPasskey}
            >
              <Fingerprint className="size-4" />
              {isPending ? 'Confirming…' : 'Confirm with passkey'}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              No built-in passkey is available for this account on this device.
              Use another confirmation method below.
            </p>
          )}

          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              or use another method
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {options?.methods.totp ? (
            <form
              className="space-y-3"
              onSubmit={(event) => verifyWithCode(event, 'totpCode')}
            >
              <div className="space-y-2">
                <Label htmlFor="step-up-totp">Authenticator code</Label>
                <Input
                  id="step-up-totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  onChange={(event) =>
                    setTotpCode(event.target.value.replace(/\D/g, ''))
                  }
                  disabled={isPending}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={isPending || totpCode.length !== 6}
              >
                <Smartphone className="size-4" /> Confirm with authenticator
              </Button>
            </form>
          ) : null}

          {options?.methods.recoveryCode ? (
            <form
              className="space-y-3"
              onSubmit={(event) => verifyWithCode(event, 'recoveryCode')}
            >
              <div className="space-y-2">
                <Label htmlFor="step-up-recovery">Recovery code</Label>
                <Input
                  id="step-up-recovery"
                  autoComplete="one-time-code"
                  value={recoveryCode}
                  onChange={(event) => setRecoveryCode(event.target.value)}
                  disabled={isPending}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={isPending || recoveryCode.length < 8}
              >
                <LifeBuoy className="size-4" /> Use a recovery code
              </Button>
            </form>
          ) : null}

          {options?.methods.password ? (
            <form className="space-y-3" onSubmit={verifyWithPassword}>
              <div className="space-y-2">
                <Label htmlFor="step-up-password">Current password</Label>
                <Input
                  id="step-up-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isPending}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={isPending || !password}
              >
                <KeyRound className="size-4" />
                {isPending ? 'Confirming…' : 'Confirm with password'}
              </Button>
            </form>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DrawerFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
