/**
 * WB3 structured-intake — shared client types for the admissions surfaces.
 */
import type { StateTone } from '@workspace/ui/types/states.types';

export interface Guardian {
  id?: string;
  fullName: string;
  relationship: string;
  email?: string | null;
  address?: string | null;
  phoneCountryCode: string;
  phoneNumber: string;
  whatsappSameAsPhone: boolean;
  whatsappCountryCode?: string | null;
  whatsappNumber?: string | null;
  isPrimary: boolean;
}

export interface Requirement {
  id: string;
  requirementId: string;
  label: string;
  type: 'document' | 'field' | 'measurement' | 'fee';
  collectStage: 'application' | 'offer' | 'acceptance' | 'enrolment';
  required: boolean;
  status: 'pending' | 'provided' | 'waived';
  value?: Record<string, unknown> | null;
  documentId?: string | null;
  waivedReason?: string | null;
  providedAt?: string | null;
}

export interface Application {
  id: string;
  applicantName: string;
  applyingFor: string;
  guardianName: string;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  stage: string;
  decision: string;
  submittedDate?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  resultingStudentId?: string | null;
}

export interface StageEvent {
  id: string;
  fromStage: string | null;
  toStage: string;
  note: string | null;
  createdAt: string;
}
export interface Review {
  id: string;
  score: number | null;
  recommendation: string;
  note: string | null;
  createdAt: string;
}

export interface ApplicationDetail extends Application {
  stageId?: string | null;
  yearLevelId?: string | null;
  streamId?: string | null;
  campusId?: string | null;
  stateOfOrigin?: string | null;
  religion?: string | null;
  healthNotes?: string | null;
  notes?: string | null;
  guardians: Guardian[];
  requirements: Requirement[];
  stageEvents: StageEvent[];
  reviews: Review[];
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

export interface SectionOption {
  id: string;
  displayLabel: string;
}
export interface YearOption {
  id: string;
  name: string;
}

export interface Perms {
  create: boolean;
  review: boolean;
  approve: boolean;
  reject: boolean;
  convert: boolean;
  documents: boolean;
  criteria: boolean;
}

export const GUARDIAN_RELATIONSHIPS = [
  'father',
  'mother',
  'guardian',
  'grandparent',
  'sibling',
  'other',
] as const;

export const GENDERS = ['male', 'female', 'other'] as const;

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
  application: 'At application',
  offer: 'On offer',
  acceptance: 'On acceptance',
  enrolment: 'On enrolment',
};

export function fmtDate(date?: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
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

/** Read a File as a base64 string (no data: prefix) for the JSON upload body. */
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
