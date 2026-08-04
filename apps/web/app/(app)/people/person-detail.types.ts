/**
 * The enriched per-person detail shape (mirrors the API `PersonDetail` from
 * apps/api/src/directory/services/people-directory.service.ts). Shared by the
 * detail drawer and the /people/[id] profile tabs.
 */
import type { PeopleType } from './people-config';

export type ProfileKind = 'student' | 'guardian' | 'staff' | 'user';

export interface PersonRelation {
  id: string;
  name: string;
  relationship: string;
  isPrimary: boolean;
}

export interface PersonAddress {
  kind: string;
  line1: string;
  line2: string | null;
  city: string | null;
  subdivision: string | null;
  subdivisionLga: string | null;
  country: string;
  isPrimary: boolean;
}

export interface PersonContactPoint {
  kind: string;
  value: string;
  label: string | null;
  isPrimary: boolean;
  verified: boolean;
}

export interface PersonContactPreference {
  channel: string;
  optedIn: boolean;
  isDnd: boolean;
}

export interface PersonTimelineStep {
  key: string;
  label: string;
  date: string | null;
  state: 'done' | 'current' | 'pending';
  detail: string | null;
}

export interface PersonFlags {
  hasSiblings?: boolean;
  feesOverdue?: boolean;
  attendanceRisk?: boolean;
  newAdmission?: boolean;
  onLeave?: boolean;
  siblingEnrolled?: boolean;
}

export interface AcademicsSummary {
  attendancePercent: number | null;
  averageGradePercent: number | null;
  currentClasses: {
    id: string;
    name: string;
    term: string | null;
    status: string;
    finalGrade: string | null;
  }[];
}

export interface FinanceSummary {
  balance: number;
  totalDue: number;
  totalPaid: number;
  overdueCount: number;
  nextDueDate: string | null;
}

export interface DocumentsSummary {
  count: number;
  recent: {
    id: string;
    title: string;
    type: string | null;
    scanStatus: string;
    createdAt: string;
  }[];
}

export interface PersonDetail {
  id: string;
  type: PeopleType;
  name: string;
  preferredName: string | null;
  profiles: ProfileKind[];
  studentId: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  stateOfOrigin: string | null;
  lgaOfOrigin: string | null;
  addresses: PersonAddress[];
  email: string | null;
  phone: string | null;
  contactMasked: boolean;
  contactPoints: PersonContactPoint[];
  contactPreferences: PersonContactPreference[];
  timeline: PersonTimelineStep[];
  flags: PersonFlags;
  student: {
    studentNumber: string | null;
    gradeLevel: string | null;
    enrollmentStatus: string | null;
    admissionDate: string | null;
    guardians: PersonRelation[];
    siblings: PersonRelation[];
  } | null;
  staff:
    | {
        employeeNumber: string | null;
        jobTitle: string | null;
        department: string | null;
        employmentStatus: string;
        employmentType: string | null;
        hireDate: string | null;
      }[]
    | null;
  wards: PersonRelation[] | null;
  account: {
    status: string;
    email: string | null;
    role: string | null;
    lastLoginAt: string | null;
  } | null;
  prospect: {
    applyingFor: string;
    guardianName: string;
    stage: string;
    decision: string | null;
    submittedDate: string | null;
  } | null;
  academics: AcademicsSummary | null;
  finance: FinanceSummary | null;
  documents: DocumentsSummary | null;
}

/** Which tabs a person's detail can show, given their data + the caller's perms. */
export const DETAIL_TABS = [
  'overview',
  'people',
  'academics',
  'finance',
  'documents',
] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];

const TAB_LABELS: Record<DetailTab, string> = {
  overview: 'Overview',
  people: 'People',
  academics: 'Academics',
  finance: 'Finance',
  documents: 'Documents',
};

export function tabLabel(tab: DetailTab): string {
  return TAB_LABELS[tab];
}

/**
 * The tabs to show for a given detail payload: Overview always; People when
 * there are guardians/wards/siblings; Academics/Finance/Documents when the
 * server included that (permission + applicability-gated) roll-up.
 */
export function availableTabs(detail: PersonDetail): DetailTab[] {
  const tabs: DetailTab[] = ['overview'];
  const hasPeople =
    (detail.student?.guardians.length ?? 0) > 0 ||
    (detail.student?.siblings.length ?? 0) > 0 ||
    (detail.wards?.length ?? 0) > 0;
  // Students and guardians always get the People tab so guardianships can be
  // managed even before the first relationship exists (WB1-4).
  const guardianshipRelevant =
    detail.profiles.includes('student') || detail.profiles.includes('guardian');
  if (hasPeople || guardianshipRelevant) tabs.push('people');
  if (detail.academics) tabs.push('academics');
  if (detail.finance) tabs.push('finance');
  if (detail.documents && detail.documents.count > 0) tabs.push('documents');
  return tabs;
}

export function humanize(value: string): string {
  const s = value.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Caregiver relationships are DIRECTIONAL. The value stored on a
 * GuardianRelationship is always the GUARDIAN's kinship to the ward
 * (e.g. 'parent' = "the guardian is the ward's parent"). So the SAME value must
 * be labelled differently depending on whose page you're on:
 *   • on a ward's page, listing their guardians → the guardian's role ("Parent")
 *   • on a guardian's page, listing their wards  → the ward's role, i.e. the
 *     INVERSE ("Child") — otherwise "Amara · Parent" reads as if Amara is the
 *     parent, not Multi.
 * `label` is the guardian-side term (also the dropdown option); `wardLabel` is
 * the inverse, ward-side term. Keep `value`s in step with RELATIONSHIP_TYPES in
 * apps/api/src/person/dto/guardianship.dto.ts.
 */
export const GUARDIAN_RELATIONSHIPS: {
  value: string;
  label: string;
  wardLabel: string;
}[] = [
  { value: 'mother', label: 'Mother', wardLabel: 'Child' },
  { value: 'father', label: 'Father', wardLabel: 'Child' },
  { value: 'parent', label: 'Parent', wardLabel: 'Child' },
  { value: 'step_parent', label: 'Step-parent', wardLabel: 'Stepchild' },
  { value: 'grandparent', label: 'Grandparent', wardLabel: 'Grandchild' },
  { value: 'sibling', label: 'Sibling', wardLabel: 'Sibling' },
  { value: 'aunt_uncle', label: 'Aunt / uncle', wardLabel: 'Niece / nephew' },
  { value: 'cousin', label: 'Cousin', wardLabel: 'Cousin' },
  { value: 'guardian', label: 'Guardian', wardLabel: 'Ward' },
  { value: 'caregiver', label: 'Caregiver', wardLabel: 'Dependent' },
  { value: 'foster_parent', label: 'Foster parent', wardLabel: 'Foster child' },
  { value: 'other_relative', label: 'Other relative', wardLabel: 'Relative' },
  { value: 'other', label: 'Other', wardLabel: 'Dependent' },
];

const RELATIONSHIP_BY_VALUE = new Map(
  GUARDIAN_RELATIONSHIPS.map((r) => [r.value, r]),
);

/** The GUARDIAN's role toward the ward (e.g. 'parent' → 'Parent'). */
export function guardianRoleLabel(value: string): string {
  return RELATIONSHIP_BY_VALUE.get(value)?.label ?? humanize(value);
}

/** The WARD's role toward the guardian — the inverse (e.g. 'parent' → 'Child').
 *  Unknown kinships fall back to 'Ward' (they are, after all, a ward). */
export function wardRoleLabel(value: string): string {
  return RELATIONSHIP_BY_VALUE.get(value)?.wardLabel ?? 'Ward';
}

export function initials(name: string): string {
  return (
    name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/** Minor units (kobo) → naira string, e.g. 123456 → "₦1,234.56". */
export function formatMinor(minor: number): string {
  const naira = minor / 100;
  return `₦${naira.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ageFrom(iso: string | null): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

const PROFILE_LABELS: Record<ProfileKind, string> = {
  student: 'Student',
  guardian: 'Guardian',
  staff: 'Staff',
  user: 'User',
};

export function profileLabel(kind: ProfileKind): string {
  return PROFILE_LABELS[kind];
}

/** A one-line role summary for the header subtitle. */
export function profileSubtitle(detail: PersonDetail): string {
  if (detail.type === 'prospect' && detail.prospect) {
    return `Prospect · applying for ${detail.prospect.applyingFor}`;
  }
  if (detail.student?.gradeLevel) {
    return `Student · ${detail.student.gradeLevel}`;
  }
  if (detail.staff?.[0]?.jobTitle) return `Staff · ${detail.staff[0].jobTitle}`;
  if (detail.wards && detail.wards.length > 0) {
    return `Guardian · ${detail.wards.length} ward${detail.wards.length === 1 ? '' : 's'}`;
  }
  return detail.profiles.length > 0 ? 'Person' : 'No roles yet';
}
