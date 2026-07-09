import type { StateTone } from '@workspace/ui/types/states.types';

export type ReviewStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | string;

export type LessonStatus = 'draft' | 'published' | 'archived' | string;
export type MaterialCategory =
  | 'document'
  | 'video'
  | 'image'
  | 'audio'
  | string;
export type ExtractionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped'
  | string;

export type QuestionStyle = 'mcq' | 'true_false' | 'short_answer' | 'essay';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | string;
export type AssessmentStatus =
  | 'draft'
  | 'published'
  | 'in_progress'
  | 'graded'
  | 'archived'
  | string;

export interface CourseSummary {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  status?: string | null;
}

export interface ClassSummary {
  id: string;
  section: string;
  name: string | null;
  capacity?: number | null;
  currentEnrollment?: number | null;
  course?: CourseSummary | null;
  term?: { id?: string; name: string } | null;
  academicYear?: { id?: string; name: string } | null;
}

export interface LessonSummary {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  content?: string | null;
  order?: number;
  status: LessonStatus;
  reviewStatus: ReviewStatus;
  reviewNote?: string | null;
  submittedForReviewAt?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  class?: ClassSummary | null;
  _count?: { materials: number };
}

export interface MaterialSummary {
  id: string;
  lessonId: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: MaterialCategory;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  reviewedAt?: string | null;
  extractionStatus: ExtractionStatus;
  extractionError: string | null;
  chunkCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionOption {
  label: string;
  text?: string;
  imageKey?: string;
}

export interface QuestionSummary {
  id: string;
  courseId: string;
  style: QuestionStyle;
  instruction: string | null;
  text: string;
  imageKey: string | null;
  options: QuestionOption[] | null;
  correctAnswer: string | null;
  solution: string | null;
  difficulty: QuestionDifficulty | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentSummary {
  id: string;
  classId: string;
  name: string;
  type: string;
  maxPoints: number | string;
  weight?: number | string | null;
  assignedDate?: string | null;
  dueDate?: string | null;
  instructions?: string | null;
  status: AssessmentStatus;
  durationMinutes?: number | null;
  maxAttempts?: number | null;
  class?: ClassSummary | null;
  term?: { id?: string; name: string } | null;
  academicYear?: { id?: string; name: string } | null;
}

export interface PaperQuestion {
  id?: string;
  assessmentId?: string;
  questionId: string;
  order: number;
  points: number | string;
  question: QuestionSummary;
}

export interface StudentPaperQuestion {
  order: number;
  points: number | string;
  question: Pick<
    QuestionSummary,
    'id' | 'style' | 'instruction' | 'text' | 'imageKey' | 'options'
  >;
}

export interface StudentPaper {
  assessment: Pick<
    AssessmentSummary,
    | 'id'
    | 'name'
    | 'type'
    | 'instructions'
    | 'dueDate'
    | 'durationMinutes'
    | 'maxAttempts'
    | 'maxPoints'
  >;
  questions: StudentPaperQuestion[];
}

export interface AssessmentSubmission {
  id: string;
  assessmentId: string;
  enrollmentId: string;
  attempt: number;
  answers: Array<{ questionId: string; answer: string }>;
  pointsEarned: number | string | null;
  maxPoints: number | string | null;
  percentage: number | string | null;
  needsManualGrading: boolean;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
  enrollment?: {
    id: string;
    student?: {
      id: string;
      studentNumber?: string | null;
      userTenant?: {
        user?: {
          firstName?: string | null;
          lastName?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
}

export interface StaffRoleAssignment {
  role: { id: string; name: string; clearanceLevel: number };
}

export interface StaffProfile {
  id: string;
  status: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  userTenantRole?: StaffRoleAssignment | StaffRoleAssignment[] | null;
}

export interface ClassTeacherAssignment {
  id: string;
  classId: string;
  userTenantId: string;
  role: string;
  isActive: boolean;
  assignedAt: string;
  unassignedAt?: string | null;
  userTenant: StaffProfile;
}

export interface Paginated<T> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const REVIEW_META: Record<string, { label: string; tone: StateTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_review: { label: 'In review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'destructive' },
};

export const LESSON_STATUS_META: Record<
  string,
  { label: string; tone: StateTone }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Published', tone: 'success' },
  archived: { label: 'Archived', tone: 'warning' },
};

export const EXTRACTION_META: Record<
  string,
  { label: string; tone: StateTone }
> = {
  pending: { label: 'Queued', tone: 'info' },
  processing: { label: 'Processing', tone: 'info' },
  completed: { label: 'Ready', tone: 'success' },
  failed: { label: 'Failed', tone: 'destructive' },
  skipped: { label: 'Stored', tone: 'neutral' },
};

export const ASSESSMENT_STATUS_META: Record<
  string,
  { label: string; tone: StateTone }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Published', tone: 'success' },
  in_progress: { label: 'In progress', tone: 'info' },
  graded: { label: 'Graded', tone: 'success' },
  archived: { label: 'Archived', tone: 'warning' },
};

export function academicsApi(path: string): string {
  return `/api/academics/${path.replace(/^\/+/, '')}`;
}

export function classLabel(cls: ClassSummary | null | undefined): string {
  if (!cls) return 'Class';
  const course = cls.course ? cls.course.name : null;
  const section = cls.name ?? `Section ${cls.section}`;
  const term = cls.term?.name ? `(${cls.term.name})` : null;
  return [course, section, term].filter(Boolean).join(' - ');
}

export function courseLabel(course: CourseSummary): string {
  return course.code ? `${course.code} - ${course.name}` : course.name;
}

export function personName(profile: StaffProfile | undefined | null): string {
  const user = profile?.user;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return name || user?.email || 'Staff member';
}

export function staffRoleAssignments(
  profile: StaffProfile | undefined | null,
): StaffRoleAssignment[] {
  const relation = profile?.userTenantRole;
  const assignments = Array.isArray(relation)
    ? relation
    : relation
      ? [relation]
      : [];

  return assignments.filter((assignment) => Boolean(assignment?.role?.name));
}

export function profileHasRole(
  profile: StaffProfile | undefined | null,
  roleName: string,
): boolean {
  const needle = roleName.trim().toLowerCase();
  if (!needle) return false;

  return staffRoleAssignments(profile).some((assignment) =>
    assignment.role.name.toLowerCase().includes(needle),
  );
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export async function readError(res: Response): Promise<string> {
  const fallback = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    const message = body.error ?? body.message;
    return Array.isArray(message) ? message.join(', ') : (message ?? fallback);
  } catch {
    return fallback;
  }
}
