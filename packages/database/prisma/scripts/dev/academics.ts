/**
 * Dev academic workflow seed.
 *
 * Run after:
 *   1. pnpm --filter @workspace/database db:seed
 *   2. pnpm --filter @workspace/database db:seed:dev
 *
 * This script keeps the existing dev personas, then replaces their academic
 * workflow data with a realistic end-to-end scenario:
 *   - teacher allocations by class/course
 *   - enrolled student rosters tied to student/parent personas
 *   - approved/pending/rejected lessons and materials
 *   - course-scoped question banks
 *   - published, draft and manual-grading assessments
 *   - submissions and grades for enrolled students
 *
 * It clears only academic workflow rows for the two dev tenants
 * (greenfield-secondary and sunrise-primary). RBAC, tenants, users, profiles
 * and finance invoices from the persona seed are preserved.
 */

import { prisma } from '../../../src/singleton.js';
import bcrypt from 'bcrypt';
import { assertDevSeedAllowed } from './guard.js';

const DEV_PASSWORD = 'DevPassword@2025!';

type RoleName = 'Management' | 'Teacher' | 'Parent' | 'Student';
type ReviewStatus = 'approved' | 'pending_review' | 'rejected' | 'draft';

interface CourseSeed {
  code: string;
  name: string;
  category: string;
  subject: string;
  gradeLevels: string[];
  description: string;
  objectives: string;
  section: string;
  room: string;
  schedule: Array<{
    day: string;
    startTime: string;
    endTime: string;
    room: string;
  }>;
  teacherEmail?: string;
}

interface StudentSeed {
  email: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  admissionNumber: string;
  gradeLevel: string;
  guardianEmail?: string;
  guardianRole?: RoleName;
  enrollIn: string[];
  attendance: Array<'present' | 'late' | 'absent' | 'excused'>;
}

interface TenantScenario {
  slug: string;
  domain: string;
  academicYear: {
    name: string;
    startDate: Date;
    endDate: Date;
  };
  term: {
    name: string;
    type: string;
    order: number;
    startDate: Date;
    endDate: Date;
  };
  personaNames: Array<{
    email: string;
    firstName: string;
    lastName: string;
  }>;
  courses: CourseSeed[];
  students: StudentSeed[];
}

interface ProfileRef {
  userId: string;
  profileId: string;
}

const GRADE_SCALE = {
  A1: { min: 75, max: 100, points: 4.0 },
  B2: { min: 70, max: 74.99, points: 3.5 },
  B3: { min: 65, max: 69.99, points: 3.25 },
  C4: { min: 60, max: 64.99, points: 3.0 },
  C5: { min: 55, max: 59.99, points: 2.75 },
  C6: { min: 50, max: 54.99, points: 2.5 },
  D7: { min: 45, max: 49.99, points: 2.0 },
  E8: { min: 40, max: 44.99, points: 1.5 },
  F9: { min: 0, max: 39.99, points: 0 },
};

const SCENARIOS: TenantScenario[] = [
  {
    slug: 'greenfield-secondary',
    domain: 'greenfield.test',
    academicYear: {
      name: '2026-2027',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2027-06-30T00:00:00.000Z'),
    },
    term: {
      name: 'First Term 2026',
      type: 'term',
      order: 1,
      startDate: new Date('2026-07-06T00:00:00.000Z'),
      endDate: new Date('2026-09-25T00:00:00.000Z'),
    },
    personaNames: [
      { email: 'principal@greenfield.test', firstName: 'Miriam', lastName: 'Danjuma' },
      { email: 'teacher@greenfield.test', firstName: 'Nkechi', lastName: 'Bello' },
      { email: 'parent@greenfield.test', firstName: 'Ifeoma', lastName: 'Adewale' },
      { email: 'student@greenfield.test', firstName: 'Kamsi', lastName: 'Adewale' },
    ],
    courses: [
      {
        code: 'MATH-101',
        name: 'Mathematics',
        category: 'Mathematics',
        subject: 'Mathematics',
        gradeLevels: ['JSS1', 'JSS2', 'JSS3'],
        description: 'Number sense, expressions, equations and practical problem solving.',
        objectives: 'Students simplify expressions, solve one-step equations and explain reasoning.',
        section: 'JSS2-A',
        room: 'Block B - Room 201',
        teacherEmail: 'teacher@greenfield.test',
        schedule: [
          { day: 'Monday', startTime: '08:00', endTime: '08:45', room: 'Block B - Room 201' },
          { day: 'Wednesday', startTime: '09:00', endTime: '09:45', room: 'Block B - Room 201' },
          { day: 'Friday', startTime: '10:00', endTime: '10:45', room: 'Block B - Room 201' },
        ],
      },
      {
        code: 'SCI-101',
        name: 'Basic Science',
        category: 'Sciences',
        subject: 'Basic Science',
        gradeLevels: ['JSS1', 'JSS2', 'JSS3'],
        description: 'Living things, energy, matter and hands-on scientific inquiry.',
        objectives: 'Students describe photosynthesis and connect plant structures to functions.',
        section: 'JSS2-A',
        room: 'Science Lab 1',
        teacherEmail: 'teacher@greenfield.test',
        schedule: [
          { day: 'Tuesday', startTime: '08:00', endTime: '08:45', room: 'Science Lab 1' },
          { day: 'Thursday', startTime: '11:00', endTime: '11:45', room: 'Science Lab 1' },
        ],
      },
      {
        code: 'ENG-101',
        name: 'English Language',
        category: 'Languages',
        subject: 'English Language',
        gradeLevels: ['JSS1', 'JSS2', 'JSS3', 'SSS1', 'SSS2', 'SSS3'],
        description: 'Reading comprehension, vocabulary, grammar and composition.',
        objectives: 'Students identify main ideas, infer meaning and justify answers from text.',
        section: 'JSS2-A',
        room: 'Block A - Room 104',
        teacherEmail: 'multi@schoolwithease.test',
        schedule: [
          { day: 'Monday', startTime: '11:00', endTime: '11:45', room: 'Block A - Room 104' },
          { day: 'Thursday', startTime: '09:00', endTime: '09:45', room: 'Block A - Room 104' },
        ],
      },
      {
        code: 'ECO-201',
        name: 'Economics',
        category: 'Social Sciences',
        subject: 'Economics',
        gradeLevels: ['SSS1', 'SSS2', 'SSS3'],
        description: 'Basic economic concepts, demand, supply and household decision making.',
        objectives: 'Students interpret simple demand schedules and explain scarcity.',
        section: 'SSS1-A',
        room: 'Block C - Room 303',
        schedule: [
          { day: 'Tuesday', startTime: '12:00', endTime: '12:45', room: 'Block C - Room 303' },
        ],
      },
    ],
    students: [
      {
        email: 'student@greenfield.test',
        firstName: 'Kamsi',
        lastName: 'Adewale',
        studentNumber: 'STU-DEV-001',
        admissionNumber: 'ADM-DEV-001',
        gradeLevel: 'JSS2',
        guardianEmail: 'parent@greenfield.test',
        guardianRole: 'Parent',
        enrollIn: ['MATH-101', 'SCI-101', 'ENG-101'],
        attendance: ['present', 'present', 'late', 'present', 'present'],
      },
      {
        email: 'child2@greenfield.test',
        firstName: 'Chidi',
        lastName: 'Profile',
        studentNumber: 'STU-DEV-102',
        admissionNumber: 'ADM-DEV-102',
        gradeLevel: 'JSS2',
        guardianEmail: 'multi@schoolwithease.test',
        guardianRole: 'Parent',
        enrollIn: ['MATH-101', 'SCI-101', 'ENG-101'],
        attendance: ['present', 'late', 'absent', 'present', 'present'],
      },
      {
        email: 'maya@greenfield.test',
        firstName: 'Maya',
        lastName: 'Okafor',
        studentNumber: 'STU-DEV-201',
        admissionNumber: 'ADM-DEV-201',
        gradeLevel: 'JSS2',
        enrollIn: ['MATH-101', 'SCI-101'],
        attendance: ['present', 'present', 'present', 'present', 'late'],
      },
      {
        email: 'child3@greenfield.test',
        firstName: 'Ngozi',
        lastName: 'Profile',
        studentNumber: 'STU-DEV-103',
        admissionNumber: 'ADM-DEV-103',
        gradeLevel: 'SSS1',
        guardianEmail: 'multi@schoolwithease.test',
        guardianRole: 'Parent',
        enrollIn: ['ECO-201'],
        attendance: ['present', 'present', 'present', 'present', 'present'],
      },
    ],
  },
  {
    slug: 'sunrise-primary',
    domain: 'sunrise.test',
    academicYear: {
      name: '2026-2027',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2027-06-30T00:00:00.000Z'),
    },
    term: {
      name: 'First Term 2026',
      type: 'term',
      order: 1,
      startDate: new Date('2026-07-06T00:00:00.000Z'),
      endDate: new Date('2026-09-25T00:00:00.000Z'),
    },
    personaNames: [
      { email: 'principal@sunrise.test', firstName: 'Amina', lastName: 'Yusuf' },
      { email: 'teacher@sunrise.test', firstName: 'Tunde', lastName: 'Salami' },
      { email: 'parent@sunrise.test', firstName: 'Bisi', lastName: 'Adeyemi' },
      { email: 'student@sunrise.test', firstName: 'Tomi', lastName: 'Adeyemi' },
    ],
    courses: [
      {
        code: 'MATH-P1',
        name: 'Numeracy',
        category: 'Mathematics',
        subject: 'Numeracy',
        gradeLevels: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
        description: 'Whole numbers, fractions, word problems and everyday measurement.',
        objectives: 'Pupils compare fractions and solve one-step word problems.',
        section: 'P5-A',
        room: 'Primary Block - P5A',
        teacherEmail: 'teacher@sunrise.test',
        schedule: [
          { day: 'Monday', startTime: '08:30', endTime: '09:10', room: 'Primary Block - P5A' },
          { day: 'Wednesday', startTime: '08:30', endTime: '09:10', room: 'Primary Block - P5A' },
        ],
      },
      {
        code: 'SCI-P1',
        name: 'Basic Science',
        category: 'Sciences',
        subject: 'Basic Science',
        gradeLevels: ['P3', 'P4', 'P5', 'P6'],
        description: 'Plants, animals, weather and simple experiments.',
        objectives: 'Pupils identify plant parts and explain what plants need to grow.',
        section: 'P5-A',
        room: 'Primary Science Corner',
        teacherEmail: 'teacher@sunrise.test',
        schedule: [
          { day: 'Tuesday', startTime: '10:00', endTime: '10:40', room: 'Primary Science Corner' },
        ],
      },
      {
        code: 'ENG-P1',
        name: 'Literacy',
        category: 'Languages',
        subject: 'Literacy',
        gradeLevels: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
        description: 'Reading fluency, comprehension and short writing.',
        objectives: 'Pupils identify story sequence and answer evidence-based questions.',
        section: 'P5-A',
        room: 'Primary Block - P5A',
        teacherEmail: 'multi@schoolwithease.test',
        schedule: [
          { day: 'Thursday', startTime: '08:30', endTime: '09:10', room: 'Primary Block - P5A' },
        ],
      },
      {
        code: 'SOC-P1',
        name: 'Social Studies',
        category: 'Social Sciences',
        subject: 'Social Studies',
        gradeLevels: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
        description: 'Community, citizenship and personal responsibility.',
        objectives: 'Pupils describe community helpers and respectful civic behavior.',
        section: 'P5-A',
        room: 'Primary Block - P5B',
        schedule: [
          { day: 'Friday', startTime: '09:20', endTime: '10:00', room: 'Primary Block - P5B' },
        ],
      },
    ],
    students: [
      {
        email: 'student@sunrise.test',
        firstName: 'Tomi',
        lastName: 'Adeyemi',
        studentNumber: 'STU-DEV-001',
        admissionNumber: 'ADM-DEV-001',
        gradeLevel: 'P5',
        guardianEmail: 'parent@sunrise.test',
        guardianRole: 'Parent',
        enrollIn: ['MATH-P1', 'SCI-P1', 'ENG-P1'],
        attendance: ['present', 'present', 'present', 'late', 'present'],
      },
      {
        email: 'child4@sunrise.test',
        firstName: 'Tayo',
        lastName: 'Profile',
        studentNumber: 'STU-DEV-104',
        admissionNumber: 'ADM-DEV-104',
        gradeLevel: 'P5',
        guardianEmail: 'multi@schoolwithease.test',
        guardianRole: 'Parent',
        enrollIn: ['MATH-P1', 'SCI-P1', 'ENG-P1'],
        attendance: ['present', 'present', 'late', 'present', 'absent'],
      },
      {
        email: 'zainab@sunrise.test',
        firstName: 'Zainab',
        lastName: 'Lawal',
        studentNumber: 'STU-DEV-202',
        admissionNumber: 'ADM-DEV-202',
        gradeLevel: 'P5',
        enrollIn: ['MATH-P1', 'SCI-P1'],
        attendance: ['present', 'present', 'present', 'present', 'present'],
      },
    ],
  },
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function roleId(name: RoleName): Promise<string> {
  const role = await prisma.role.findFirst({
    where: { name, isSystemRole: true },
    select: { id: true },
  });
  if (!role) {
    throw new Error(`Missing ${name} role. Run db:seed before dev academic seed.`);
  }
  return role.id;
}

async function upsertUser(
  email: string,
  firstName: string,
  lastName: string,
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email },
    update: { firstName, lastName, isActive: true, isVerified: true },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      isActive: true,
      isVerified: true,
    },
  });
}

async function ensureProfile(
  tenantId: string,
  email: string,
  roleName: RoleName,
  passwordHash: string,
  firstName?: string,
  lastName?: string,
): Promise<ProfileRef> {
  const role = await roleId(roleName);
  const user = await upsertUser(
    email,
    firstName ?? email.split('@')[0] ?? 'Dev',
    lastName ?? 'Persona',
    passwordHash,
  );

  const existing = await prisma.userTenant.findFirst({
    where: {
      userId: user.id,
      tenantId,
      userTenantRole: { roleId: role },
    },
    select: { id: true },
  });
  if (existing) return { userId: user.id, profileId: existing.id };

  const profile = await prisma.userTenant.create({
    data: { userId: user.id, tenantId, status: 'active', suspended: false },
    select: { id: true },
  });

  await prisma.userTenantRole.create({
    data: {
      userTenantId: profile.id,
      roleId: role,
      tenantId,
      isPrimary: true,
    },
  });

  return { userId: user.id, profileId: profile.id };
}

async function updatePersonaNames(scenario: TenantScenario, passwordHash: string) {
  for (const persona of scenario.personaNames) {
    await upsertUser(
      persona.email,
      persona.firstName,
      persona.lastName,
      passwordHash,
    );
  }
}

async function resetAcademicWorkflow(tenantId: string) {
  await prisma.assessmentSubmission.deleteMany({ where: { tenantId } });
  await prisma.grade.deleteMany({ where: { tenantId } });
  await prisma.assessmentQuestion.deleteMany({ where: { tenantId } });
  await prisma.assessment.deleteMany({ where: { tenantId } });
  await prisma.question.deleteMany({ where: { tenantId } });
  await prisma.materialChunk.deleteMany({ where: { tenantId } });
  await prisma.lessonMaterial.deleteMany({ where: { tenantId } });
  await prisma.lesson.deleteMany({ where: { tenantId } });
  await prisma.attendanceRecord.deleteMany({ where: { tenantId } });
  await prisma.classTeacher.deleteMany({ where: { tenantId } });
  await prisma.enrollment.deleteMany({ where: { tenantId } });
  await prisma.class.deleteMany({ where: { tenantId } });
}

async function seedAcademicCalendar(tenantId: string, scenario: TenantScenario) {
  await prisma.academicYear.updateMany({
    where: { tenantId, isDefault: true },
    data: { isDefault: false },
  });

  const academicYear = await prisma.academicYear.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: scenario.academicYear.name,
      },
    },
    update: {
      startDate: scenario.academicYear.startDate,
      endDate: scenario.academicYear.endDate,
      status: 'active',
      isDefault: true,
      description: 'Current dev academic year for end-to-end workflow testing.',
    },
    create: {
      tenantId,
      name: scenario.academicYear.name,
      startDate: scenario.academicYear.startDate,
      endDate: scenario.academicYear.endDate,
      status: 'active',
      isDefault: true,
      description: 'Current dev academic year for end-to-end workflow testing.',
    },
  });

  const term = await prisma.term.upsert({
    where: {
      academicYearId_name: {
        academicYearId: academicYear.id,
        name: scenario.term.name,
      },
    },
    update: {
      tenantId,
      startDate: scenario.term.startDate,
      endDate: scenario.term.endDate,
      order: scenario.term.order,
      status: 'active',
    },
    create: {
      academicYearId: academicYear.id,
      tenantId,
      name: scenario.term.name,
      type: scenario.term.type,
      startDate: scenario.term.startDate,
      endDate: scenario.term.endDate,
      order: scenario.term.order,
      status: 'active',
    },
  });

  return { academicYear, term };
}

async function seedGradingSystem(tenantId: string) {
  await prisma.gradingSystem.updateMany({
    where: { tenantId, isDefault: true },
    data: { isDefault: false },
  });

  return prisma.gradingSystem.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: 'WAEC-style Continuous Assessment',
      },
    },
    update: {
      systemType: 'letter_grade',
      gradeScale: GRADE_SCALE,
      isDefault: true,
      isActive: true,
      description: 'Dev grading scale used by seeded assessments and reports.',
    },
    create: {
      tenantId,
      name: 'WAEC-style Continuous Assessment',
      systemType: 'letter_grade',
      gradeScale: GRADE_SCALE,
      isDefault: true,
      isActive: true,
      description: 'Dev grading scale used by seeded assessments and reports.',
    },
  });
}

async function seedCoursesAndClasses(
  tenantId: string,
  scenario: TenantScenario,
  academicYearId: string,
  termId: string,
  passwordHash: string,
) {
  const courses = new Map<string, { id: string }>();
  const classes = new Map<string, { id: string }>();
  const teacherProfiles = new Map<string, ProfileRef>();

  for (const item of scenario.courses) {
    const course = await prisma.course.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: item.code,
        },
      },
      update: {
        name: item.name,
        category: item.category,
        subject: item.subject,
        gradeLevels: item.gradeLevels,
        description: item.description,
        objectives: item.objectives,
        status: 'active',
      },
      create: {
        tenantId,
        code: item.code,
        name: item.name,
        category: item.category,
        subject: item.subject,
        gradeLevels: item.gradeLevels,
        description: item.description,
        objectives: item.objectives,
        status: 'active',
      },
      select: { id: true },
    });
    courses.set(item.code, course);

    const klass = await prisma.class.create({
      data: {
        tenantId,
        courseId: course.id,
        termId,
        academicYearId,
        section: item.section,
        name: `${item.name} ${item.section}`,
        capacity: 32,
        currentEnrollment: 0,
        schedule: item.schedule,
        room: item.room,
        status: 'active',
        description: `${item.name} offering for ${item.section}.`,
      },
      select: { id: true },
    });
    classes.set(item.code, klass);

    if (item.teacherEmail) {
      const teacher =
        teacherProfiles.get(item.teacherEmail) ??
        (await ensureProfile(
          tenantId,
          item.teacherEmail,
          'Teacher',
          passwordHash,
        ));
      teacherProfiles.set(item.teacherEmail, teacher);

      await prisma.classTeacher.create({
        data: {
          tenantId,
          classId: klass.id,
          userTenantId: teacher.profileId,
          role: 'teacher',
          isActive: true,
          assignedAt: new Date('2026-07-03T09:00:00.000Z'),
        },
      });
    }
  }

  return { courses, classes, teacherProfiles };
}

async function seedStudents(
  tenantId: string,
  scenario: TenantScenario,
  classByCourse: Map<string, { id: string }>,
  academicYearId: string,
  termId: string,
  passwordHash: string,
) {
  const students = new Map<string, { id: string; profileId: string }>();

  for (const item of scenario.students) {
    const profile = await ensureProfile(
      tenantId,
      item.email,
      'Student',
      passwordHash,
      item.firstName,
      item.lastName,
    );

    const student = await prisma.student.upsert({
      where: {
        tenantId_studentNumber: {
          tenantId,
          studentNumber: item.studentNumber,
        },
      },
      update: {
        userTenantId: profile.profileId,
        admissionNumber: item.admissionNumber,
        gradeLevel: item.gradeLevel,
        enrollmentStatus: 'active',
        personalInfo: {
          displayName: `${item.firstName} ${item.lastName}`,
          devSeed: true,
        },
        academicInfo: {
          cohort: scenario.term.name,
          devSeed: true,
        },
      },
      create: {
        tenantId,
        userTenantId: profile.profileId,
        studentNumber: item.studentNumber,
        admissionNumber: item.admissionNumber,
        gradeLevel: item.gradeLevel,
        enrollmentStatus: 'active',
        enrollmentDate: new Date('2026-07-06T00:00:00.000Z'),
        personalInfo: {
          displayName: `${item.firstName} ${item.lastName}`,
          devSeed: true,
        },
        academicInfo: {
          cohort: scenario.term.name,
          devSeed: true,
        },
      },
      select: { id: true },
    });

    students.set(item.studentNumber, {
      id: student.id,
      profileId: profile.profileId,
    });

    if (item.guardianEmail && item.guardianRole) {
      const guardian = await ensureProfile(
        tenantId,
        item.guardianEmail,
        item.guardianRole,
        passwordHash,
      );

      await prisma.studentGuardian.upsert({
        where: {
          studentId_userTenantId: {
            studentId: student.id,
            userTenantId: guardian.profileId,
          },
        },
        update: {
          relationship: 'parent',
          isPrimary: true,
          legalGuardian: true,
          contactPriority: 1,
        },
        create: {
          tenantId,
          studentId: student.id,
          userTenantId: guardian.profileId,
          relationship: 'parent',
          isPrimary: true,
          legalGuardian: true,
          contactPriority: 1,
        },
      });
    }

    for (const courseCode of item.enrollIn) {
      const klass = classByCourse.get(courseCode);
      if (!klass) continue;

      await prisma.enrollment.create({
        data: {
          tenantId,
          studentId: student.id,
          classId: klass.id,
          academicYearId,
          termId,
          status: 'active',
          enrollmentDate: new Date('2026-07-06T00:00:00.000Z'),
        },
      });
    }
  }

  for (const klass of classByCourse.values()) {
    const count = await prisma.enrollment.count({
      where: { classId: klass.id, status: 'active' },
    });
    await prisma.class.update({
      where: { id: klass.id },
      data: { currentEnrollment: count },
    });
  }

  return students;
}

async function seedAttendance(
  tenantId: string,
  scenario: TenantScenario,
  classByCourse: Map<string, { id: string }>,
  students: Map<string, { id: string }>,
) {
  const dates = [
    new Date('2026-07-06T00:00:00.000Z'),
    new Date('2026-07-07T00:00:00.000Z'),
    new Date('2026-07-08T00:00:00.000Z'),
    new Date('2026-07-09T00:00:00.000Z'),
    new Date('2026-07-10T00:00:00.000Z'),
  ];

  for (const item of scenario.students) {
    const student = students.get(item.studentNumber);
    if (!student) continue;

    for (const courseCode of item.enrollIn) {
      const klass = classByCourse.get(courseCode);
      if (!klass) continue;

      for (let i = 0; i < dates.length; i++) {
        await prisma.attendanceRecord.create({
          data: {
            tenantId,
            studentId: student.id,
            classId: klass.id,
            date: dates[i]!,
            status: item.attendance[i] ?? 'present',
            notes:
              item.attendance[i] === 'late'
                ? 'Arrived after morning assembly'
                : null,
          },
        });
      }
    }
  }
}

async function seedLessonWithMaterials(args: {
  tenantId: string;
  classId: string;
  creator: ProfileRef;
  reviewer: ProfileRef;
  title: string;
  description: string;
  content: string;
  order: number;
  status: 'draft' | 'published';
  reviewStatus: ReviewStatus;
  materialTitle: string;
  materialStatus: Exclude<ReviewStatus, 'draft'>;
  chunks: string[];
}) {
  const reviewed = args.materialStatus === 'pending_review' ? null : new Date('2026-07-08T12:00:00.000Z');
  const lesson = await prisma.lesson.create({
    data: {
      tenantId: args.tenantId,
      classId: args.classId,
      title: args.title,
      description: args.description,
      content: args.content,
      order: args.order,
      status: args.status,
      reviewStatus: args.reviewStatus,
      submittedForReviewAt:
        args.reviewStatus === 'draft'
          ? null
          : new Date('2026-07-07T15:30:00.000Z'),
      reviewedBy:
        args.reviewStatus === 'approved' || args.reviewStatus === 'rejected'
          ? args.reviewer.profileId
          : null,
      reviewedAt:
        args.reviewStatus === 'approved' || args.reviewStatus === 'rejected'
          ? new Date('2026-07-08T10:00:00.000Z')
          : null,
      reviewNote:
        args.reviewStatus === 'rejected'
          ? 'Add clearer worked examples before publishing.'
          : null,
      createdBy: args.creator.userId,
      updatedBy: args.creator.userId,
    },
    select: { id: true },
  });

  const material = await prisma.lessonMaterial.create({
    data: {
      tenantId: args.tenantId,
      lessonId: lesson.id,
      title: args.materialTitle,
      fileName: `${args.materialTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 184_000,
      storageKey: `dev-seed/${args.tenantId}/${lesson.id}.pdf`,
      category: 'document',
      reviewStatus: args.materialStatus,
      reviewedBy: reviewed ? args.reviewer.profileId : null,
      reviewedAt: reviewed,
      reviewNote:
        args.materialStatus === 'rejected'
          ? 'Replace the copied worksheet with original practice items.'
          : null,
      extractionStatus:
        args.materialStatus === 'approved' && args.chunks.length > 0
          ? 'completed'
          : 'skipped',
      chunkCount: args.materialStatus === 'approved' ? args.chunks.length : 0,
      createdBy: args.creator.userId,
      updatedBy: args.creator.userId,
    },
    select: { id: true },
  });

  if (args.materialStatus === 'approved') {
    for (let i = 0; i < args.chunks.length; i++) {
      await prisma.materialChunk.create({
        data: {
          tenantId: args.tenantId,
          lessonId: lesson.id,
          materialId: material.id,
          chunkIndex: i,
          content: args.chunks[i]!,
          metadata: { source: 'dev-academic-seed', page: i + 1 },
        },
      });
    }
  }
}

function option(label: string, text: string) {
  return { label, text };
}

async function createQuestion(args: {
  tenantId: string;
  courseId: string;
  creator: ProfileRef;
  style: 'mcq' | 'true_false' | 'short_answer' | 'essay';
  text: string;
  correctAnswer?: string;
  solution?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  options?: Array<{ label: string; text: string }>;
}) {
  return prisma.question.create({
    data: {
      tenantId: args.tenantId,
      courseId: args.courseId,
      style: args.style,
      instruction:
        args.style === 'mcq'
          ? 'Choose the correct option.'
          : args.style === 'true_false'
            ? 'Choose true or false.'
            : 'Write your answer clearly.',
      text: args.text,
      options: args.options ?? undefined,
      correctAnswer: args.correctAnswer ?? null,
      solution: args.solution ?? null,
      difficulty: args.difficulty,
      createdBy: args.creator.userId,
      updatedBy: args.creator.userId,
    },
    select: { id: true },
  });
}

async function seedLessonsAndQuestions(args: {
  tenantId: string;
  scenario: TenantScenario;
  classByCourse: Map<string, { id: string }>;
  courseByCode: Map<string, { id: string }>;
  teacherProfiles: Map<string, ProfileRef>;
  reviewer: ProfileRef;
}) {
  const defaultTeacher =
    args.teacherProfiles.get(`teacher@${args.scenario.domain}`) ??
    [...args.teacherProfiles.values()][0];
  const multiTeacher = args.teacherProfiles.get('multi@schoolwithease.test');
  if (!defaultTeacher) throw new Error(`No default teacher for ${args.scenario.slug}`);

  const mathCode = args.scenario.slug === 'greenfield-secondary' ? 'MATH-101' : 'MATH-P1';
  const scienceCode = args.scenario.slug === 'greenfield-secondary' ? 'SCI-101' : 'SCI-P1';
  const englishCode = args.scenario.slug === 'greenfield-secondary' ? 'ENG-101' : 'ENG-P1';

  await seedLessonWithMaterials({
    tenantId: args.tenantId,
    classId: args.classByCourse.get(mathCode)!.id,
    creator: defaultTeacher,
    reviewer: args.reviewer,
    title:
      args.scenario.slug === 'greenfield-secondary'
        ? 'Linear Expressions and Balancing Equations'
        : 'Comparing Fractions with Everyday Objects',
    description: 'Core lesson that the open assessment is based on.',
    content:
      args.scenario.slug === 'greenfield-secondary'
        ? 'Students model expressions with counters, simplify like terms, and solve one-step equations by doing the same operation to both sides.'
        : 'Pupils compare fractions using strips, number lines, and familiar sharing problems before choosing equivalent fractions.',
    order: 1,
    status: 'published',
    reviewStatus: 'approved',
    materialTitle: 'Worked Examples and Practice',
    materialStatus: 'approved',
    chunks: [
      'Like terms have the same variable part. 3x and 5x can be combined to make 8x.',
      'An equation stays balanced when the same operation is applied to both sides.',
    ],
  });

  await seedLessonWithMaterials({
    tenantId: args.tenantId,
    classId: args.classByCourse.get(scienceCode)!.id,
    creator: defaultTeacher,
    reviewer: args.reviewer,
    title:
      args.scenario.slug === 'greenfield-secondary'
        ? 'Photosynthesis: Light, Chlorophyll and Food'
        : 'Parts of a Plant and What They Do',
    description: 'Science lesson with approved content and a pending follow-up material.',
    content:
      args.scenario.slug === 'greenfield-secondary'
        ? 'Plants use light energy, carbon dioxide and water to make glucose. Chlorophyll traps light energy in green leaves.'
        : 'Roots absorb water, stems carry water, leaves make food, and flowers help plants reproduce.',
    order: 2,
    status: 'published',
    reviewStatus: 'approved',
    materialTitle: 'Science Notebook Guide',
    materialStatus: 'approved',
    chunks: [
      'Photosynthesis is the process by which green plants make food using light.',
      'Chlorophyll is the green pigment that helps leaves trap energy from sunlight.',
    ],
  });

  await seedLessonWithMaterials({
    tenantId: args.tenantId,
    classId: args.classByCourse.get(scienceCode)!.id,
    creator: defaultTeacher,
    reviewer: args.reviewer,
    title: 'Lab Safety and Observation Notes',
    description: 'Pending review item for the academic review queue.',
    content: 'Students prepare observation tables and safety notes before the practical.',
    order: 3,
    status: 'draft',
    reviewStatus: 'pending_review',
    materialTitle: 'Lab Observation Sheet',
    materialStatus: 'pending_review',
    chunks: [],
  });

  if (multiTeacher) {
    await seedLessonWithMaterials({
      tenantId: args.tenantId,
      classId: args.classByCourse.get(englishCode)!.id,
      creator: multiTeacher,
      reviewer: args.reviewer,
      title: 'Main Idea and Supporting Evidence',
      description: 'Lesson owned by the multi-profile teacher, not the default teacher.',
      content: 'Students read a short passage, identify the central idea, and underline evidence that supports their answer.',
      order: 1,
      status: 'draft',
      reviewStatus: 'rejected',
      materialTitle: 'Comprehension Worksheet Draft',
      materialStatus: 'rejected',
      chunks: [],
    });
  }

  const mathCourse = args.courseByCode.get(mathCode)!;
  const scienceCourse = args.courseByCode.get(scienceCode)!;
  const englishCourse = args.courseByCode.get(englishCode)!;

  const mathQuestions = [
    await createQuestion({
      tenantId: args.tenantId,
      courseId: mathCourse.id,
      creator: defaultTeacher,
      style: 'mcq',
      text:
        args.scenario.slug === 'greenfield-secondary'
          ? 'Simplify 3x + 5x.'
          : 'Which fraction is equal to one half?',
      options:
        args.scenario.slug === 'greenfield-secondary'
          ? [option('A', '8x'), option('B', '15x'), option('C', '2x'), option('D', 'x8')]
          : [option('A', '2/4'), option('B', '1/3'), option('C', '3/5'), option('D', '4/6')],
      correctAnswer: 'A',
      solution:
        args.scenario.slug === 'greenfield-secondary'
          ? '3x and 5x are like terms, so 3 + 5 = 8.'
          : 'Two out of four equal parts is the same as one out of two.',
      difficulty: 'easy',
    }),
    await createQuestion({
      tenantId: args.tenantId,
      courseId: mathCourse.id,
      creator: defaultTeacher,
      style: 'mcq',
      text:
        args.scenario.slug === 'greenfield-secondary'
          ? 'Solve x + 7 = 12.'
          : 'A cake is cut into 8 equal slices. Tomi eats 2. What fraction did Tomi eat?',
      options:
        args.scenario.slug === 'greenfield-secondary'
          ? [option('A', '5'), option('B', '7'), option('C', '12'), option('D', '19')]
          : [option('A', '2/8'), option('B', '8/2'), option('C', '6/8'), option('D', '1/8')],
      correctAnswer: 'A',
      solution:
        args.scenario.slug === 'greenfield-secondary'
          ? 'Subtract 7 from both sides: x = 5.'
          : 'The eaten part is 2 of the 8 equal slices.',
      difficulty: 'medium',
    }),
    await createQuestion({
      tenantId: args.tenantId,
      courseId: mathCourse.id,
      creator: defaultTeacher,
      style: 'true_false',
      text:
        args.scenario.slug === 'greenfield-secondary'
          ? '2a + 3b can be simplified to 5ab.'
          : 'One quarter is smaller than one half.',
      correctAnswer:
        args.scenario.slug === 'greenfield-secondary' ? 'false' : 'true',
      solution:
        args.scenario.slug === 'greenfield-secondary'
          ? 'The terms are not like terms because the variable parts differ.'
          : 'A quarter is one of four equal parts, while a half is one of two.',
      difficulty: 'medium',
    }),
  ];

  const scienceQuestions = [
    await createQuestion({
      tenantId: args.tenantId,
      courseId: scienceCourse.id,
      creator: defaultTeacher,
      style: 'mcq',
      text:
        args.scenario.slug === 'greenfield-secondary'
          ? 'Which pigment helps leaves trap sunlight?'
          : 'Which part of a plant absorbs water from the soil?',
      options:
        args.scenario.slug === 'greenfield-secondary'
          ? [option('A', 'Chlorophyll'), option('B', 'Protein'), option('C', 'Calcium'), option('D', 'Starch')]
          : [option('A', 'Root'), option('B', 'Flower'), option('C', 'Fruit'), option('D', 'Seed')],
      correctAnswer: 'A',
      solution:
        args.scenario.slug === 'greenfield-secondary'
          ? 'Chlorophyll is the green pigment in leaves.'
          : 'Roots take in water and minerals from soil.',
      difficulty: 'easy',
    }),
    await createQuestion({
      tenantId: args.tenantId,
      courseId: scienceCourse.id,
      creator: defaultTeacher,
      style: 'true_false',
      text:
        args.scenario.slug === 'greenfield-secondary'
          ? 'Plants need carbon dioxide and water for photosynthesis.'
          : 'Leaves help many plants make food.',
      correctAnswer: 'true',
      solution: 'This matches the lesson notes.',
      difficulty: 'easy',
    }),
    await createQuestion({
      tenantId: args.tenantId,
      courseId: scienceCourse.id,
      creator: defaultTeacher,
      style: 'essay',
      text:
        args.scenario.slug === 'greenfield-secondary'
          ? 'Explain why a plant kept in the dark may not grow well.'
          : 'Explain why roots and leaves are both important to a plant.',
      solution: 'A strong answer connects the plant part or condition to food, water or growth.',
      difficulty: 'hard',
    }),
  ];

  const englishQuestions =
    multiTeacher === undefined
      ? []
      : [
          await createQuestion({
            tenantId: args.tenantId,
            courseId: englishCourse.id,
            creator: multiTeacher,
            style: 'mcq',
            text: 'What is the main idea of a passage?',
            options: [
              option('A', 'The most important point'),
              option('B', 'The last sentence only'),
              option('C', 'A difficult word'),
              option('D', 'The title font'),
            ],
            correctAnswer: 'A',
            solution: 'The main idea is the central point the writer wants the reader to understand.',
            difficulty: 'easy',
          }),
        ];

  return { mathQuestions, scienceQuestions, englishQuestions };
}

function letterFor(percentage: number) {
  for (const [letter, range] of Object.entries(GRADE_SCALE)) {
    if (percentage >= range.min && percentage <= range.max) {
      return { letterGrade: letter, gpaPoints: range.points };
    }
  }
  return { letterGrade: 'F9', gpaPoints: 0 };
}

async function createAssessmentWithPaper(args: {
  tenantId: string;
  classId: string;
  academicYearId: string;
  termId: string;
  gradingSystemId: string;
  creator: ProfileRef;
  name: string;
  type: string;
  status: string;
  maxPoints: number;
  weight: number;
  instructions: string;
  durationMinutes: number;
  maxAttempts: number;
  questionIds: string[];
}) {
  const assessment = await prisma.assessment.create({
    data: {
      tenantId: args.tenantId,
      classId: args.classId,
      academicYearId: args.academicYearId,
      termId: args.termId,
      gradingSystemId: args.gradingSystemId,
      name: args.name,
      type: args.type,
      status: args.status,
      maxPoints: args.maxPoints,
      weight: args.weight,
      assignedDate: new Date('2026-07-10T08:00:00.000Z'),
      dueDate:
        args.status === 'published'
          ? new Date('2026-08-28T23:59:59.000Z')
          : null,
      instructions: args.instructions,
      durationMinutes: args.durationMinutes,
      maxAttempts: args.maxAttempts,
      createdBy: args.creator.userId,
      updatedBy: args.creator.userId,
    },
    select: { id: true },
  });

  const points = args.maxPoints / args.questionIds.length;
  await prisma.assessmentQuestion.createMany({
    data: args.questionIds.map((questionId, index) => ({
      tenantId: args.tenantId,
      assessmentId: assessment.id,
      questionId,
      order: index + 1,
      points,
    })),
  });

  return assessment;
}

async function seedSubmission(args: {
  tenantId: string;
  assessmentId: string;
  classId: string;
  studentId: string;
  answers: Array<{ questionId: string; answer: string }>;
  pointsEarned: number;
  maxPoints: number;
  status: 'submitted' | 'graded';
  needsManualGrading: boolean;
  gradedBy?: string;
  feedback?: string;
}) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      tenantId: args.tenantId,
      classId: args.classId,
      studentId: args.studentId,
      status: 'active',
    },
    select: { id: true },
  });
  if (!enrollment) return;

  const percentage = args.needsManualGrading
    ? null
    : Math.round((args.pointsEarned / args.maxPoints) * 10000) / 100;

  const submission = await prisma.assessmentSubmission.create({
    data: {
      tenantId: args.tenantId,
      assessmentId: args.assessmentId,
      enrollmentId: enrollment.id,
      attempt: 1,
      answers: args.answers,
      pointsEarned: args.pointsEarned,
      maxPoints: args.maxPoints,
      percentage,
      needsManualGrading: args.needsManualGrading,
      status: args.status,
      startedAt: new Date('2026-07-15T09:00:00.000Z'),
      submittedAt: new Date('2026-07-15T09:18:00.000Z'),
      gradedAt:
        args.status === 'graded'
          ? new Date('2026-07-15T10:00:00.000Z')
          : null,
      gradedBy: args.status === 'graded' ? args.gradedBy ?? null : null,
    },
    select: { id: true },
  });

  if (args.status === 'graded' && percentage !== null) {
    const computed = letterFor(percentage);
    await prisma.grade.create({
      data: {
        tenantId: args.tenantId,
        enrollmentId: enrollment.id,
        assessmentId: args.assessmentId,
        pointsEarned: args.pointsEarned,
        percentage,
        letterGrade: computed.letterGrade,
        gpaPoints: computed.gpaPoints,
        status: 'graded',
        submittedAt: new Date('2026-07-15T09:18:00.000Z'),
        gradedAt: new Date('2026-07-15T10:00:00.000Z'),
        gradedBy: args.gradedBy ?? null,
        feedback: args.feedback ?? null,
      },
    });
  }

  return submission;
}

async function seedAssessments(args: {
  tenantId: string;
  scenario: TenantScenario;
  academicYearId: string;
  termId: string;
  gradingSystemId: string;
  classByCourse: Map<string, { id: string }>;
  teacherProfiles: Map<string, ProfileRef>;
  students: Map<string, { id: string }>;
  questions: Awaited<ReturnType<typeof seedLessonsAndQuestions>>;
}) {
  const defaultTeacher =
    args.teacherProfiles.get(`teacher@${args.scenario.domain}`) ??
    [...args.teacherProfiles.values()][0];
  const multiTeacher = args.teacherProfiles.get('multi@schoolwithease.test');
  if (!defaultTeacher) throw new Error(`No default teacher for ${args.scenario.slug}`);

  const mathCode = args.scenario.slug === 'greenfield-secondary' ? 'MATH-101' : 'MATH-P1';
  const scienceCode = args.scenario.slug === 'greenfield-secondary' ? 'SCI-101' : 'SCI-P1';
  const englishCode = args.scenario.slug === 'greenfield-secondary' ? 'ENG-101' : 'ENG-P1';
  const unassignedCode = args.scenario.slug === 'greenfield-secondary' ? 'ECO-201' : 'SOC-P1';

  const mathAssessment = await createAssessmentWithPaper({
    tenantId: args.tenantId,
    classId: args.classByCourse.get(mathCode)!.id,
    academicYearId: args.academicYearId,
    termId: args.termId,
    gradingSystemId: args.gradingSystemId,
    creator: defaultTeacher,
    name:
      args.scenario.slug === 'greenfield-secondary'
        ? 'Linear Expressions Quick Check'
        : 'Fractions Quick Check',
    type: 'quiz',
    status: 'published',
    maxPoints: 10,
    weight: 10,
    instructions: 'Answer all objective questions based on this week lesson.',
    durationMinutes: 20,
    maxAttempts: 2,
    questionIds: args.questions.mathQuestions.map((q) => q.id),
  });

  const scienceAssessment = await createAssessmentWithPaper({
    tenantId: args.tenantId,
    classId: args.classByCourse.get(scienceCode)!.id,
    academicYearId: args.academicYearId,
    termId: args.termId,
    gradingSystemId: args.gradingSystemId,
    creator: defaultTeacher,
    name:
      args.scenario.slug === 'greenfield-secondary'
        ? 'Photosynthesis Practical Reflection'
        : 'Plant Parts Reflection',
    type: 'assignment',
    status: 'published',
    maxPoints: 12,
    weight: 15,
    instructions: 'Answer the objective questions and write the reflection clearly.',
    durationMinutes: 30,
    maxAttempts: 1,
    questionIds: args.questions.scienceQuestions.map((q) => q.id),
  });

  await createAssessmentWithPaper({
    tenantId: args.tenantId,
    classId: args.classByCourse.get(mathCode)!.id,
    academicYearId: args.academicYearId,
    termId: args.termId,
    gradingSystemId: args.gradingSystemId,
    creator: defaultTeacher,
    name: 'End of Unit Test Draft',
    type: 'test',
    status: 'draft',
    maxPoints: 20,
    weight: 20,
    instructions: 'Draft assessment for teacher editing workflow.',
    durationMinutes: 45,
    maxAttempts: 1,
    questionIds: args.questions.mathQuestions.slice(0, 2).map((q) => q.id),
  });

  if (multiTeacher && args.questions.englishQuestions.length > 0) {
    await createAssessmentWithPaper({
      tenantId: args.tenantId,
      classId: args.classByCourse.get(englishCode)!.id,
      academicYearId: args.academicYearId,
      termId: args.termId,
      gradingSystemId: args.gradingSystemId,
      creator: multiTeacher,
      name: 'Main Idea Comprehension Check',
      type: 'quiz',
      status: 'published',
      maxPoints: 5,
      weight: 10,
      instructions: 'Read the passage and select the strongest answer.',
      durationMinutes: 15,
      maxAttempts: 1,
      questionIds: args.questions.englishQuestions.map((q) => q.id),
    });
  }

  await prisma.assessment.create({
    data: {
      tenantId: args.tenantId,
      classId: args.classByCourse.get(unassignedCode)!.id,
      academicYearId: args.academicYearId,
      termId: args.termId,
      gradingSystemId: args.gradingSystemId,
      name: 'Management-only Unassigned Class Diagnostic',
      type: 'quiz',
      status: 'draft',
      maxPoints: 10,
      weight: 5,
      instructions: 'Negative control: no teacher persona is allocated to this class.',
      durationMinutes: 15,
      maxAttempts: 1,
      createdBy: defaultTeacher.userId,
    },
  });

  const assessedStudents = [...args.students.values()];
  const firstStudent = assessedStudents[0];
  const secondStudent = assessedStudents[1];
  const thirdStudent = assessedStudents[2];

  if (secondStudent) {
    await seedSubmission({
      tenantId: args.tenantId,
      assessmentId: mathAssessment.id,
      classId: args.classByCourse.get(mathCode)!.id,
      studentId: secondStudent.id,
      answers: args.questions.mathQuestions.map((q, index) => ({
        questionId: q.id,
        answer: index === 2 ? 'true' : 'A',
      })),
      pointsEarned: 6.67,
      maxPoints: 10,
      status: 'graded',
      needsManualGrading: false,
      feedback: 'Good effort. Review the false/true reasoning question.',
    });
  }

  if (thirdStudent) {
    await seedSubmission({
      tenantId: args.tenantId,
      assessmentId: mathAssessment.id,
      classId: args.classByCourse.get(mathCode)!.id,
      studentId: thirdStudent.id,
      answers: args.questions.mathQuestions.map((q) => ({
        questionId: q.id,
        answer: 'A',
      })),
      pointsEarned: 10,
      maxPoints: 10,
      status: 'graded',
      needsManualGrading: false,
      feedback: 'Excellent accuracy and pacing.',
    });
  }

  if (firstStudent) {
    await seedSubmission({
      tenantId: args.tenantId,
      assessmentId: scienceAssessment.id,
      classId: args.classByCourse.get(scienceCode)!.id,
      studentId: firstStudent.id,
      answers: [
        { questionId: args.questions.scienceQuestions[0]!.id, answer: 'A' },
        { questionId: args.questions.scienceQuestions[1]!.id, answer: 'true' },
        {
          questionId: args.questions.scienceQuestions[2]!.id,
          answer: 'The plant may not make enough food because it has no light.',
        },
      ],
      pointsEarned: 8,
      maxPoints: 12,
      status: 'submitted',
      needsManualGrading: true,
    });
  }

  if (secondStudent) {
    await seedSubmission({
      tenantId: args.tenantId,
      assessmentId: scienceAssessment.id,
      classId: args.classByCourse.get(scienceCode)!.id,
      studentId: secondStudent.id,
      answers: [
        { questionId: args.questions.scienceQuestions[0]!.id, answer: 'A' },
        { questionId: args.questions.scienceQuestions[1]!.id, answer: 'true' },
        {
          questionId: args.questions.scienceQuestions[2]!.id,
          answer: 'It needs light so the leaf can make food.',
        },
      ],
      pointsEarned: 10,
      maxPoints: 12,
      status: 'graded',
      needsManualGrading: false,
      gradedBy: defaultTeacher.profileId,
      feedback: 'Clear explanation with the key idea included.',
    });
  }

  return { takeableAssessmentId: mathAssessment.id };
}

async function verifyScenario(tenantId: string) {
  const [
    classCount,
    assignmentCount,
    enrollmentCount,
    lessonCount,
    questionCount,
    assessmentCount,
    submissionCount,
    gradeCount,
  ] = await Promise.all([
    prisma.class.count({ where: { tenantId } }),
    prisma.classTeacher.count({ where: { tenantId, isActive: true } }),
    prisma.enrollment.count({ where: { tenantId, status: 'active' } }),
    prisma.lesson.count({ where: { tenantId } }),
    prisma.question.count({ where: { tenantId, isActive: true } }),
    prisma.assessment.count({ where: { tenantId } }),
    prisma.assessmentSubmission.count({ where: { tenantId } }),
    prisma.grade.count({ where: { tenantId } }),
  ]);

  const failures = [
    classCount < 4 ? `expected at least 4 classes, found ${classCount}` : null,
    assignmentCount < 3
      ? `expected at least 3 active teacher assignments, found ${assignmentCount}`
      : null,
    enrollmentCount < 7
      ? `expected at least 7 active enrollments, found ${enrollmentCount}`
      : null,
    lessonCount < 4 ? `expected at least 4 lessons, found ${lessonCount}` : null,
    questionCount < 7
      ? `expected at least 7 active questions, found ${questionCount}`
      : null,
    assessmentCount < 4
      ? `expected at least 4 assessments, found ${assessmentCount}`
      : null,
    submissionCount < 3
      ? `expected at least 3 submissions, found ${submissionCount}`
      : null,
    gradeCount < 2 ? `expected at least 2 grades, found ${gradeCount}` : null,
  ].filter((failure): failure is string => failure !== null);

  if (failures.length > 0) {
    throw new Error(`Academic seed verification failed:\n - ${failures.join('\n - ')}`);
  }

  return {
    classCount,
    assignmentCount,
    enrollmentCount,
    lessonCount,
    questionCount,
    assessmentCount,
    submissionCount,
    gradeCount,
  };
}

async function seedScenario(scenario: TenantScenario, passwordHash: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: scenario.slug },
    select: { id: true, name: true },
  });
  if (!tenant) {
    throw new Error(
      `Missing dev tenant ${scenario.slug}. Run db:seed:dev before db:seed:academics.`,
    );
  }

  console.log(`\n[dev-academics] Rebuilding ${tenant.name} (${scenario.slug})`);
  await updatePersonaNames(scenario, passwordHash);
  await resetAcademicWorkflow(tenant.id);

  const { academicYear, term } = await seedAcademicCalendar(tenant.id, scenario);
  const gradingSystem = await seedGradingSystem(tenant.id);
  const reviewer = await ensureProfile(
    tenant.id,
    `principal@${scenario.domain}`,
    'Management',
    passwordHash,
  );
  const { courses, classes, teacherProfiles } = await seedCoursesAndClasses(
    tenant.id,
    scenario,
    academicYear.id,
    term.id,
    passwordHash,
  );
  const students = await seedStudents(
    tenant.id,
    scenario,
    classes,
    academicYear.id,
    term.id,
    passwordHash,
  );

  await seedAttendance(tenant.id, scenario, classes, students);
  const questions = await seedLessonsAndQuestions({
    tenantId: tenant.id,
    scenario,
    classByCourse: classes,
    courseByCode: courses,
    teacherProfiles,
    reviewer,
  });
  const { takeableAssessmentId } = await seedAssessments({
    tenantId: tenant.id,
    scenario,
    academicYearId: academicYear.id,
    termId: term.id,
    gradingSystemId: gradingSystem.id,
    classByCourse: classes,
    teacherProfiles,
    students,
    questions,
  });

  const verification = await verifyScenario(tenant.id);
  console.log(
    `[dev-academics] ${scenario.slug}: ${verification.classCount} classes, ` +
      `${verification.enrollmentCount} enrollments, ${verification.questionCount} questions, ` +
      `${verification.assessmentCount} assessments, ${verification.submissionCount} submissions`,
  );
  console.log(
    `[dev-academics] Student takeable assessment id: ${takeableAssessmentId}`,
  );
}

async function main() {
  assertDevSeedAllowed('academics');

  console.log('[dev-academics] Starting academic workflow seed');
  console.log('[dev-academics] Default password for created student accounts: DevPassword@2025!');

  const passwordHash = await hashPassword(DEV_PASSWORD);
  for (const scenario of SCENARIOS) {
    await seedScenario(scenario, passwordHash);
  }

  console.log('\n[dev-academics] Complete');
  console.log('[dev-academics] Suggested dev walkthrough order:');
  console.log('  1. Login as teacher@greenfield.test and manage Math/Science lessons, questions and assessments.');
  console.log('  2. Login as multi@schoolwithease.test and switch to the Greenfield Teacher profile for English.');
  console.log('  3. Login as student@greenfield.test and take the printed assessment id.');
  console.log('  4. Login as principal@greenfield.test to review pending/rejected lesson materials.');
}

main()
  .catch((error) => {
    console.error('[dev-academics] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
