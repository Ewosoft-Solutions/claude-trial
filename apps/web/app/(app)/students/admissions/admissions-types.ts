/**
 * WB3 structured-intake — shared client types for the admissions surfaces.
 */
import type { StateTone } from '@workspace/ui/types/states.types';
import type { FormDefinition } from '@workspace/forms';

export interface Guardian {
  id?: string;
  // Person-name rule: structured parts are captured/sent; `fullName` is the
  // composed display returned by the API (never sent by the editor).
  fullName?: string | null;
  title?: string | null;
  firstName: string;
  middleName?: string | null;
  surname: string;
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

/**
 * The `value` a WB3-5 fee fulfilment carries once billed: the linked Finance
 * invoice + the billed amount (kobo), and whether it has been fully paid.
 */
export interface FeeValue {
  invoiceId?: string;
  amount?: number;
  paid?: boolean;
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
  // Applicant name parts (person-name rule) — for the edit form to prefill.
  applicantTitle?: string | null;
  applicantFirstName?: string | null;
  applicantMiddleName?: string | null;
  applicantSurname?: string | null;
  stageId?: string | null;
  yearLevelId?: string | null;
  streamId?: string | null;
  campusId?: string | null;
  targetClassSectionId?: string | null;
  academicYearId?: string | null;
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
  interviews: boolean;
}

// ---- WB3-3 application form — now the generic Form engine (@workspace/forms) ----
export interface FormVersion {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  definition: FormDefinition;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

export interface FormResponse {
  id: string;
  formVersionId: string;
  version: number;
  definitionSnapshot: FormDefinition;
  answers: Record<string, unknown>;
  submittedAt: string;
}

export const FORM_STATUS_TONE: Record<string, StateTone> = {
  draft: 'warning',
  published: 'success',
  archived: 'neutral',
};

// ---- WB3-4 interviews / exams + admission quiz ----
export type InterviewKind = 'interview' | 'exam' | 'screening';
export const INTERVIEW_KINDS: InterviewKind[] = [
  'interview',
  'exam',
  'screening',
];
export const INTERVIEW_MODES = ['in_person', 'online', 'phone'] as const;
export type QuizStyle = 'mcq' | 'true_false' | 'short_answer' | 'essay';
export const QUIZ_STYLES: QuizStyle[] = [
  'mcq',
  'true_false',
  'short_answer',
  'essay',
];

export interface QuizQuestion {
  id: string;
  style: QuizStyle;
  text: string;
  options?: string[];
  correctAnswer?: string | null;
  points: number;
}

export interface QuizAnswer {
  questionId: string;
  answer: string;
}

export interface Interview {
  id: string;
  kind: InterviewKind;
  title?: string | null;
  mode: (typeof INTERVIEW_MODES)[number];
  location?: string | null;
  scheduledFor?: string | null;
  durationMinutes?: number | null;
  interviewerId?: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  outcome?: string | null;
  score?: number | null;
  maxScore?: number | null;
  notes?: string | null;
  questions?: QuizQuestion[] | null;
  answers?: QuizAnswer[] | null;
  autoMarked: boolean;
  needsManualGrading: boolean;
  completedAt?: string | null;
}

export const INTERVIEW_STATUS_TONE: Record<string, StateTone> = {
  scheduled: 'info',
  completed: 'success',
  cancelled: 'neutral',
  no_show: 'destructive',
};

export const INTERVIEW_OUTCOME_TONE: Record<string, StateTone> = {
  pass: 'success',
  fail: 'destructive',
  hold: 'warning',
};

export const MODE_LABEL: Record<string, string> = {
  in_person: 'In person',
  online: 'Online',
  phone: 'Phone',
};

export const GUARDIAN_RELATIONSHIPS = [
  'father',
  'mother',
  'guardian',
  'grandparent',
  'sibling',
  'other',
] as const;

export const GENDERS = ['male', 'female', 'other'] as const;

// Stage / decision / requirement colours + labels live in ONE place so every
// admissions surface (list, drawer, detail, and the public portal) stays in
// lock-step — see @/lib/admissions/status.
export {
  STAGE_TONE,
  STAGE_LABEL,
  REQUIREMENT_STATUS_TONE,
  COLLECT_STAGE_LABEL,
} from '@/lib/admissions/status';

// Dates are formatted with an EXPLICIT locale + timezone so the server and the
// client always produce the same string — `toLocaleDateString()` with no args
// uses the runtime's default locale/zone, which differs between the Node server
// (SSR) and the browser and hydration-mismatches (e.g. "8/6/2026" vs
// "06/08/2026"). Date-only values are read in UTC (the DB `@db.Date` is midnight
// UTC); date-times are shown in West Africa Time, the product's home zone.
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

export function fmtDateTime(date?: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Africa/Lagos',
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
