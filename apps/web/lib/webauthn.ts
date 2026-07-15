/**
 * Minimal WebAuthn browser client for platform-authenticator (passkey /
 * Face ID / Touch ID / Windows Hello) enrolment.
 *
 * Handles the base64url <-> ArrayBuffer conversions the @simplewebauthn/server
 * backend expects, without adding a client dependency. The returned shape
 * matches @simplewebauthn/browser's `startRegistration`, so it can be swapped
 * for that package later with no backend change.
 */

/** True when the browser exposes the WebAuthn API at all. */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined'
  );
}

/**
 * True when the device has a usable built-in biometric/PIN authenticator
 * (Face ID, Touch ID, Windows Hello, Android). Gates the enrolment UI.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
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

/** Best-effort friendly label for a newly enrolled device, from the UA string. */
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
