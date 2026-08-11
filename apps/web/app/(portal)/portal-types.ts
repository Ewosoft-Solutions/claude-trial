/**
 * Self-contained shapes + helpers for the public applicant portal. Kept
 * separate from the internal `(app)` admissions types so the public surface has
 * no coupling to the authed app — the public API returns exactly these shapes.
 */
import type { StateTone } from '@workspace/ui/types/states.types';

export type FormFieldType =
  | 'text'
  | 'paragraph'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'boolean';

export interface FormFieldDef {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  help?: string;
  placeholder?: string;
}

export interface IntakeStructure {
  campuses: { id: string; name: string; code: string }[];
  stages: { id: string; name: string; code: string; order: number }[];
  yearLevels: {
    id: string;
    name: string;
    code: string;
    order: number;
    stageId: string;
  }[];
  streams: { id: string; name: string; code: string }[];
}

export interface Intake {
  school: { name: string; slug: string; schoolType: string };
  structure: IntakeStructure;
  form: {
    id: string;
    title: string;
    version: number;
    fields: FormFieldDef[];
  } | null;
}

export interface Guardian {
  fullName: string;
  relationship: string;
  email: string;
  address: string;
  phoneCountryCode: string;
  phoneNumber: string;
  whatsappSameAsPhone: boolean;
  whatsappCountryCode: string;
  whatsappNumber: string;
  isPrimary: boolean;
}

export interface StatusRequirement {
  id: string;
  label: string;
  type: string;
  collectStage: string;
  required: boolean;
  status: string;
  hasDocument: boolean;
}

export interface StatusView {
  reference: string;
  applicantName: string;
  applyingFor: string;
  stage: string;
  decision: string;
  submittedDate: string | null;
  offeredAt: string | null;
  requirements: StatusRequirement[];
  stageHistory: { toStage: string; createdAt: string }[];
}

export const GENDERS = ['male', 'female', 'other'] as const;
export const GUARDIAN_RELATIONSHIPS = [
  'father',
  'mother',
  'guardian',
  'grandparent',
  'sibling',
  'other',
] as const;

export const STAGE_TONE: Record<string, StateTone> = {
  enquiry: 'neutral',
  applied: 'info',
  screening: 'info',
  interview: 'info',
  offer: 'warning',
  accepted: 'success',
  enrolled: 'success',
  rejected: 'destructive',
  withdrawn: 'neutral',
};

export const REQUIREMENT_STATUS_TONE: Record<string, StateTone> = {
  pending: 'warning',
  provided: 'success',
  waived: 'neutral',
};

export const COLLECT_STAGE_LABEL: Record<string, string> = {
  application: 'Now',
  offer: 'After an offer',
  acceptance: 'On acceptance',
  enrolment: 'On enrolment',
};

/** Applicant-friendly stage descriptions for the status timeline. */
export const STAGE_STEP_LABEL: Record<string, string> = {
  applied: 'Application received',
  screening: 'Under review',
  interview: 'Assessment / interview',
  offer: 'Offer made',
  accepted: 'Offer accepted',
  enrolled: 'Enrolled',
  rejected: 'Not successful',
  withdrawn: 'Withdrawn',
};

export function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Hydration-safe (explicit locale + UTC) — matches the internal fmtDate.
export function fmtDate(date?: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
}

export async function errorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await res.json()) as {
      message?: string | string[];
      error?: string;
    };
    const m = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message;
    return m || data.error || fallback;
  } catch {
    return fallback;
  }
}

/** Read a File as base64 (no data: prefix) for the JSON upload body. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
