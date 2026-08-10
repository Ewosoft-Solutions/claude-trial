/* ============================================================
   humanize — turn machine identifiers into human-readable text

   Nothing user-facing should read like a database key. Permissions already
   carry a curated `label`/`description` in the DB, so those are shown directly;
   this handles the identifiers that DON'T (settings keys like `analyticsEnabled`,
   audit event types like `sensitive_operation`, actions like `step_up_verified`,
   and the keys inside a before/after change diff).

   `humanizeToken` is the generic fallback (snake/camel/dot/kebab → "Title
   Case"); the exported helpers prefer a curated dictionary and fall back to it,
   so a term we haven't catalogued still reads reasonably.
   ============================================================ */

/** Short tokens that should stay fully upper-cased when they are a whole word. */
const ACRONYMS = new Set([
  'ai',
  'id',
  'ip',
  'url',
  'api',
  'sms',
  'pdf',
  'csv',
  'xlsx',
  'ui',
  'sso',
  'mfa',
  'totp',
  'pii',
  'rls',
  'byok',
]);

/** `snake_case` / `camelCase` / `dot.case` / `kebab-case` → "Title Case". */
export function humanizeToken(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[._-]+/g, ' ') // separators → space
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // split camelCase
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** Render a setting/change value for display (booleans read as On/Off). */
export function humanizeValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/** Tenant settings/config keys (maker-checker diffs, feature toggles). */
const SETTINGS_KEY_LABELS: Record<string, string> = {
  analyticsEnabled: 'Analytics Enabled',
  aiProvider: 'AI Provider',
  aiModel: 'AI Model',
  keyLast4: 'API Key (last 4)',
  biometricEnrollmentPolicy: 'Biometric Enrolment Policy',
};

export function humanizeSettingKey(key: string): string {
  return SETTINGS_KEY_LABELS[key] ?? humanizeToken(key);
}

/** Audit `eventType` values. */
const AUDIT_EVENT_LABELS: Record<string, string> = {
  user_action: 'User Action',
  data_change: 'Data Change',
  security_event: 'Security Event',
  system_event: 'System Event',
  authentication: 'Authentication',
  authorization: 'Authorization',
  auth_context: 'Auth Context',
  session: 'Session',
  sensitive_operation: 'Sensitive Operation',
  custom: 'Other',
};

export function humanizeAuditEvent(
  eventType: string | null | undefined,
): string {
  if (!eventType) return 'Event';
  return AUDIT_EVENT_LABELS[eventType] ?? humanizeToken(eventType);
}

/** Audit `action` values (the verb). */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: 'Signed in',
  logout: 'Signed out',
  select_school: 'Switched school',
  step_up_verified: 'Step-up verified',
  session_rotated: 'Session rotated',
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  assign_role: 'Assigned role',
  grant_permission: 'Granted permission',
};

export function humanizeAuditAction(action: string | null | undefined): string {
  if (!action) return 'recorded an event';
  return AUDIT_ACTION_LABELS[action] ?? humanizeToken(action);
}
