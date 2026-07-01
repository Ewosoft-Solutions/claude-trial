/**
 * Dev-persona seed — local development only, never run in CI or production.
 *
 * Prerequisites (run in order):
 *   1. pnpm --filter @workspace/database db:deploy   — apply all migrations
 *   2. pnpm --filter @workspace/database db:seed     — system roles + architect
 * Then run this script.
 *
 * Creates two realistic school tenants (secondary + primary) each populated
 * with eight named personas — one per clearance level from Owner (L8) down
 * to Student (L1). The platform
 * Architect (L10) is already created by the main seed and is reused here.
 *
 * All operations are idempotent (upsert / findFirst-or-create), so re-running
 * this script against an existing database is safe.
 *
 * Tenants
 * -------
 *   greenfield-secondary   schoolType: secondary
 *   sunrise-primary        schoolType: primary
 *
 * Personas per tenant  (email prefix @ <tenant-domain>.test)
 * ----------------------------------------------------------
 *   owner@         Owner       L8   Full school access
 *   principal@     Management  L7   Broad school access
 *   itsupport@     ITSupport   L6   Technical maintenance
 *   bursar@        Finance     L5   Financial & legal
 *   operations@    Operations  L4   Logistics & resources
 *   teacher@       Teacher     L3   Own classes only
 *   parent@        Parent      L2   Own children only
 *   student@       Student     L1   Own academic data
 *
 * Platform personas
 * ------------------
 *   superadmin@platform.test   SuperAdmin  L9
 *   architect@schoolwithease.com  Architect  L10  (created by db:seed — not re-seeded here)
 *
 * Default password for every dev account: DevPassword@2025!
 * WARNING: never use these credentials outside of a local dev database.
 */

import { prisma } from '../../src/client.js';
import bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEV_PASSWORD = 'DevPassword@2025!';

// Roles that map 1-to-1 with personas
const ROLE_NAMES = [
  'Owner',      // L8
  'Management', // L7
  'ITSupport',  // L6
  'Finance',    // L5
  'Operations', // L4
  'Teacher',    // L3
  'Parent',     // L2
  'Student',    // L1
  'SuperAdmin', // L9 — platform only
] as const;

type RoleName = (typeof ROLE_NAMES)[number];

// ---------------------------------------------------------------------------
// Tenant definitions
// ---------------------------------------------------------------------------

interface TenantDef {
  name: string;
  slug: string;
  domain: string;
  schoolType: string;
  /** Roles that get a persona in this tenant (all except platform roles). */
  personas: Array<{
    emailPrefix: string;
    role: RoleName;
    firstName: string;
    lastName: string;
  }>;
  /** Sample academic structure to create. */
  academic: {
    year: { name: string; startDate: Date; endDate: Date };
    term: { name: string; type: string; startDate: Date; endDate: Date; order: number };
    courses: Array<{ code: string; name: string; category: string; gradeLevels: string[] }>;
  };
}

const TENANTS: TenantDef[] = [
  {
    name: 'Greenfield Secondary School',
    slug: 'greenfield-secondary',
    domain: 'greenfield.test',
    schoolType: 'secondary',
    personas: [
      { emailPrefix: 'owner',      role: 'Owner',      firstName: 'Owner',      lastName: 'Greenfield' },
      { emailPrefix: 'principal',  role: 'Management', firstName: 'Principal',  lastName: 'Greenfield' },
      { emailPrefix: 'itsupport',  role: 'ITSupport',  firstName: 'ITSupport',  lastName: 'Greenfield' },
      { emailPrefix: 'bursar',     role: 'Finance',    firstName: 'Bursar',     lastName: 'Greenfield' },
      { emailPrefix: 'operations', role: 'Operations', firstName: 'Operations', lastName: 'Greenfield' },
      { emailPrefix: 'teacher',    role: 'Teacher',    firstName: 'Teacher',    lastName: 'Greenfield' },
      { emailPrefix: 'parent',     role: 'Parent',     firstName: 'Parent',     lastName: 'Greenfield' },
      { emailPrefix: 'student',    role: 'Student',    firstName: 'Student',    lastName: 'Greenfield' },
    ],
    academic: {
      year: {
        name: '2024-2025',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-07-31'),
      },
      term: {
        name: 'Spring Term 2025',
        type: 'term',
        startDate: new Date('2025-01-13'),
        endDate: new Date('2025-04-11'),
        order: 2,
      },
      courses: [
        { code: 'MATH-101', name: 'Mathematics',         category: 'Mathematics', gradeLevels: ['JSS1', 'JSS2', 'JSS3'] },
        { code: 'ENG-101',  name: 'English Language',    category: 'Languages',   gradeLevels: ['JSS1', 'JSS2', 'JSS3', 'SSS1', 'SSS2', 'SSS3'] },
        { code: 'SCI-101',  name: 'Basic Science',       category: 'Sciences',    gradeLevels: ['JSS1', 'JSS2', 'JSS3'] },
        { code: 'PHY-201',  name: 'Physics',             category: 'Sciences',    gradeLevels: ['SSS1', 'SSS2', 'SSS3'] },
        { code: 'CHEM-201', name: 'Chemistry',           category: 'Sciences',    gradeLevels: ['SSS1', 'SSS2', 'SSS3'] },
        { code: 'ECO-201',  name: 'Economics',           category: 'Social Sciences', gradeLevels: ['SSS1', 'SSS2', 'SSS3'] },
      ],
    },
  },
  {
    name: 'Sunrise Primary School',
    slug: 'sunrise-primary',
    domain: 'sunrise.test',
    schoolType: 'primary',
    personas: [
      { emailPrefix: 'owner',      role: 'Owner',      firstName: 'Owner',      lastName: 'Sunrise' },
      { emailPrefix: 'principal',  role: 'Management', firstName: 'Principal',  lastName: 'Sunrise' },
      { emailPrefix: 'itsupport',  role: 'ITSupport',  firstName: 'ITSupport',  lastName: 'Sunrise' },
      { emailPrefix: 'bursar',     role: 'Finance',    firstName: 'Bursar',     lastName: 'Sunrise' },
      { emailPrefix: 'operations', role: 'Operations', firstName: 'Operations', lastName: 'Sunrise' },
      { emailPrefix: 'teacher',    role: 'Teacher',    firstName: 'Teacher',    lastName: 'Sunrise' },
      { emailPrefix: 'parent',     role: 'Parent',     firstName: 'Parent',     lastName: 'Sunrise' },
      { emailPrefix: 'student',    role: 'Student',    firstName: 'Student',    lastName: 'Sunrise' },
    ],
    academic: {
      year: {
        name: '2024-2025',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-07-31'),
      },
      term: {
        name: 'Spring Term 2025',
        type: 'term',
        startDate: new Date('2025-01-13'),
        endDate: new Date('2025-04-11'),
        order: 2,
      },
      courses: [
        { code: 'MATH-P1', name: 'Numeracy',            category: 'Mathematics', gradeLevels: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] },
        { code: 'ENG-P1',  name: 'Literacy',            category: 'Languages',   gradeLevels: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] },
        { code: 'SCI-P1',  name: 'Basic Science',       category: 'Sciences',    gradeLevels: ['P3', 'P4', 'P5', 'P6'] },
        { code: 'SOC-P1',  name: 'Social Studies',      category: 'Social Sciences', gradeLevels: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function upsertUser(email: string, firstName: string, lastName: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { firstName, lastName, isActive: true, isVerified: true },
    create: { email, passwordHash, firstName, lastName, isActive: true, isVerified: true },
  });
}

async function findOrCreateUserTenant(userId: string, tenantId: string) {
  const existing = await prisma.userTenant.findFirst({ where: { userId, tenantId } });
  if (existing) return existing;
  return prisma.userTenant.create({
    data: { userId, tenantId, status: 'active', suspended: false },
  });
}

/**
 * Creates a fresh UserTenant row even if one already exists for this
 * (userId, tenantId) pair — used to give one user a second profile (and
 * thus a second role) at the same school, since role is 1:1 with profile.
 * Idempotent via a marker lookup on (userId, tenantId, role) through the
 * linked UserTenantRole rather than on UserTenant itself.
 */
async function createAdditionalProfile(userId: string, tenantId: string, roleId: string) {
  const existing = await prisma.userTenant.findFirst({
    where: { userId, tenantId, userTenantRole: { roleId } },
  });
  if (existing) return existing;
  return prisma.userTenant.create({
    data: { userId, tenantId, status: 'active', suspended: false },
  });
}

async function assignRole(userTenantId: string, roleId: string, tenantId: string) {
  const existing = await prisma.userTenantRole.findUnique({ where: { userTenantId } });
  if (existing) return existing;
  return prisma.userTenantRole.create({
    data: { userTenantId, roleId, tenantId, isPrimary: true },
  });
}

async function ensureJwtConfig(tenantId: string) {
  const existing = await prisma.tenantJWTConfig.findUnique({ where: { tenantId } });
  if (existing) return existing;
  const secret = crypto.randomBytes(32).toString('base64');
  return prisma.tenantJWTConfig.create({
    data: {
      tenantId,
      jwtSecret: Buffer.from(secret).toString('base64'),
      secretSource: 'auto_generated',
      secretRotationDate: new Date(),
      previousSecrets: [],
      managedBy: 'platform_admin',
      accessibleBySchools: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Phase 1: Resolve system role IDs
// ---------------------------------------------------------------------------

async function resolveRoles(): Promise<Record<string, string>> {
  console.log('\n📋 Resolving system roles...');

  const roles = await prisma.role.findMany({
    where: { name: { in: [...ROLE_NAMES] }, isSystemRole: true },
    select: { id: true, name: true },
  });

  const map: Record<string, string> = {};
  for (const r of roles) map[r.name] = r.id;

  const missing = ROLE_NAMES.filter((n) => !map[n]);
  if (missing.length > 0) {
    throw new Error(
      `Missing system roles: ${missing.join(', ')}.\nRun db:seed first to create system roles.`,
    );
  }

  console.log(`  ✅ Resolved ${roles.length} system roles`);
  return map;
}

// ---------------------------------------------------------------------------
// Phase 2: Seed platform SuperAdmin persona
// ---------------------------------------------------------------------------

async function seedPlatformSuperAdmin(
  roles: Record<string, string>,
  passwordHash: string,
) {
  console.log('\n📋 Seeding platform SuperAdmin persona...');

  const platformTenant = await prisma.tenant.findUnique({ where: { slug: 'platform' } });
  if (!platformTenant) {
    console.warn('  ⚠️  Platform tenant not found — run db:seed first. Skipping SuperAdmin.');
    return;
  }

  const user = await upsertUser(
    'superadmin@platform.test',
    'SuperAdmin',
    'Platform',
    passwordHash,
  );

  const profile = await findOrCreateUserTenant(user.id, platformTenant.id);
  await assignRole(profile.id, roles['SuperAdmin']!, platformTenant.id);

  console.log('  ✅ superadmin@platform.test → SuperAdmin (L9) on platform tenant');
}

// ---------------------------------------------------------------------------
// Phase 3: Seed one tenant and its personas
// ---------------------------------------------------------------------------

async function seedTenant(
  def: TenantDef,
  roles: Record<string, string>,
  passwordHash: string,
) {
  console.log(`\n📋 Seeding tenant: ${def.name} (${def.slug})...`);

  // Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: def.slug },
    update: { name: def.name, status: 'active', schoolType: def.schoolType },
    create: {
      name: def.name,
      slug: def.slug,
      status: 'active',
      schoolType: def.schoolType,
      settings: {},
    },
  });
  console.log(`  ✅ Tenant: ${tenant.name} (${tenant.id})`);

  await ensureJwtConfig(tenant.id);

  // Personas
  let teacherProfile: { id: string } | null = null;
  let studentProfile: { id: string } | null = null;
  let parentProfile:  { id: string } | null = null;

  for (const p of def.personas) {
    const email = `${p.emailPrefix}@${def.domain}`;
    const roleId = roles[p.role];
    if (!roleId) {
      console.warn(`  ⚠️  Role ${p.role} not found — skipping ${email}`);
      continue;
    }

    const user = await upsertUser(email, p.firstName, p.lastName, passwordHash);
    const profile = await findOrCreateUserTenant(user.id, tenant.id);
    await assignRole(profile.id, roleId, tenant.id);

    console.log(`  ✅ ${email.padEnd(36)} → ${p.role.padEnd(12)} (L${clearanceOf(p.role)})`);

    if (p.role === 'Teacher') teacherProfile = profile;
    if (p.role === 'Student') studentProfile = profile;
    if (p.role === 'Parent')  parentProfile  = profile;
  }

  // Academic structure
  const { academicYear, term, courseIds } = await seedAcademicStructure(tenant.id, def);

  // Student record
  let student: { id: string } | null = null;
  if (studentProfile) {
    student = await prisma.student.upsert({
      where: { tenantId_studentNumber: { tenantId: tenant.id, studentNumber: 'STU-DEV-001' } },
      update: { userTenantId: studentProfile.id, gradeLevel: def.schoolType === 'primary' ? 'P5' : 'JSS2' },
      create: {
        tenantId: tenant.id,
        userTenantId: studentProfile.id,
        studentNumber: 'STU-DEV-001',
        admissionNumber: 'ADM-DEV-001',
        gradeLevel: def.schoolType === 'primary' ? 'P5' : 'JSS2',
        enrollmentStatus: 'active',
        enrollmentDate: new Date('2023-09-01'),
      },
    });
    console.log(`  ✅ Student record STU-DEV-001 linked to student@ persona`);
  }

  // Guardian link
  if (student && parentProfile) {
    await prisma.studentGuardian.upsert({
      where: { studentId_userTenantId: { studentId: student.id, userTenantId: parentProfile.id } },
      update: { relationship: 'parent', isPrimary: true, legalGuardian: true },
      create: {
        tenantId: tenant.id,
        studentId: student.id,
        userTenantId: parentProfile.id,
        relationship: 'parent',
        isPrimary: true,
        legalGuardian: true,
        contactPriority: 1,
      },
    });
    console.log(`  ✅ parent@ linked as guardian to STU-DEV-001`);
  }

  // Classes — one per course; link teacher; enrol student
  if (courseIds.length > 0) {
    await seedClasses(tenant.id, courseIds, term.id, academicYear.id, teacherProfile, studentProfile, student);
  }
}

// ---------------------------------------------------------------------------
// Academic structure helpers
// ---------------------------------------------------------------------------

async function seedAcademicStructure(tenantId: string, def: TenantDef) {
  const { year, term: termDef, courses } = def.academic;

  const academicYear = await prisma.academicYear.upsert({
    where: { tenantId_name: { tenantId, name: year.name } },
    update: { startDate: year.startDate, endDate: year.endDate, status: 'active', isDefault: true },
    create: {
      tenantId,
      name: year.name,
      startDate: year.startDate,
      endDate: year.endDate,
      status: 'active',
      isDefault: true,
    },
  });

  const term = await prisma.term.upsert({
    where: { academicYearId_name: { academicYearId: academicYear.id, name: termDef.name } },
    update: { startDate: termDef.startDate, endDate: termDef.endDate, status: 'active' },
    create: {
      academicYearId: academicYear.id,
      tenantId,
      name: termDef.name,
      type: termDef.type,
      startDate: termDef.startDate,
      endDate: termDef.endDate,
      order: termDef.order,
      status: 'active',
    },
  });

  const courseIds: string[] = [];
  for (const c of courses) {
    const course = await prisma.course.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: { name: c.name, category: c.category, gradeLevels: c.gradeLevels, status: 'active' },
      create: {
        tenantId,
        code: c.code,
        name: c.name,
        category: c.category,
        gradeLevels: c.gradeLevels,
        status: 'active',
      },
    });
    courseIds.push(course.id);
  }

  console.log(`  ✅ Academic year "${academicYear.name}", term "${term.name}", ${courseIds.length} courses`);
  return { academicYear, term, courseIds };
}

async function seedClasses(
  tenantId: string,
  courseIds: string[],
  termId: string,
  academicYearId: string,
  teacherProfile: { id: string } | null,
  studentProfile: { id: string } | null,
  student: { id: string } | null,
) {
  // Only create the first two classes to keep the seed lean
  const classesToCreate = courseIds.slice(0, 2);

  for (const courseId of classesToCreate) {
    // findFirst because @@unique([courseId, termId, section])
    const existing = await prisma.class.findFirst({ where: { courseId, termId, section: 'A' } });
    const cls = existing ?? await prisma.class.create({
      data: {
        courseId,
        termId,
        academicYearId,
        tenantId,
        section: 'A',
        capacity: 30,
        status: 'active',
      },
    });

    // Assign teacher
    if (teacherProfile) {
      const existingTeacher = await prisma.classTeacher.findFirst({
        where: { classId: cls.id, userTenantId: teacherProfile.id },
      });
      if (!existingTeacher) {
        await prisma.classTeacher.create({
          data: { classId: cls.id, userTenantId: teacherProfile.id, tenantId, role: 'teacher', isActive: true },
        });
      }
    }

    // Enrol student
    if (student && studentProfile) {
      const existingEnrolment = await prisma.enrollment.findFirst({
        where: { studentId: student.id, classId: cls.id, academicYearId },
      });
      if (!existingEnrolment) {
        await prisma.enrollment.create({
          data: {
            tenantId,
            studentId: student.id,
            classId: cls.id,
            termId,
            academicYearId,
            status: 'active',
            enrollmentDate: new Date('2025-01-13'),
          },
        });
      }
    }
  }

  console.log(`  ✅ ${classesToCreate.length} class(es) created with teacher assigned and student enrolled`);
}

// ---------------------------------------------------------------------------
// Finance sample data — a few invoices so /finance/invoices is non-empty
// ---------------------------------------------------------------------------

async function seedFinanceData(tenantId: string) {
  const TERM_NAME = 'Spring Term 2025';

  // Find the student record for this tenant
  const student = await prisma.student.findFirst({ where: { tenantId, studentNumber: 'STU-DEV-001' } });
  if (!student) return;

  const invoices = [
    { invoiceNumber: 'INV-DEV-001', amountDue: 18500000, amountPaid: 18500000, status: 'paid' },
    { invoiceNumber: 'INV-DEV-002', amountDue: 18500000, amountPaid: 0,        status: 'overdue' },
    { invoiceNumber: 'INV-DEV-003', amountDue: 19500000, amountPaid: 10000000, status: 'partial' },
  ];

  for (const inv of invoices) {
    await prisma.feeInvoice.upsert({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber: inv.invoiceNumber } },
      update: { amountPaid: inv.amountPaid, status: inv.status },
      create: {
        tenantId,
        invoiceNumber: inv.invoiceNumber,
        studentId: student.id,
        termName: TERM_NAME,
        termYear: 2025,
        termCycle: 1,
        issuedDate: new Date('2025-01-13'),
        dueDate: new Date('2025-01-31'),
        amountDue: inv.amountDue,
        amountPaid: inv.amountPaid,
        status: inv.status,
      },
    });
  }

  // One completed payment against the first invoice
  const paidInvoice = await prisma.feeInvoice.findFirst({
    where: { tenantId, invoiceNumber: 'INV-DEV-001' },
  });
  if (paidInvoice) {
    await prisma.payment.upsert({
      where: { tenantId_receiptNumber: { tenantId, receiptNumber: 'PMT-DEV-001' } },
      update: {},
      create: {
        tenantId,
        receiptNumber: 'PMT-DEV-001',
        invoiceId: paidInvoice.id,
        studentId: student.id,
        method: 'transfer',
        paidAt: new Date('2025-01-20'),
        amount: 18500000,
        status: 'completed',
        reference: 'TRF-DEV-2025-001',
      },
    });
  }

  console.log(`  ✅ Finance sample data: 3 invoices, 1 payment`);
}

// ---------------------------------------------------------------------------
// Attendance sample data — a week of marks so /attendance/daily is non-empty
// ---------------------------------------------------------------------------

async function seedAttendanceData(tenantId: string) {
  const student = await prisma.student.findFirst({ where: { tenantId, studentNumber: 'STU-DEV-001' } });
  if (!student) return;

  const cls = await prisma.class.findFirst({
    where: { tenantId, section: 'A', status: 'active' },
  });
  if (!cls) return;

  const teacherProfile = await prisma.userTenant.findFirst({
    where: {
      tenantId,
      userTenantRole: { role: { name: 'Teacher' } },
    },
    include: { userTenantRole: true },
  });

  const dates = [
    new Date('2025-01-13'),
    new Date('2025-01-14'),
    new Date('2025-01-15'),
    new Date('2025-01-16'),
    new Date('2025-01-17'),
  ];
  const statuses = ['present', 'present', 'late', 'present', 'absent'];

  for (let i = 0; i < dates.length; i++) {
    await prisma.attendanceRecord.upsert({
      where: {
        tenantId_studentId_classId_date: {
          tenantId,
          studentId: student.id,
          classId: cls.id,
          date: dates[i]!,
        },
      },
      update: { status: statuses[i]! },
      create: {
        tenantId,
        studentId: student.id,
        classId: cls.id,
        date: dates[i]!,
        status: statuses[i]!,
        recordedBy: teacherProfile?.id ?? null,
      },
    });
  }

  console.log(`  ✅ Attendance sample data: 5 records (Mon–Fri, week 1)`);
}

// ---------------------------------------------------------------------------
// Multi-school, multi-role persona — exercises the schools[].profiles[]
// grouping: one user with two profiles at Greenfield (Teacher + Parent) and
// TWO profiles at Sunrise (Teacher + Parent) — three schools-worth of
// guardian context isn't testable with only one Parent profile, so this
// user is a parent at both schools, each with its own child(ren).
// ---------------------------------------------------------------------------

async function seedMultiProfilePersona(
  roles: Record<string, string>,
  passwordHash: string,
) {
  console.log('\n📋 Seeding multi-school, multi-role persona...');

  const greenfield = await prisma.tenant.findUnique({ where: { slug: 'greenfield-secondary' } });
  const sunrise = await prisma.tenant.findUnique({ where: { slug: 'sunrise-primary' } });
  if (!greenfield || !sunrise) {
    console.warn('  ⚠️  Tenants not found — run tenant seeding first. Skipping multi-profile persona.');
    return;
  }

  const user = await upsertUser('multi@schoolwithease.test', 'Multi', 'Profile', passwordHash);

  // Greenfield: Teacher profile (own UserTenant row)
  const greenfieldTeacher = await findOrCreateUserTenant(user.id, greenfield.id);
  await assignRole(greenfieldTeacher.id, roles['Teacher']!, greenfield.id);

  // Greenfield: second profile, Parent — same user, same school, different role
  const greenfieldParent = await createAdditionalProfile(user.id, greenfield.id, roles['Parent']!);
  await assignRole(greenfieldParent.id, roles['Parent']!, greenfield.id);

  // Sunrise: Teacher profile — same user, different school
  const sunriseTeacher = await findOrCreateUserTenant(user.id, sunrise.id);
  await assignRole(sunriseTeacher.id, roles['Teacher']!, sunrise.id);

  // Sunrise: second profile, Parent — same user, second school, exercises a
  // guardian with children spread across schools (not just co-located roles).
  const sunriseParent = await createAdditionalProfile(user.id, sunrise.id, roles['Parent']!);
  await assignRole(sunriseParent.id, roles['Parent']!, sunrise.id);

  console.log('  ✅ multi@schoolwithease.test → Greenfield: Teacher + Parent, Sunrise: Teacher + Parent');

  await seedParentChildren(greenfield.id, greenfieldParent.id, roles['Student']!, passwordHash, [
    {
      emailPrefix: 'child1', firstName: 'Amara', lastName: 'Profile', gradeLevel: 'JSS1',
      studentNumber: 'STU-DEV-101', admissionNumber: 'ADM-DEV-101',
      attendanceStatuses: ['present', 'present', 'present', 'late', 'present'],
      gradePercent: 78, feeAmountDue: 15000000, feeAmountPaid: 15000000, feeStatus: 'paid',
    },
    {
      emailPrefix: 'child2', firstName: 'Chidi', lastName: 'Profile', gradeLevel: 'JSS2',
      studentNumber: 'STU-DEV-102', admissionNumber: 'ADM-DEV-102',
      attendanceStatuses: ['present', 'late', 'absent', 'present', 'present'],
      gradePercent: 85, feeAmountDue: 15000000, feeAmountPaid: 9000000, feeStatus: 'partial',
    },
    {
      emailPrefix: 'child3', firstName: 'Ngozi', lastName: 'Profile', gradeLevel: 'SSS1',
      studentNumber: 'STU-DEV-103', admissionNumber: 'ADM-DEV-103',
      attendanceStatuses: ['present', 'present', 'present', 'present', 'present'],
      gradePercent: 68, feeAmountDue: 19500000, feeAmountPaid: 0, feeStatus: 'overdue',
    },
  ]);

  await seedParentChildren(sunrise.id, sunriseParent.id, roles['Student']!, passwordHash, [
    {
      emailPrefix: 'child4', firstName: 'Tayo', lastName: 'Profile', gradeLevel: 'P3',
      studentNumber: 'STU-DEV-104', admissionNumber: 'ADM-DEV-104',
      attendanceStatuses: ['present', 'present', 'late', 'present', 'absent'],
      gradePercent: 91, feeAmountDue: 12000000, feeAmountPaid: 6000000, feeStatus: 'partial',
    },
  ]);
}

interface ChildSeedConfig {
  emailPrefix: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  studentNumber: string;
  admissionNumber: string;
  /** 5 weekday statuses: 'present' | 'absent' | 'late' | 'excused'. */
  attendanceStatuses: string[];
  /** Single assessment score, 0-100, backing the "average grade" stat. */
  gradePercent: number;
  /** Minor units (kobo). */
  feeAmountDue: number;
  feeAmountPaid: number;
  feeStatus: string;
}

/**
 * Child Student records, each with its own login (Student role + Student
 * record), linked as children of the given guardian profile via
 * StudentGuardian, each with real attendance/grade/fee data seeded (see
 * seedChildAcademicData) — so the parent dashboard aggregates and per-child
 * views show real, varied numbers instead of empty state or mock data.
 */
async function seedParentChildren(
  tenantId: string,
  parentProfileId: string,
  studentRoleId: string,
  passwordHash: string,
  children: ChildSeedConfig[],
) {
  for (const c of children) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    const emailDomain = tenant?.slug === 'sunrise-primary' ? 'sunrise.test' : 'greenfield.test';
    const email = `${c.emailPrefix}@${emailDomain}`;

    const user = await upsertUser(email, c.firstName, c.lastName, passwordHash);
    const profile = await findOrCreateUserTenant(user.id, tenantId);
    await assignRole(profile.id, studentRoleId, tenantId);

    const student = await prisma.student.upsert({
      where: { tenantId_studentNumber: { tenantId, studentNumber: c.studentNumber } },
      update: { userTenantId: profile.id, gradeLevel: c.gradeLevel },
      create: {
        tenantId,
        userTenantId: profile.id,
        studentNumber: c.studentNumber,
        admissionNumber: c.admissionNumber,
        gradeLevel: c.gradeLevel,
        enrollmentStatus: 'active',
        enrollmentDate: new Date('2023-09-01'),
      },
    });

    await prisma.studentGuardian.upsert({
      where: { studentId_userTenantId: { studentId: student.id, userTenantId: parentProfileId } },
      update: { relationship: 'parent', isPrimary: true, legalGuardian: true },
      create: {
        tenantId,
        studentId: student.id,
        userTenantId: parentProfileId,
        relationship: 'parent',
        isPrimary: true,
        legalGuardian: true,
        contactPriority: 1,
      },
    });

    await seedChildAcademicData(tenantId, student.id, c);

    console.log(`  ✅ ${email.padEnd(28)} → Student (${c.gradeLevel}), guardian's dashboard now has real data`);
  }
}

/**
 * Real attendance, grade and fee data for one child — enrolls them in the
 * tenant's first seeded class, marks a week of attendance, records one
 * graded assessment, and issues a fee invoice. Backs the parent dashboard's
 * per-child stats (GET /parent-portal/children) with genuine numbers
 * instead of the empty state a child with no records correctly shows.
 */
async function seedChildAcademicData(
  tenantId: string,
  studentId: string,
  c: ChildSeedConfig,
) {
  const academicYear = await prisma.academicYear.findFirst({ where: { tenantId, isDefault: true } });
  const term = academicYear
    ? await prisma.term.findFirst({ where: { academicYearId: academicYear.id } })
    : null;
  const cls = await prisma.class.findFirst({ where: { tenantId, section: 'A', status: 'active' } });

  if (!academicYear || !term || !cls) return;

  // Enrol the child in the class (Enrollment has no natural unique key, so
  // find-or-create like seedClasses does for the single-persona student).
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { studentId, classId: cls.id, academicYearId: academicYear.id },
  });
  const enrollment = existingEnrollment ?? await prisma.enrollment.create({
    data: {
      tenantId,
      studentId,
      classId: cls.id,
      termId: term.id,
      academicYearId: academicYear.id,
      status: 'active',
      enrollmentDate: new Date('2025-01-13'),
    },
  });

  // Attendance — one record per weekday, Mon 13 Jan through Fri 17 Jan.
  const dates = [
    new Date('2025-01-13'),
    new Date('2025-01-14'),
    new Date('2025-01-15'),
    new Date('2025-01-16'),
    new Date('2025-01-17'),
  ];
  for (let i = 0; i < dates.length; i++) {
    await prisma.attendanceRecord.upsert({
      where: {
        tenantId_studentId_classId_date: {
          tenantId,
          studentId,
          classId: cls.id,
          date: dates[i]!,
        },
      },
      update: { status: c.attendanceStatuses[i]! },
      create: {
        tenantId,
        studentId,
        classId: cls.id,
        date: dates[i]!,
        status: c.attendanceStatuses[i]!,
      },
    });
  }

  // One graded assessment per class, shared across children in that class,
  // each getting their own Grade row against it.
  const assessment = await prisma.assessment.findFirst({
    where: { classId: cls.id, name: 'Term 1 Assessment' },
  }) ?? await prisma.assessment.create({
    data: {
      classId: cls.id,
      academicYearId: academicYear.id,
      termId: term.id,
      tenantId,
      name: 'Term 1 Assessment',
      type: 'exam',
      maxPoints: 100,
      status: 'graded',
    },
  });

  const existingGrade = await prisma.grade.findUnique({
    where: { enrollmentId_assessmentId: { enrollmentId: enrollment.id, assessmentId: assessment.id } },
  });
  if (!existingGrade) {
    await prisma.grade.create({
      data: {
        enrollmentId: enrollment.id,
        assessmentId: assessment.id,
        tenantId,
        pointsEarned: c.gradePercent,
        percentage: c.gradePercent,
        status: 'graded',
        gradedAt: new Date('2025-01-20'),
      },
    });
  }

  // Fee invoice for the term.
  await prisma.feeInvoice.upsert({
    where: { tenantId_invoiceNumber: { tenantId, invoiceNumber: `INV-${c.studentNumber}` } },
    update: { amountPaid: c.feeAmountPaid, status: c.feeStatus },
    create: {
      tenantId,
      invoiceNumber: `INV-${c.studentNumber}`,
      studentId,
      termName: term.name,
      termYear: 2025,
      termCycle: 1,
      issuedDate: new Date('2025-01-13'),
      dueDate: new Date('2025-01-31'),
      amountDue: c.feeAmountDue,
      amountPaid: c.feeAmountPaid,
      status: c.feeStatus,
    },
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

const CLEARANCE: Record<RoleName, number> = {
  SuperAdmin: 9, Owner: 8, Management: 7, ITSupport: 6,
  Finance: 5, Operations: 4, Teacher: 3, Parent: 2, Student: 1,
};

function clearanceOf(role: RoleName): number {
  return CLEARANCE[role] ?? 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Dev-persona seed starting...');
  console.log('   Password for all accounts: DevPassword@2025!');
  console.log('   ⚠️  For local development only — never run against production.\n');

  try {
    const roles = await resolveRoles();
    const passwordHash = await hashPassword(DEV_PASSWORD);

    await seedPlatformSuperAdmin(roles, passwordHash);

    for (const tenantDef of TENANTS) {
      await seedTenant(tenantDef, roles, passwordHash);

      // Enrich with domain data after the tenant + personas are in place
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantDef.slug } });
      if (tenant) {
        await seedFinanceData(tenant.id);
        await seedAttendanceData(tenant.id);
      }
    }

    await seedMultiProfilePersona(roles, passwordHash);

    console.log('\n✨ Dev-persona seed complete!\n');
    console.log('📋 Account summary');
    console.log('─'.repeat(70));
    console.log('Platform');
    console.log('  architect@schoolwithease.com Architect   L10  (created by db:seed)');
    console.log('  superadmin@platform.test     SuperAdmin  L9');
    console.log('');

    for (const t of TENANTS) {
      console.log(`${t.name}  (${t.domain})`);
      for (const p of t.personas) {
        const email = `${p.emailPrefix}@${t.domain}`.padEnd(36);
        const role  = p.role.padEnd(12);
        console.log(`  ${email} ${role} L${clearanceOf(p.role)}`);
      }
      console.log('');
    }

    console.log('Multi-school / multi-role test account');
    console.log('  multi@schoolwithease.test          Greenfield: Teacher + Parent, Sunrise: Teacher + Parent');
    console.log('  Parent profile children (Greenfield):');
    console.log('    child1@greenfield.test  Amara Profile  JSS1  (91% attendance, 78% grade, fees paid)');
    console.log('    child2@greenfield.test  Chidi Profile  JSS2  (60% attendance, 85% grade, fees partial)');
    console.log('    child3@greenfield.test  Ngozi Profile  SSS1  (100% attendance, 68% grade, fees overdue)');
    console.log('  Parent profile children (Sunrise):');
    console.log('    child4@sunrise.test     Tayo Profile   P3    (60% attendance, 91% grade, fees partial)');
    console.log('');
    console.log('  Default password: DevPassword@2025!');
    console.log('─'.repeat(70));
  } catch (err) {
    console.error('\n❌ Dev-persona seed failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
