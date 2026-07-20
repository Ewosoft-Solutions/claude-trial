/**
 * Minimal WebAuthn browser client for platform-authenticator (passkey /
 * Face ID / Touch ID / Windows Hello) enrolment.
 *
 * Handles the base64url <-> ArrayBuffer conversions the @simplewebauthn/server
 * backend expects, without adding a client dependency. The returned shape
 * matches @simplewebauthn/browser's `startRegistration`, so it can be swapped
 * for that package later with no backend change.
 */

export type PasskeyAvailability =
  | 'available'
  | 'insecure-context'
  | 'unsupported';

export type PasskeySignalResult = 'signalled' | 'unsupported' | 'failed';

/** Explain why an explicit passkey ceremony can or cannot be offered. */
export function getPasskeyAvailability(): PasskeyAvailability {
  if (typeof window === 'undefined') return 'unsupported';
  if (window.isSecureContext === false) return 'insecure-context';
  return typeof window.PublicKeyCredential !== 'undefined'
    ? 'available'
    : 'unsupported';
}

/** True when this secure browser context exposes the WebAuthn API. */
export function isWebAuthnSupported(): boolean {
  return getPasskeyAvailability() === 'available';
}

/**
 * True when it is reasonable to offer an explicit passkey action.
 *
 * Do not gate an explicit user-triggered ceremony on
 * `isUserVerifyingPlatformAuthenticatorAvailable()`: iOS standalone web apps
 * can return a false negative for that advisory probe even though WebAuthn is
 * exposed and the passkey ceremony can use Face ID. The ceremony itself is the
 * authoritative availability check and its errors are handled by the caller.
 */
export function canAttemptPasskey(): boolean {
  return getPasskeyAvailability() === 'available';
}

/**
 * Tell the password manager in this browser that the relying party no longer
 * recognises a passkey. WebAuthn signals are advisory: a supporting provider
 * may hide or delete its copy, while unsupported providers require manual
 * cleanup. Provider failures must never undo the server-side revocation.
 */
export async function signalUnknownPasskey({
  rpId,
  credentialId,
}: {
  rpId: string;
  credentialId: string;
}): Promise<PasskeySignalResult> {
  if (getPasskeyAvailability() !== 'available') return 'unsupported';

  const pkc = window.PublicKeyCredential as unknown as {
    signalUnknownCredential?: (options: {
      rpId: string;
      credentialId: string;
    }) => Promise<undefined>;
  };

  if (typeof pkc.signalUnknownCredential !== 'function') {
    return 'unsupported';
  }

  try {
    await pkc.signalUnknownCredential({ rpId, credentialId });
    return 'signalled';
  } catch {
    return 'failed';
  }
}

/**
 * Advisory platform-authenticator capability probe.
 *
 * This can be useful for passive UI hints, but must not hard-gate an explicit
 * passkey action because some standalone iOS web apps return false negatives.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * True when the browser supports conditional mediation ("passkey autofill") —
 * i.e. offering discoverable passkeys inline on the sign-in fields.
 */
export async function isConditionalMediationAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    const pkc = window.PublicKeyCredential as unknown as {
      isConditionalMediationAvailable?: () => Promise<boolean>;
    };
    return (
      typeof pkc.isConditionalMediationAvailable === 'function' &&
      (await pkc.isConditionalMediationAvailable())
    );
  } catch {
    return false;
  }
}

function base64urlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (base64.length % 4)) % 4;
  const binary = atob(base64 + '='.repeat(pad));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Registration options as produced by the backend (base64url-encoded fields). */
export interface RegistrationOptionsJSON {
  challenge: string;
  user: { id: string; name: string; displayName: string };
  excludeCredentials?: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
  [key: string]: unknown;
}

/** Serialized attestation response, ready to POST back for verification. */
export interface RegistrationResponseJSON {
  id: string;
  rawId: string;
  type: string;
  response: {
    attestationObject: string;
    clientDataJSON: string;
    transports: string[];
  };
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  authenticatorAttachment?: string;
}

/**
 * Run the browser credential-creation ceremony for a platform authenticator
 * and serialize the result for the backend verifier.
 *
 * Throws `NotAllowedError`/`AbortError` when the user cancels the biometric
 * prompt — callers should treat those as a benign cancellation.
 */
export async function startRegistration(
  options: RegistrationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: base64urlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64urlToBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials ?? []).map((c) => ({
      id: base64urlToBuffer(c.id),
      type: c.type as PublicKeyCredentialType,
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
  };

  const credential = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Registration was cancelled');
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  const transports =
    typeof response.getTransports === 'function'
      ? response.getTransports()
      : [];

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bufferToBase64url(response.attestationObject),
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      transports,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
  };
}

/** Authentication options from the backend (base64url-encoded fields). */
export interface AuthenticationOptionsJSON {
  challenge: string;
  allowCredentials?: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
  [key: string]: unknown;
}

/** Serialized assertion, ready to POST back to complete login. */
export interface AuthenticationResponseJSON {
  id: string;
  rawId: string;
  type: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle?: string;
  };
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  authenticatorAttachment?: string;
}

/**
 * Run the browser assertion ceremony (`navigator.credentials.get`) for
 * passwordless login and serialize the result for the backend verifier.
 *
 * Throws `NotAllowedError`/`AbortError` if the user cancels the biometric
 * prompt — callers should treat those as a benign cancellation.
 */
export async function startAuthentication(
  options: AuthenticationOptionsJSON,
  {
    conditional = false,
    signal,
  }: { conditional?: boolean; signal?: AbortSignal } = {},
): Promise<AuthenticationResponseJSON> {
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...(options as unknown as PublicKeyCredentialRequestOptions),
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials ?? []).map((c) => ({
      id: base64urlToBuffer(c.id),
      type: c.type as PublicKeyCredentialType,
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
  };

  const credential = (await navigator.credentials.get({
    publicKey,
    ...(conditional
      ? { mediation: 'conditional' as CredentialMediationRequirement }
      : {}),
    ...(signal ? { signal } : {}),
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Authentication was cancelled');
  }

  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bufferToBase64url(response.authenticatorData),
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle
        ? bufferToBase64url(response.userHandle)
        : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
  };
}

/**
 * A best-guess, platform-appropriate name for the device's biometric unlock,
 * for button copy ("Sign in with Face ID").
 *
 * WebAuthn deliberately does NOT expose the actual modality (Face ID vs Touch ID
 * vs fingerprint) or which methods are configured, so this is inferred from the
 * platform — the OS's own prompt shows the true sensor regardless. "Windows
 * Hello" is the umbrella term that already covers face/fingerprint/PIN together.
 */
export function platformPasskeyLabel(): string {
  if (typeof navigator === 'undefined') return 'your device';
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'Face ID';
  if (/iPad/.test(ua)) return 'Touch ID';
  if (/Macintosh/.test(ua)) return 'Touch ID';
  if (/Android/.test(ua)) return 'your fingerprint';
  if (/Windows/.test(ua)) return 'Windows Hello';
  return 'your device';
}

/**
 * Best-effort friendly default label for a newly enrolled device, by device
 * type only (e.g. "iPhone", "Mac") — deliberately not the browser, since the
 * passkey is really the device's and the provider line already distinguishes
 * e.g. iCloud Keychain vs Google Password Manager. WebAuthn can't reveal the
 * exact model (iPhone 16 Pro Max) or biometric type (Face ID vs fingerprint),
 * so the user can rename it to whatever's meaningful.
 */
export function guessDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android device';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows device';
  return 'This device';
}
