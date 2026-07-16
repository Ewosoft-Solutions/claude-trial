/**
 * AAGUID → passkey-provider name.
 *
 * The AAGUID identifies the authenticator *model/provider* (e.g. "iCloud
 * Keychain", "Google Password Manager", "Windows Hello", "1Password") — NOT the
 * hardware model and NOT the biometric modality. WebAuthn deliberately does not
 * expose the device model (iPhone 16 Pro Max) or whether Face ID vs Touch ID
 * was used; that's privacy-by-design. Provider + synced/device-bound + a
 * user-chosen nickname is the standard set of info a passkey manager shows.
 *
 * Curated subset of the public FIDO MDS / community AAGUID list. Unknown or
 * all-zero AAGUIDs (some authenticators zero it under `attestation: 'none'`)
 * simply return undefined, and the UI falls back to the device label.
 */

const AAGUID_PROVIDERS: Record<string, string> = {
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain (Managed)',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  'b93fd961-f2e6-462f-b122-82002247de78': 'Android Credential Manager',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
  'b84e4048-15dc-4dd0-8640-f4f60813c8af': 'NordPass',
  '0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6': 'Keeper',
  'f3809540-7f14-49c1-a8b3-8f813b225541': 'Enpass',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '891494da-2c90-4d31-a9cd-4eab0aed1309': 'Sesame',
};

/**
 * Resolve a friendly passkey-provider name from an AAGUID, or undefined when
 * it's unknown, empty, or the all-zero placeholder.
 */
export function providerFromAaguid(
  aaguid: string | null | undefined,
): string | undefined {
  if (!aaguid) return undefined;
  // All-zero AAGUID (dashes + zeros only) is the privacy placeholder.
  if (aaguid.replace(/[0-]/g, '') === '') return undefined;
  return AAGUID_PROVIDERS[aaguid.toLowerCase()];
}
