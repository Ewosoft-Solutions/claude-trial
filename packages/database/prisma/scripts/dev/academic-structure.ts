/**
 * Dev academic-STRUCTURE seed (WB2-1 · ADR-02 + WB2-2 enrollment).
 *
 * Run after the persona + academic-workflow seeds:
 *   1. pnpm --filter @workspace/database db:seed
 *   2. pnpm --filter @workspace/database db:seed:dev        (personas: tenants, users, roles)
 *   3. pnpm --filter @workspace/database db:seed:academics  (students, academic years)
 *   4. pnpm --filter @workspace/database db:seed:structure   ← this file
 * (all four run together via `db:seed:dev:full`).
 *
 * Builds the ADR-02 dimensional model — campus · stage · year · stream · section
 * + subject offerings — and the WB2-2 flow that hangs off it (teacher→offering
 * assignments, section enrollments / course registrations / electives, and the
 * tenant's AcademicProfile). It also seeds a minimal F6 curriculum chain per
 * tenant to back the offerings (curriculum_subject_id is a soft ref).
 *
 * Two tenants, matching their real school type:
 *   • greenfield-secondary — TWO campuses, junior (unstreamed) + senior (streamed
 *     Science/Arts) year levels, a 'class' model at Main and a 'course' model at
 *     the Lakeside Annex, plus a CAMPUS-SCOPED registrar persona
 *     (registrar@greenfield.test, scope = Main Campus) that exercises WB1-6.
 *   • sunrise-primary — one campus, Primary year levels (no streams), 'class'.
 *
 * Idempotent: every entity is find-then-create keyed on its natural key, so a
 * re-run is a no-op. Degrades gracefully — if a student / teacher a row refers
 * to is missing (academics seed not run), that row is skipped with a warning;
 * campuses / structure / offerings never depend on it.
 */
import { Prisma } from '@workspace/database';
import { prisma } from '../../../src/singleton.js';
import bcrypt from 'bcrypt';
import { assertDevSeedAllowed } from './guard.js';

const DEV_PASSWORD = 'DevPassword@2025!';
const CREATED_BY = 'dev-seed:structure';
const CURRICULUM_VERSION_LABEL = '2026';

// ------------------------------ config ------------------------------------

type EnrollmentModel = 'class' | 'course';

interface SeedTenant {
  slug: string;
  teacherEmail: string;
  academicYearName: string;
  registrar?: {
    email: string;
    firstName: string;
    lastName: string;
    campusCode: string;
  };
  campuses: { code: string; name: string; isPrimary?: boolean }[];
  stages: { code: string; name: string; order: number }[];
  yearLevels: { code: string; name: string; stageCode: string; order: number }[];
  streams: { code: string; name: string; order: number }[];
  /** F6 curriculum subjects offered (a minimal chain is created to hold them). */
  subjects: { code: string; name: string }[];
  sections: {
    key: string;
    campusCode: string;
    yearLevelCode: string;
    streamCode?: string | null;
    name: string;
    capacity?: number;
  }[];
  offerings: {
    key: string;
    sectionKey: string;
    subjectCode: string;
    isElective?: boolean;
  }[];
  /** Offerings the tenant's teacher is assigned to teach. */
  teacherAssignments: string[];
  academicProfiles: {
    name: string;
    campusCode?: string | null;
    model: EnrollmentModel;
    isDefault?: boolean;
  }[];
  sectionEnrollments: { studentNumber: string; sectionKey: string }[];
  courseRegistrations?: { studentNumber: string; offeringKey: string }[];
  elections?: { studentNumber: string; offeringKey: string }[];
}

const GREENFIELD: SeedTenant = {
  slug: 'greenfield-secondary',
  teacherEmail: 'teacher@greenfield.test',
  academicYearName: '2026-2027',
  registrar: {
    email: 'registrar@greenfield.test',
    firstName: 'Ada',
    lastName: 'Okonkwo',
    campusCode: 'MAIN',
  },
  campuses: [
    { code: 'MAIN', name: 'Main Campus', isPrimary: true },
    { code: 'LAKE', name: 'Lakeside Annex' },
  ],
  stages: [
    { code: 'JSS', name: 'Junior Secondary', order: 1 },
    { code: 'SSS', name: 'Senior Secondary', order: 2 },
  ],
  yearLevels: [
    { code: 'JSS1', name: 'JSS1', stageCode: 'JSS', order: 1 },
    { code: 'JSS2', name: 'JSS2', stageCode: 'JSS', order: 2 },
    { code: 'JSS3', name: 'JSS3', stageCode: 'JSS', order: 3 },
    { code: 'SSS1', name: 'SSS1', stageCode: 'SSS', order: 4 },
    { code: 'SSS2', name: 'SSS2', stageCode: 'SSS', order: 5 },
    { code: 'SSS3', name: 'SSS3', stageCode: 'SSS', order: 6 },
  ],
  streams: [
    { code: 'SCI', name: 'Science', order: 1 },
    { code: 'ART', name: 'Arts', order: 2 },
    { code: 'COM', name: 'Commercial', order: 3 },
  ],
  subjects: [
    { code: 'MTH', name: 'Mathematics' },
    { code: 'ENG', name: 'English Language' },
    { code: 'SCI', name: 'Basic Science' },
    { code: 'ECO', name: 'Economics' },
  ],
  sections: [
    { key: 'jss2a-main', campusCode: 'MAIN', yearLevelCode: 'JSS2', name: 'A' },
    { key: 'sss1sci-main', campusCode: 'MAIN', yearLevelCode: 'SSS1', streamCode: 'SCI', name: 'A' },
    { key: 'sss1art-main', campusCode: 'MAIN', yearLevelCode: 'SSS1', streamCode: 'ART', name: 'A' },
    { key: 'jss2a-lake', campusCode: 'LAKE', yearLevelCode: 'JSS2', name: 'A' },
    { key: 'sss1sci-lake', campusCode: 'LAKE', yearLevelCode: 'SSS1', streamCode: 'SCI', name: 'A' },
  ],
  offerings: [
    { key: 'jss2-mth', sectionKey: 'jss2a-main', subjectCode: 'MTH' },
    { key: 'jss2-eng', sectionKey: 'jss2a-main', subjectCode: 'ENG' },
    { key: 'jss2-sci', sectionKey: 'jss2a-main', subjectCode: 'SCI' },
    { key: 'sss1-mth', sectionKey: 'sss1sci-main', subjectCode: 'MTH' },
    { key: 'sss1-eng', sectionKey: 'sss1sci-main', subjectCode: 'ENG' },
    { key: 'sss1-eco', sectionKey: 'sss1sci-main', subjectCode: 'ECO', isElective: true },
    { key: 'lake-mth', sectionKey: 'sss1sci-lake', subjectCode: 'MTH' },
    { key: 'lake-eco', sectionKey: 'sss1sci-lake', subjectCode: 'ECO' },
  ],
  teacherAssignments: ['jss2-mth', 'jss2-sci', 'sss1-mth'],
  academicProfiles: [
    { name: 'K-12 (class enrollment)', model: 'class', isDefault: true },
    { name: 'Lakeside course registration', campusCode: 'LAKE', model: 'course' },
  ],
  sectionEnrollments: [
    { studentNumber: 'STU-DEV-001', sectionKey: 'jss2a-main' },
    { studentNumber: 'STU-DEV-102', sectionKey: 'jss2a-main' },
    { studentNumber: 'STU-DEV-201', sectionKey: 'jss2a-main' },
    { studentNumber: 'STU-DEV-103', sectionKey: 'sss1sci-main' },
  ],
  courseRegistrations: [
    { studentNumber: 'STU-DEV-103', offeringKey: 'lake-mth' },
    { studentNumber: 'STU-DEV-103', offeringKey: 'lake-eco' },
  ],
  elections: [{ studentNumber: 'STU-DEV-103', offeringKey: 'sss1-eco' }],
};

const SUNRISE: SeedTenant = {
  slug: 'sunrise-primary',
  teacherEmail: 'teacher@sunrise.test',
  academicYearName: '2026-2027',
  campuses: [{ code: 'SUN-MAIN', name: 'Sunrise Main', isPrimary: true }],
  stages: [{ code: 'PRI', name: 'Primary', order: 1 }],
  yearLevels: [
    { code: 'P4', name: 'Primary 4', stageCode: 'PRI', order: 4 },
    { code: 'P5', name: 'Primary 5', stageCode: 'PRI', order: 5 },
    { code: 'P6', name: 'Primary 6', stageCode: 'PRI', order: 6 },
  ],
  streams: [],
  subjects: [
    { code: 'NUM', name: 'Numeracy' },
    { code: 'LIT', name: 'Literacy' },
    { code: 'SCI', name: 'Basic Science' },
    { code: 'SOC', name: 'Social Studies' },
  ],
  sections: [
    { key: 'p5a', campusCode: 'SUN-MAIN', yearLevelCode: 'P5', name: 'A' },
    { key: 'p5b', campusCode: 'SUN-MAIN', yearLevelCode: 'P5', name: 'B' },
  ],
  offerings: [
    { key: 'p5-num', sectionKey: 'p5a', subjectCode: 'NUM' },
    { key: 'p5-lit', sectionKey: 'p5a', subjectCode: 'LIT' },
    { key: 'p5-sci', sectionKey: 'p5a', subjectCode: 'SCI' },
    { key: 'p5-soc', sectionKey: 'p5a', subjectCode: 'SOC' },
  ],
  teacherAssignments: ['p5-num', 'p5-lit'],
  academicProfiles: [{ name: 'Primary (class enrollment)', model: 'class', isDefault: true }],
  sectionEnrollments: [
    { studentNumber: 'STU-DEV-001', sectionKey: 'p5a' },
    { studentNumber: 'STU-DEV-104', sectionKey: 'p5a' },
    { studentNumber: 'STU-DEV-202', sectionKey: 'p5a' },
  ],
};

// ------------------------------ helpers -----------------------------------

/** Resolve a config code to its seeded row, failing loudly on a typo. */
function mustGet<V>(map: Map<string, V>, key: string, kind: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Unknown ${kind} code "${key}" referenced in seed config.`);
  }
  return value;
}

/** Compose a section's display label from its dimensions (never parse one). */
function composeSectionLabel(
  yearName: string,
  streamName: string | null,
  sectionName: string,
): string {
  return [yearName, streamName, sectionName]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join(' ');
}

async function tenantIdBySlug(slug: string): Promise<string | null> {
  const t = await prisma.tenant.findFirst({ where: { slug }, select: { id: true } });
  return t?.id ?? null;
}

async function ensureAcademicYear(tenantId: string, name: string): Promise<string> {
  const existing = await prisma.academicYear.findFirst({
    where: { tenantId, name },
    select: { id: true },
  });
  if (existing) return existing.id;
  // Standalone run (academics seed not run): if the tenant has no default year,
  // make this one the default so it resolves as the "current" year — without
  // clobbering an existing default.
  const hasDefault = await prisma.academicYear.findFirst({
    where: { tenantId, isDefault: true },
    select: { id: true },
  });
  const created = await prisma.academicYear.create({
    data: {
      tenantId,
      name,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2027-06-30T00:00:00.000Z'),
      status: 'active',
      isDefault: !hasDefault,
      createdBy: CREATED_BY,
    },
    select: { id: true },
  });
  return created.id;
}

async function ensureCampus(
  tenantId: string,
  code: string,
  name: string,
  isPrimary: boolean,
): Promise<string> {
  const existing = await prisma.campus.findFirst({
    where: { tenantId, code },
    select: { id: true },
  });
  if (existing) return existing.id;
  const row = await prisma.campus.create({
    data: { tenantId, name, code, isPrimary },
    select: { id: true },
  });
  return row.id;
}

/** Idempotent upsert (by tenantId + code) for a school-wide dimension. */
async function ensureDimension(
  model: 'stage' | 'yearLevel' | 'stream',
  tenantId: string,
  code: string,
  data: Record<string, unknown>,
): Promise<string> {
  const delegate = prisma[model] as {
    findFirst: (a: unknown) => Promise<{ id: string } | null>;
    create: (a: unknown) => Promise<{ id: string }>;
  };
  const existing = await delegate.findFirst({
    where: { tenantId, code },
    select: { id: true },
  });
  if (existing) return existing.id;
  const row = await delegate.create({
    data: { tenantId, code, createdBy: CREATED_BY, ...data },
    select: { id: true },
  });
  return row.id;
}

/** Minimal F6 curriculum chain (authority → framework → version) for a tenant. */
async function ensureCurriculumVersion(tenantId: string, slug: string): Promise<string> {
  const authority =
    (await prisma.curriculumAuthority.findFirst({
      where: { tenantId, code: `${slug}-CUR` },
      select: { id: true },
    })) ??
    (await prisma.curriculumAuthority.create({
      data: { tenantId, name: 'School Curriculum', code: `${slug}-CUR`, kind: 'tenant' },
      select: { id: true },
    }));
  const framework =
    (await prisma.curriculumFramework.findFirst({
      where: { tenantId, code: `${slug}-FW` },
      select: { id: true },
    })) ??
    (await prisma.curriculumFramework.create({
      data: { tenantId, authorityId: authority.id, name: 'Core Framework', code: `${slug}-FW` },
      select: { id: true },
    }));
  // Match the DB unique key (frameworkId, versionLabel) so a re-run resolves the
  // exact version rather than "whichever findFirst returns" for the framework.
  const version =
    (await prisma.curriculumVersion.findFirst({
      where: { frameworkId: framework.id, versionLabel: CURRICULUM_VERSION_LABEL },
      select: { id: true },
    })) ??
    (await prisma.curriculumVersion.create({
      data: {
        tenantId,
        frameworkId: framework.id,
        versionLabel: CURRICULUM_VERSION_LABEL,
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      },
      select: { id: true },
    }));
  return version.id;
}

async function ensureCurriculumSubject(
  tenantId: string,
  versionId: string,
  code: string,
  name: string,
): Promise<string> {
  // Dedup on the DB unique key (versionId, code), not (tenantId, code).
  const existing = await prisma.curriculumSubject.findFirst({
    where: { versionId, code },
    select: { id: true },
  });
  if (existing) return existing.id;
  const row = await prisma.curriculumSubject.create({
    data: { tenantId, versionId, code, name },
    select: { id: true },
  });
  return row.id;
}

async function ensureSection(
  tenantId: string,
  campusId: string,
  yearLevelId: string,
  streamId: string | null,
  name: string,
  displayLabel: string,
  capacity: number,
): Promise<string> {
  const existing = await prisma.classSection.findFirst({
    where: { tenantId, campusId, yearLevelId, streamId, name },
    select: { id: true },
  });
  if (existing) return existing.id;
  const row = await prisma.classSection.create({
    data: {
      tenantId,
      campusId,
      yearLevelId,
      streamId,
      name,
      displayLabel,
      capacity,
      status: 'active',
      createdBy: CREATED_BY,
    },
    select: { id: true },
  });
  return row.id;
}

async function ensureOffering(
  tenantId: string,
  classSectionId: string,
  academicYearId: string,
  curriculumSubjectId: string,
  subjectLabel: string,
  isElective: boolean,
): Promise<string> {
  const existing = await prisma.subjectOffering.findFirst({
    where: { classSectionId, curriculumSubjectId, termId: null },
    select: { id: true },
  });
  if (existing) return existing.id;
  const row = await prisma.subjectOffering.create({
    data: {
      tenantId,
      classSectionId,
      academicYearId,
      curriculumSubjectId,
      subjectLabel,
      isElective,
      status: 'active',
      createdBy: CREATED_BY,
    },
    select: { id: true },
  });
  return row.id;
}

async function ensureOfferingTeacher(
  tenantId: string,
  subjectOfferingId: string,
  userTenantId: string,
): Promise<void> {
  const existing = await prisma.offeringTeacher.findFirst({
    where: { subjectOfferingId, userTenantId },
    select: { id: true },
  });
  if (existing) return;
  await prisma.offeringTeacher.create({
    data: { tenantId, subjectOfferingId, userTenantId, role: 'teacher', isActive: true, assignedBy: CREATED_BY },
  });
}

async function ensureAcademicProfile(
  tenantId: string,
  campusId: string | null,
  name: string,
  enrollmentModel: EnrollmentModel,
  isDefault: boolean,
): Promise<void> {
  const existing = await prisma.academicProfile.findFirst({
    where: { tenantId, campusId, name },
    select: { id: true },
  });
  if (existing) return;
  await prisma.academicProfile.create({
    data: { tenantId, campusId, name, enrollmentModel, isDefault, status: 'active', createdBy: CREATED_BY },
  });
}

async function studentIdByNumber(tenantId: string, studentNumber: string): Promise<string | null> {
  const s = await prisma.student.findFirst({
    where: { tenantId, studentNumber },
    select: { id: true },
  });
  return s?.id ?? null;
}

async function teacherProfileId(tenantId: string, email: string): Promise<string | null> {
  const user = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (!user) return null;
  const profile = await prisma.userTenant.findFirst({
    where: { userId: user.id, tenantId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

async function roleIdByName(name: string): Promise<string> {
  const role = await prisma.role.findFirst({
    where: { name, isSystemRole: true },
    select: { id: true },
  });
  if (!role) throw new Error(`Missing ${name} system role. Run db:seed first.`);
  return role.id;
}

/** A campus-scoped persona: Management role, grant scope = one campus (WB1-6). */
async function ensureCampusRegistrar(
  tenantId: string,
  def: NonNullable<SeedTenant['registrar']>,
  campusId: string,
  campusName: string,
): Promise<void> {
  const roleId = await roleIdByName('Management');

  // Only pay for a bcrypt hash when the user is actually created — on a re-run
  // the existing user is just reactivated, and the hash would be discarded.
  let user = await prisma.user.findFirst({
    where: { email: def.email },
    select: { id: true },
  });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true, isVerified: true },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email: def.email,
        passwordHash: await bcrypt.hash(DEV_PASSWORD, 12),
        firstName: def.firstName,
        lastName: def.lastName,
        isActive: true,
        isVerified: true,
      },
      select: { id: true },
    });
  }

  let profile = await prisma.userTenant.findFirst({
    where: { userId: user.id, tenantId },
    select: { id: true },
  });
  profile ??= await prisma.userTenant.create({
    data: { userId: user.id, tenantId, status: 'active', suspended: false },
    select: { id: true },
  });

  const scope: Prisma.InputJsonValue = {
    type: 'campus',
    value: campusId,
    label: campusName,
  };
  await prisma.userTenantRole.upsert({
    where: { userTenantId: profile.id },
    update: { roleId, tenantId, isPrimary: true, scope },
    create: { userTenantId: profile.id, roleId, tenantId, isPrimary: true, scope },
  });
}

// ------------------------------ driver ------------------------------------

async function applyTenant(cfg: SeedTenant): Promise<string> {
  const tenantId = await tenantIdBySlug(cfg.slug);
  if (!tenantId) return `⏭  ${cfg.slug}: tenant not found — run db:seed:dev first. Skipped.`;

  const academicYearId = await ensureAcademicYear(tenantId, cfg.academicYearName);

  const campusIds = new Map<string, { id: string; name: string }>();
  for (const c of cfg.campuses) {
    const id = await ensureCampus(tenantId, c.code, c.name, Boolean(c.isPrimary));
    campusIds.set(c.code, { id, name: c.name });
  }

  const stageIds = new Map<string, string>();
  for (const s of cfg.stages) {
    stageIds.set(s.code, await ensureDimension('stage', tenantId, s.code, { name: s.name, order: s.order }));
  }

  const yearLevels = new Map<string, { id: string; name: string }>();
  for (const y of cfg.yearLevels) {
    const id = await ensureDimension('yearLevel', tenantId, y.code, {
      name: y.name,
      order: y.order,
      stageId: stageIds.get(y.stageCode),
    });
    yearLevels.set(y.code, { id, name: y.name });
  }

  const streams = new Map<string, { id: string; name: string }>();
  for (const s of cfg.streams) {
    const id = await ensureDimension('stream', tenantId, s.code, { name: s.name, order: s.order });
    streams.set(s.code, { id, name: s.name });
  }

  // F6 curriculum chain + subjects.
  const versionId = await ensureCurriculumVersion(tenantId, cfg.slug);
  const subjects = new Map<string, { id: string; name: string }>();
  for (const sub of cfg.subjects) {
    const id = await ensureCurriculumSubject(tenantId, versionId, sub.code, sub.name);
    subjects.set(sub.code, { id, name: sub.name });
  }

  // Sections.
  const sectionIds = new Map<string, string>();
  for (const sec of cfg.sections) {
    const campus = mustGet(campusIds, sec.campusCode, 'campus');
    const year = mustGet(yearLevels, sec.yearLevelCode, 'year level');
    const stream = sec.streamCode
      ? mustGet(streams, sec.streamCode, 'stream')
      : null;
    const label = composeSectionLabel(year.name, stream?.name ?? null, sec.name);
    const id = await ensureSection(tenantId, campus.id, year.id, stream?.id ?? null, sec.name, label, sec.capacity ?? 40);
    sectionIds.set(sec.key, id);
  }

  // Offerings.
  const offeringIds = new Map<string, string>();
  for (const off of cfg.offerings) {
    const sectionId = mustGet(sectionIds, off.sectionKey, 'section');
    const subject = mustGet(subjects, off.subjectCode, 'subject');
    const id = await ensureOffering(tenantId, sectionId, academicYearId, subject.id, subject.name, Boolean(off.isElective));
    offeringIds.set(off.key, id);
  }

  // Teacher → offering assignments.
  const teacher = await teacherProfileId(tenantId, cfg.teacherEmail);
  let teacherAssigned = 0;
  if (teacher) {
    for (const key of cfg.teacherAssignments) {
      const offeringId = offeringIds.get(key);
      if (offeringId) {
        await ensureOfferingTeacher(tenantId, offeringId, teacher);
        teacherAssigned++;
      }
    }
  }

  // Academic profiles (tenant default + per-campus overrides).
  for (const p of cfg.academicProfiles) {
    const campusId = p.campusCode ? (campusIds.get(p.campusCode)?.id ?? null) : null;
    await ensureAcademicProfile(tenantId, campusId, p.name, p.model, Boolean(p.isDefault));
  }

  // Section enrollments (class model).
  let enrolled = 0;
  const missingStudents: string[] = [];
  for (const e of cfg.sectionEnrollments) {
    const studentId = await studentIdByNumber(tenantId, e.studentNumber);
    const sectionId = sectionIds.get(e.sectionKey);
    if (!studentId) {
      missingStudents.push(e.studentNumber);
      continue;
    }
    if (!sectionId) continue;
    const existing = await prisma.sectionEnrollment.findFirst({
      where: { studentId, classSectionId: sectionId, academicYearId },
      select: { id: true },
    });
    if (!existing) {
      await prisma.sectionEnrollment.create({
        data: { tenantId, studentId, classSectionId: sectionId, academicYearId, status: 'active', createdBy: CREATED_BY },
      });
    }
    enrolled++;
  }

  // Course registrations (course model).
  let registered = 0;
  for (const r of cfg.courseRegistrations ?? []) {
    const studentId = await studentIdByNumber(tenantId, r.studentNumber);
    const offeringId = offeringIds.get(r.offeringKey);
    if (!studentId || !offeringId) continue;
    const existing = await prisma.courseRegistration.findFirst({
      where: { studentId, subjectOfferingId: offeringId },
      select: { id: true },
    });
    if (!existing) {
      await prisma.courseRegistration.create({
        data: { tenantId, studentId, subjectOfferingId: offeringId, status: 'registered', createdBy: CREATED_BY },
      });
    }
    registered++;
  }

  // Elective elections (K-12).
  let elected = 0;
  for (const el of cfg.elections ?? []) {
    const studentId = await studentIdByNumber(tenantId, el.studentNumber);
    const offeringId = offeringIds.get(el.offeringKey);
    if (!studentId || !offeringId) continue;
    const existing = await prisma.studentSubjectElection.findFirst({
      where: { studentId, subjectOfferingId: offeringId },
      select: { id: true },
    });
    if (!existing) {
      await prisma.studentSubjectElection.create({
        data: { tenantId, studentId, subjectOfferingId: offeringId, status: 'elected', createdBy: CREATED_BY },
      });
    }
    elected++;
  }

  // Campus-scoped registrar persona (WB1-6 scope demo).
  let registrarNote = '';
  if (cfg.registrar) {
    const campus = campusIds.get(cfg.registrar.campusCode);
    if (campus) {
      await ensureCampusRegistrar(tenantId, cfg.registrar, campus.id, campus.name);
      registrarNote = `\n     ↳ ${cfg.registrar.email} (Management, scope=${campus.name}) / ${DEV_PASSWORD}`;
    }
  }

  const warn =
    missingStudents.length > 0
      ? `\n     ⚠ students not found (run db:seed:academics): ${missingStudents.join(', ')}`
      : '';

  return (
    `✅ ${cfg.slug}: ${cfg.campuses.length} campuses · ${cfg.sections.length} sections · ` +
    `${cfg.offerings.length} offerings · ${teacherAssigned} teacher assignments · ` +
    `${enrolled} enrollments · ${registered} course regs · ${elected} elections` +
    registrarNote +
    warn
  );
}

async function main() {
  assertDevSeedAllowed('academic-structure');
  console.log('\n🏫 Seeding ADR-02 academic structure + WB2-2 enrollment…\n');
  for (const cfg of [GREENFIELD, SUNRISE]) {
    console.log(await applyTenant(cfg));
  }
  console.log('');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
