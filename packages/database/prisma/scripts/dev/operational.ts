/**
 * Dev operational seed.
 *
 * Run after:
 *   1. pnpm --filter @workspace/database db:seed
 *   2. pnpm --filter @workspace/database db:seed:dev
 *   3. pnpm --filter @workspace/database db:seed:academics
 *
 * Populates the operational surfaces that the web app reads directly:
 * finance, admissions, transport, library, health, HR payroll and events.
 * Every record is tied to the dev tenants/personas or to traceable
 * DEV-SEED identifiers so it can be queried and cleaned intentionally.
 */

import { Prisma } from '@workspace/database';

import { prisma } from '../../../src/singleton.js';
import { assertDevSeedAllowed, DEV_SEED_TAG } from './guard.js';

type TenantKey = 'greenfield' | 'sunrise';

interface TenantOperationalSeed {
  key: TenantKey;
  slug: string;
  domain: string;
  finance: {
    termName: string;
    termYear: number;
    termCycle: number;
    issuedDate: Date;
    dueDate: Date;
    invoices: Array<{
      studentNumber: string;
      amountDue: number;
      amountPaid: number;
      status: string;
      method?: string;
      paidAt?: Date;
    }>;
  };
  health: Array<{
    studentNumber: string;
    bloodType: string;
    allergies: string | null;
    conditions?: string | null;
    medications?: string | null;
    lastCheckup: Date;
    status: string;
  }>;
  transport: Array<{
    studentNumber: string;
    routeName: string | null;
    stop: string | null;
    pickupTime: string | null;
    vehicleLabel: string | null;
    status: string;
  }>;
  library: Array<{
    title: string;
    author: string;
    category: string;
    copyLabel: string;
    status: string;
    borrowerStudentNumber?: string;
    dueDate?: Date;
  }>;
  admissions: Array<{
    applicantName: string;
    applyingFor: string;
    guardianName: string;
    guardianEmail: string;
    guardianPhone: string;
    submittedDate: Date;
    stage: string;
    decision: string;
  }>;
  events: Array<{
    title: string;
    description: string;
    eventType: string;
    location: string;
    startDate: Date;
    endDate: Date;
    status: string;
    capacity: number | null;
    registeredCount: number;
  }>;
  payroll: Array<{
    email: string;
    role: string;
    grossPay: number;
    deductions: number;
    status: string;
    paidDate?: Date;
  }>;
}

const PAY_PERIOD = '2026-07';

const TENANTS: TenantOperationalSeed[] = [
  {
    key: 'greenfield',
    slug: 'greenfield-secondary',
    domain: 'greenfield.test',
    finance: {
      termName: 'First Term 2026',
      termYear: 2026,
      termCycle: 1,
      issuedDate: new Date('2026-07-06T00:00:00.000Z'),
      dueDate: new Date('2026-07-31T00:00:00.000Z'),
      invoices: [
        {
          studentNumber: 'STU-DEV-001',
          amountDue: 18500000,
          amountPaid: 18500000,
          status: 'paid',
          method: 'transfer',
          paidAt: new Date('2026-07-08T00:00:00.000Z'),
        },
        {
          studentNumber: 'STU-DEV-102',
          amountDue: 18500000,
          amountPaid: 9000000,
          status: 'partial',
          method: 'card',
          paidAt: new Date('2026-07-09T00:00:00.000Z'),
        },
        {
          studentNumber: 'STU-DEV-201',
          amountDue: 19500000,
          amountPaid: 0,
          status: 'overdue',
        },
        {
          studentNumber: 'STU-DEV-103',
          amountDue: 24500000,
          amountPaid: 24500000,
          status: 'paid',
          method: 'cash',
          paidAt: new Date('2026-07-10T00:00:00.000Z'),
        },
      ],
    },
    health: [
      {
        studentNumber: 'STU-DEV-001',
        bloodType: 'O+',
        allergies: 'Peanuts',
        conditions: 'Mild asthma',
        medications: 'Salbutamol inhaler as needed',
        lastCheckup: new Date('2026-07-02T00:00:00.000Z'),
        status: 'monitoring',
      },
      {
        studentNumber: 'STU-DEV-102',
        bloodType: 'A+',
        allergies: null,
        lastCheckup: new Date('2026-07-03T00:00:00.000Z'),
        status: 'normal',
      },
      {
        studentNumber: 'STU-DEV-201',
        bloodType: 'B+',
        allergies: 'Penicillin',
        conditions: 'Recent fever review',
        medications: null,
        lastCheckup: new Date('2026-07-08T00:00:00.000Z'),
        status: 'urgent',
      },
      {
        studentNumber: 'STU-DEV-103',
        bloodType: 'O-',
        allergies: null,
        lastCheckup: new Date('2026-06-30T00:00:00.000Z'),
        status: 'normal',
      },
    ],
    transport: [
      {
        studentNumber: 'STU-DEV-001',
        routeName: 'DEV-SEED Route A - Ikoyi',
        stop: 'Awolowo Road',
        pickupTime: '06:45',
        vehicleLabel: 'DEV-SEED Bus A1',
        status: 'assigned',
      },
      {
        studentNumber: 'STU-DEV-102',
        routeName: 'DEV-SEED Route A - Ikoyi',
        stop: 'Bourdillon',
        pickupTime: '06:55',
        vehicleLabel: 'DEV-SEED Bus A1',
        status: 'assigned',
      },
      {
        studentNumber: 'STU-DEV-201',
        routeName: 'DEV-SEED Route B - Lekki',
        stop: 'Phase 1 Gate',
        pickupTime: '06:30',
        vehicleLabel: 'DEV-SEED Bus B2',
        status: 'assigned',
      },
      {
        studentNumber: 'STU-DEV-103',
        routeName: null,
        stop: null,
        pickupTime: null,
        vehicleLabel: null,
        status: 'waitlist',
      },
    ],
    library: [
      {
        title: 'Things Fall Apart',
        author: 'Chinua Achebe',
        category: 'Fiction',
        copyLabel: 'DEV-SEED GF Copy 1',
        status: 'on_loan',
        borrowerStudentNumber: 'STU-DEV-001',
        dueDate: new Date('2026-07-20T00:00:00.000Z'),
      },
      {
        title: 'Half of a Yellow Sun',
        author: 'Chimamanda Ngozi Adichie',
        category: 'Fiction',
        copyLabel: 'DEV-SEED GF Copy 1',
        status: 'available',
      },
      {
        title: 'A Short History of Nigeria',
        author: 'Michael Crowder',
        category: 'History',
        copyLabel: 'DEV-SEED GF Copy 1',
        status: 'overdue',
        borrowerStudentNumber: 'STU-DEV-201',
        dueDate: new Date('2026-07-04T00:00:00.000Z'),
      },
      {
        title: 'Introduction to Algebra',
        author: 'K. Adeyemi',
        category: 'Mathematics',
        copyLabel: 'DEV-SEED GF Copy 1',
        status: 'reserved',
      },
    ],
    admissions: [
      {
        applicantName: 'Dev Seed Ngozi Achebe',
        applyingFor: 'JSS1',
        guardianName: 'Mrs. E. Achebe',
        guardianEmail: 'guardian.achebe@dev-seed.test',
        guardianPhone: '+2348000001001',
        submittedDate: new Date('2026-07-01T00:00:00.000Z'),
        stage: 'offer',
        decision: 'accepted',
      },
      {
        applicantName: 'Dev Seed Bola Adewale',
        applyingFor: 'JSS1',
        guardianName: 'Mr. T. Adewale',
        guardianEmail: 'guardian.adewale@dev-seed.test',
        guardianPhone: '+2348000001002',
        submittedDate: new Date('2026-07-02T00:00:00.000Z'),
        stage: 'interview',
        decision: 'pending',
      },
      {
        applicantName: 'Dev Seed Yusuf Garba',
        applyingFor: 'JSS2',
        guardianName: 'Mr. I. Garba',
        guardianEmail: 'guardian.garba@dev-seed.test',
        guardianPhone: '+2348000001003',
        submittedDate: new Date('2026-07-03T00:00:00.000Z'),
        stage: 'rejected',
        decision: 'rejected',
      },
      {
        applicantName: 'Dev Seed Aisha Lawal',
        applyingFor: 'SSS1',
        guardianName: 'Alhaja R. Lawal',
        guardianEmail: 'guardian.lawal@dev-seed.test',
        guardianPhone: '+2348000001004',
        submittedDate: new Date('2026-07-04T00:00:00.000Z'),
        stage: 'screening',
        decision: 'waitlisted',
      },
    ],
    events: [
      {
        title: 'DEV-SEED Inter-house Sports Day',
        description: 'DEV-SEED athletics event for seeded operations personas.',
        eventType: 'sports',
        location: 'School field',
        startDate: new Date('2026-08-14T09:00:00.000Z'),
        endDate: new Date('2026-08-14T15:00:00.000Z'),
        status: 'scheduled',
        capacity: 500,
        registeredCount: 320,
      },
      {
        title: 'DEV-SEED Founders Day Assembly',
        description:
          'DEV-SEED ceremony visible to management and operations personas.',
        eventType: 'ceremony',
        location: 'Main hall',
        startDate: new Date('2026-09-02T10:00:00.000Z'),
        endDate: new Date('2026-09-02T12:00:00.000Z'),
        status: 'scheduled',
        capacity: null,
        registeredCount: 40,
      },
      {
        title: 'DEV-SEED PTA Fundraiser',
        description:
          'DEV-SEED completed event used for event status filtering.',
        eventType: 'fundraiser',
        location: 'School canteen',
        startDate: new Date('2026-07-20T16:00:00.000Z'),
        endDate: new Date('2026-07-20T19:00:00.000Z'),
        status: 'completed',
        capacity: 250,
        registeredCount: 210,
      },
    ],
    payroll: [
      {
        email: 'teacher@greenfield.test',
        role: 'Mathematics Teacher',
        grossPay: 350000,
        deductions: 25000,
        status: 'paid',
        paidDate: new Date('2026-07-25T00:00:00.000Z'),
      },
      {
        email: 'principal@greenfield.test',
        role: 'Principal',
        grossPay: 520000,
        deductions: 40000,
        status: 'approved',
      },
      {
        email: 'operations@greenfield.test',
        role: 'Operations Manager',
        grossPay: 300000,
        deductions: 20000,
        status: 'draft',
      },
    ],
  },
  {
    key: 'sunrise',
    slug: 'sunrise-primary',
    domain: 'sunrise.test',
    finance: {
      termName: 'First Term 2026',
      termYear: 2026,
      termCycle: 1,
      issuedDate: new Date('2026-07-06T00:00:00.000Z'),
      dueDate: new Date('2026-07-31T00:00:00.000Z'),
      invoices: [
        {
          studentNumber: 'STU-DEV-001',
          amountDue: 12000000,
          amountPaid: 12000000,
          status: 'paid',
          method: 'transfer',
          paidAt: new Date('2026-07-08T00:00:00.000Z'),
        },
        {
          studentNumber: 'STU-DEV-104',
          amountDue: 12000000,
          amountPaid: 6000000,
          status: 'partial',
          method: 'card',
          paidAt: new Date('2026-07-09T00:00:00.000Z'),
        },
        {
          studentNumber: 'STU-DEV-202',
          amountDue: 13000000,
          amountPaid: 0,
          status: 'issued',
        },
      ],
    },
    health: [
      {
        studentNumber: 'STU-DEV-001',
        bloodType: 'A-',
        allergies: null,
        lastCheckup: new Date('2026-07-02T00:00:00.000Z'),
        status: 'normal',
      },
      {
        studentNumber: 'STU-DEV-104',
        bloodType: 'O+',
        allergies: 'Dust',
        conditions: 'Seasonal allergies',
        medications: 'Antihistamine on guardian approval',
        lastCheckup: new Date('2026-07-07T00:00:00.000Z'),
        status: 'monitoring',
      },
      {
        studentNumber: 'STU-DEV-202',
        bloodType: 'B-',
        allergies: null,
        lastCheckup: new Date('2026-07-08T00:00:00.000Z'),
        status: 'normal',
      },
    ],
    transport: [
      {
        studentNumber: 'STU-DEV-001',
        routeName: 'DEV-SEED Route P - Surulere',
        stop: 'Bode Thomas',
        pickupTime: '07:05',
        vehicleLabel: 'DEV-SEED Mini Bus P1',
        status: 'assigned',
      },
      {
        studentNumber: 'STU-DEV-104',
        routeName: 'DEV-SEED Route Q - Yaba',
        stop: 'Tejuosho',
        pickupTime: '06:50',
        vehicleLabel: 'DEV-SEED Mini Bus Q2',
        status: 'assigned',
      },
      {
        studentNumber: 'STU-DEV-202',
        routeName: null,
        stop: null,
        pickupTime: null,
        vehicleLabel: null,
        status: 'unassigned',
      },
    ],
    library: [
      {
        title: 'Primary Numeracy Workbook',
        author: 'A. Balogun',
        category: 'Mathematics',
        copyLabel: 'DEV-SEED SR Copy 1',
        status: 'available',
      },
      {
        title: 'Stories from West Africa',
        author: 'M. Okon',
        category: 'Literacy',
        copyLabel: 'DEV-SEED SR Copy 1',
        status: 'on_loan',
        borrowerStudentNumber: 'STU-DEV-104',
        dueDate: new Date('2026-07-22T00:00:00.000Z'),
      },
      {
        title: 'Plants Around Us',
        author: 'S. Bello',
        category: 'Science',
        copyLabel: 'DEV-SEED SR Copy 1',
        status: 'reserved',
      },
    ],
    admissions: [
      {
        applicantName: 'Dev Seed Mary Johnson',
        applyingFor: 'P5',
        guardianName: 'Mrs. F. Johnson',
        guardianEmail: 'guardian.johnson@dev-seed.test',
        guardianPhone: '+2348000002001',
        submittedDate: new Date('2026-07-01T00:00:00.000Z'),
        stage: 'interview',
        decision: 'pending',
      },
      {
        applicantName: 'Dev Seed Tobi Williams',
        applyingFor: 'P4',
        guardianName: 'Mr. A. Williams',
        guardianEmail: 'guardian.williams@dev-seed.test',
        guardianPhone: '+2348000002002',
        submittedDate: new Date('2026-07-03T00:00:00.000Z'),
        stage: 'applied',
        decision: 'pending',
      },
      {
        applicantName: 'Dev Seed Hauwa Abdullahi',
        applyingFor: 'P6',
        guardianName: 'Mr. S. Abdullahi',
        guardianEmail: 'guardian.abdullahi@dev-seed.test',
        guardianPhone: '+2348000002003',
        submittedDate: new Date('2026-07-04T00:00:00.000Z'),
        stage: 'offer',
        decision: 'accepted',
      },
    ],
    events: [
      {
        title: 'DEV-SEED Primary Science Fair',
        description: 'DEV-SEED hands-on fair for primary operations testing.',
        eventType: 'ceremony',
        location: 'Primary courtyard',
        startDate: new Date('2026-08-18T09:00:00.000Z'),
        endDate: new Date('2026-08-18T12:00:00.000Z'),
        status: 'scheduled',
        capacity: 180,
        registeredCount: 96,
      },
      {
        title: 'DEV-SEED Reading Picnic',
        description: 'DEV-SEED literacy event used by the events list.',
        eventType: 'other',
        location: 'Library garden',
        startDate: new Date('2026-07-24T10:00:00.000Z'),
        endDate: new Date('2026-07-24T12:00:00.000Z'),
        status: 'completed',
        capacity: 120,
        registeredCount: 118,
      },
    ],
    payroll: [
      {
        email: 'teacher@sunrise.test',
        role: 'Primary Teacher',
        grossPay: 260000,
        deductions: 18000,
        status: 'paid',
        paidDate: new Date('2026-07-25T00:00:00.000Z'),
      },
      {
        email: 'principal@sunrise.test',
        role: 'Head Teacher',
        grossPay: 420000,
        deductions: 32000,
        status: 'approved',
      },
      {
        email: 'operations@sunrise.test',
        role: 'Operations Lead',
        grossPay: 240000,
        deductions: 15000,
        status: 'draft',
      },
    ],
  },
];

async function tenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) {
    throw new Error(
      `Missing dev tenant ${slug}. Run db:seed:dev before db:seed:ops.`,
    );
  }
  return tenant;
}

async function studentByNumber(tenantId: string, studentNumber: string) {
  const student = await prisma.student.findUnique({
    where: { tenantId_studentNumber: { tenantId, studentNumber } },
    select: { id: true, studentNumber: true },
  });
  if (!student) {
    throw new Error(
      `Missing dev student ${studentNumber}. Run db:seed:academics before db:seed:ops.`,
    );
  }
  return student;
}

async function profileByEmail(tenantId: string, email: string) {
  const profile = await prisma.userTenant.findFirst({
    where: { tenantId, user: { email } },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!profile) {
    throw new Error(
      `Missing dev profile ${email}. Run db:seed:dev before db:seed:ops.`,
    );
  }
  return profile;
}

/** The tenant owner's user id — used as the actor for seeded audited records. */
async function ownerUserId(tenantId: string, domain: string): Promise<string> {
  const profile = await prisma.userTenant.findFirst({
    where: { tenantId, user: { email: `owner@${domain}` } },
    select: { userId: true },
  });
  if (!profile) {
    throw new Error(
      `Missing owner profile owner@${domain}. Run db:seed:dev before db:seed:ops.`,
    );
  }
  return profile.userId;
}

async function seedFinance(tenantId: string, seed: TenantOperationalSeed) {
  for (const item of seed.finance.invoices) {
    const student = await studentByNumber(tenantId, item.studentNumber);
    const invoiceNumber = `DEV-INV-${seed.key.toUpperCase()}-${item.studentNumber}`;
    const invoice = await prisma.feeInvoice.upsert({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber } },
      update: {
        amountDue: item.amountDue,
        amountPaid: item.amountPaid,
        status: item.status,
        notes: `${DEV_SEED_TAG}: operational finance context for ${item.studentNumber}`,
      },
      create: {
        tenantId,
        invoiceNumber,
        studentId: student.id,
        termName: seed.finance.termName,
        termYear: seed.finance.termYear,
        termCycle: seed.finance.termCycle,
        issuedDate: seed.finance.issuedDate,
        dueDate: seed.finance.dueDate,
        amountDue: item.amountDue,
        amountPaid: item.amountPaid,
        status: item.status,
        notes: `${DEV_SEED_TAG}: operational finance context for ${item.studentNumber}`,
      },
    });

    if (item.amountPaid > 0 && item.method && item.paidAt) {
      const receiptNumber = `DEV-PMT-${seed.key.toUpperCase()}-${item.studentNumber}`;
      await prisma.payment.upsert({
        where: { tenantId_receiptNumber: { tenantId, receiptNumber } },
        update: {
          invoiceId: invoice.id,
          studentId: student.id,
          method: item.method,
          paidAt: item.paidAt,
          amount: item.amountPaid,
          status: 'completed',
          reference: `${DEV_SEED_TAG}-${receiptNumber}`,
          notes: `${DEV_SEED_TAG}: seeded payment receipt`,
        },
        create: {
          tenantId,
          receiptNumber,
          invoiceId: invoice.id,
          studentId: student.id,
          method: item.method,
          paidAt: item.paidAt,
          amount: item.amountPaid,
          status: 'completed',
          reference: `${DEV_SEED_TAG}-${receiptNumber}`,
          notes: `${DEV_SEED_TAG}: seeded payment receipt`,
        },
      });
    }
  }
}

async function seedHealth(tenantId: string, seed: TenantOperationalSeed) {
  for (const item of seed.health) {
    const student = await studentByNumber(tenantId, item.studentNumber);
    await prisma.healthRecord.upsert({
      where: { studentId: student.id },
      update: {
        bloodType: item.bloodType,
        allergies: item.allergies,
        conditions: item.conditions ?? null,
        medications: item.medications ?? null,
        lastCheckup: item.lastCheckup,
        status: item.status,
        notes: `${DEV_SEED_TAG}: health profile for ${item.studentNumber}`,
      },
      create: {
        tenantId,
        studentId: student.id,
        bloodType: item.bloodType,
        allergies: item.allergies,
        conditions: item.conditions ?? null,
        medications: item.medications ?? null,
        lastCheckup: item.lastCheckup,
        status: item.status,
        notes: `${DEV_SEED_TAG}: health profile for ${item.studentNumber}`,
      },
    });
  }
}

async function seedTransport(tenantId: string, seed: TenantOperationalSeed) {
  for (const item of seed.transport) {
    const student = await studentByNumber(tenantId, item.studentNumber);
    await prisma.transportAssignment.upsert({
      where: { studentId: student.id },
      update: {
        routeName: item.routeName,
        stop: item.stop,
        pickupTime: item.pickupTime,
        vehicleLabel: item.vehicleLabel,
        status: item.status,
      },
      create: {
        tenantId,
        studentId: student.id,
        routeName: item.routeName,
        stop: item.stop,
        pickupTime: item.pickupTime,
        vehicleLabel: item.vehicleLabel,
        status: item.status,
      },
    });
  }
}

async function seedLibrary(tenantId: string, seed: TenantOperationalSeed) {
  for (const item of seed.library) {
    const borrower = item.borrowerStudentNumber
      ? await studentByNumber(tenantId, item.borrowerStudentNumber)
      : null;
    const existing = await prisma.libraryBook.findFirst({
      where: { tenantId, title: item.title, copyLabel: item.copyLabel },
      select: { id: true },
    });
    const data = {
      title: item.title,
      author: item.author,
      category: item.category,
      copyLabel: item.copyLabel,
      status: item.status,
      borrowerStudentId: borrower?.id ?? null,
      dueDate: item.dueDate ?? null,
    };

    if (existing) {
      await prisma.libraryBook.update({ where: { id: existing.id }, data });
    } else {
      await prisma.libraryBook.create({ data: { tenantId, ...data } });
    }
  }
}

/**
 * A realistic STARTER application questionnaire — the school's own questions,
 * layered on top of the structured intake (identity / class / guardians are
 * captured separately and are NOT repeated here). Seeded as a PUBLISHED v1 so a
 * fresh install is never a blank page; it is an ordinary editable form (New
 * version → draft → publish supersedes it, prior published version archived).
 *
 * Showcases the engine end-to-end: multiple sections, a paragraph with a live
 * character countdown, checkboxes, a BRANCHING radio (Day skips the boarding
 * page), the phone (flag + dial-code) and address controls, and file uploads.
 */
const STARTER_APPLICATION_FORM = {
  title: 'Application form',
  description:
    'A few extra questions to help us get to know your child. Your identity, class and guardian details are captured on the previous step — no need to repeat them here.',
  settings: { progressBar: true },
  sections: [
    {
      id: 'sec-schooling',
      title: 'Previous schooling',
      description: 'Tell us where your child is coming from.',
      items: [
        {
          id: 'it-prev-school',
          key: 'previous_school',
          type: 'short_text',
          label: 'Most recent school attended',
          placeholder: 'e.g. Little Stars Nursery & Primary',
        },
        {
          id: 'it-current-class',
          key: 'current_class',
          type: 'short_text',
          label: 'Current class / grade',
          placeholder: 'e.g. Primary 3',
        },
        {
          id: 'it-transfer-reason',
          key: 'transfer_reason',
          type: 'paragraph',
          label: 'Reason for transferring (optional)',
          validation: { maxLength: 300 },
        },
      ],
    },
    {
      id: 'sec-about',
      title: 'About the applicant',
      items: [
        {
          id: 'it-languages',
          key: 'languages_at_home',
          type: 'checkboxes',
          label: 'Languages spoken at home',
          options: ['English', 'Yoruba', 'Igbo', 'Hausa', 'French', 'Other'],
        },
        {
          id: 'it-boarding',
          key: 'boarding_preference',
          type: 'radio',
          label: 'Will your child board or attend as a day student?',
          required: true,
          options: ['Boarding', 'Day'],
          branching: [
            { answer: 'Boarding', goTo: 'sec-boarding' },
            { answer: 'Day', goTo: 'sec-documents' },
          ],
        },
        {
          id: 'it-support',
          key: 'learning_support',
          type: 'paragraph',
          label: 'Any learning-support or medical needs we should know about?',
          help: 'Optional — this helps our teachers prepare.',
          validation: { maxLength: 500 },
        },
      ],
    },
    {
      id: 'sec-boarding',
      title: 'Boarding details',
      description: 'Only needed for boarding applicants.',
      items: [
        {
          id: 'it-pickup',
          key: 'pickup_contact',
          type: 'phone',
          label: 'Emergency pickup contact',
          required: true,
          phone: { defaultDialCode: '+234' },
        },
        {
          id: 'it-home-address',
          key: 'home_address',
          type: 'address',
          label: 'Home address',
          required: true,
        },
      ],
    },
    {
      id: 'sec-documents',
      title: 'Supporting documents',
      description: 'Upload a clear photo or scan. PDF, JPG or PNG.',
      items: [
        {
          id: 'it-birth-cert',
          key: 'birth_certificate',
          type: 'file',
          label: 'Birth certificate',
          required: true,
          file: {
            accept: ['application/pdf', 'image/jpeg', 'image/png'],
            maxSizeMb: 5,
          },
        },
        {
          id: 'it-photo',
          key: 'passport_photo',
          type: 'file',
          label: 'Recent passport photograph',
          file: { accept: ['image/jpeg', 'image/png'], maxSizeMb: 2 },
        },
        {
          id: 'it-referral',
          key: 'how_heard',
          type: 'dropdown',
          label: 'How did you hear about us?',
          options: [
            'A friend or family',
            'Social media',
            'Our website',
            'A school event',
            'Other',
          ],
        },
      ],
    },
  ],
};

/**
 * Seed the tenant's admissions application form as a PUBLISHED v1 — but only if
 * the school has no form yet. Once any version exists (a real draft/publish), we
 * never clobber it, so re-running the seed is safe and preserves school edits.
 * Identity is (ownerType=Tenant, purpose=admissions.application) — exactly one
 * per tenant — so no DEV-SEED tag is needed to find/clean it.
 */
async function seedAdmissionForm(tenantId: string, actorId: string) {
  const owner = {
    ownerType: 'Tenant',
    ownerId: tenantId,
    purpose: 'admissions.application',
    key: null,
  };

  const existing = await prisma.form.findFirst({
    where: { tenantId, ...owner },
    select: { id: true, versions: { select: { id: true }, take: 1 } },
  });
  if (existing && existing.versions.length > 0) return;

  const formId =
    existing?.id ??
    (
      await prisma.form.create({
        data: {
          tenantId,
          ...owner,
          title: STARTER_APPLICATION_FORM.title,
          description:
            'Starter questionnaire seeded for development — edit freely (New version → publish).',
          createdBy: actorId,
          updatedBy: actorId,
        },
        select: { id: true },
      })
    ).id;

  await prisma.formVersion.create({
    data: {
      tenantId,
      formId,
      version: 1,
      status: 'published',
      definition: STARTER_APPLICATION_FORM as unknown as Prisma.InputJsonValue,
      publishedAt: new Date(),
      publishedBy: actorId,
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
}

async function seedAdmissions(tenantId: string, seed: TenantOperationalSeed) {
  for (const item of seed.admissions) {
    const existing = await prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        applicantName: item.applicantName,
        guardianEmail: item.guardianEmail,
      },
      select: { id: true },
    });
    const data = {
      applicantName: item.applicantName,
      applyingFor: item.applyingFor,
      guardianName: item.guardianName,
      guardianEmail: item.guardianEmail,
      guardianPhone: item.guardianPhone,
      submittedDate: item.submittedDate,
      stage: item.stage,
      decision: item.decision,
      notes: `${DEV_SEED_TAG}: seeded admissions pipeline row`,
    };

    if (existing) {
      await prisma.admissionApplication.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.admissionApplication.create({ data: { tenantId, ...data } });
    }
  }
}

async function seedEvents(tenantId: string, seed: TenantOperationalSeed) {
  for (const item of seed.events) {
    const existing = await prisma.schoolEvent.findFirst({
      where: { tenantId, title: item.title },
      select: { id: true },
    });
    const data = {
      title: item.title,
      description: item.description,
      eventType: item.eventType,
      location: item.location,
      startDate: item.startDate,
      endDate: item.endDate,
      status: item.status,
      capacity: item.capacity,
      registeredCount: item.registeredCount,
    };

    if (existing) {
      await prisma.schoolEvent.update({ where: { id: existing.id }, data });
    } else {
      await prisma.schoolEvent.create({ data: { tenantId, ...data } });
    }
  }
}

async function seedPayroll(tenantId: string, seed: TenantOperationalSeed) {
  for (const item of seed.payroll) {
    const profile = await profileByEmail(tenantId, item.email);
    const staffName = [profile.user.firstName, profile.user.lastName]
      .filter(Boolean)
      .join(' ');
    const existing = await prisma.staffPayrollRecord.findFirst({
      where: {
        tenantId,
        staffUserTenantId: profile.id,
        payPeriod: PAY_PERIOD,
      },
      select: { id: true },
    });
    const data = {
      staffUserTenantId: profile.id,
      staffName: staffName || item.email,
      role: `${DEV_SEED_TAG}: ${item.role}`,
      payPeriod: PAY_PERIOD,
      grossPay: item.grossPay,
      deductions: item.deductions,
      netPay: item.grossPay - item.deductions,
      status: item.status,
      paidDate: item.paidDate ?? null,
    };

    if (existing) {
      await prisma.staffPayrollRecord.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.staffPayrollRecord.create({ data: { tenantId, ...data } });
    }
  }
}

async function verifyTenant(tenantId: string) {
  const [
    invoices,
    payments,
    healthRecords,
    transportAssignments,
    libraryBooks,
    admissions,
    admissionForms,
    events,
    payroll,
  ] = await Promise.all([
    prisma.feeInvoice.count({
      where: { tenantId, invoiceNumber: { startsWith: 'DEV-INV-' } },
    }),
    prisma.payment.count({
      where: { tenantId, receiptNumber: { startsWith: 'DEV-PMT-' } },
    }),
    prisma.healthRecord.count({
      where: { tenantId, notes: { contains: DEV_SEED_TAG } },
    }),
    prisma.transportAssignment.count({
      where: { tenantId, vehicleLabel: { contains: DEV_SEED_TAG } },
    }),
    prisma.libraryBook.count({
      where: { tenantId, copyLabel: { contains: DEV_SEED_TAG } },
    }),
    prisma.admissionApplication.count({
      where: { tenantId, notes: { contains: DEV_SEED_TAG } },
    }),
    prisma.formVersion.count({
      where: {
        tenantId,
        status: 'published',
        form: { purpose: 'admissions.application' },
      },
    }),
    prisma.schoolEvent.count({
      where: { tenantId, title: { startsWith: DEV_SEED_TAG } },
    }),
    prisma.staffPayrollRecord.count({
      where: { tenantId, role: { contains: DEV_SEED_TAG } },
    }),
  ]);

  return {
    invoices,
    payments,
    healthRecords,
    transportAssignments,
    libraryBooks,
    admissions,
    admissionForms,
    events,
    payroll,
  };
}

async function seedTenant(seed: TenantOperationalSeed) {
  const tenant = await tenantBySlug(seed.slug);
  console.log(`\n[dev-ops] Seeding ${tenant.name} (${seed.slug})`);

  const ownerId = await ownerUserId(tenant.id, seed.domain);

  await seedFinance(tenant.id, seed);
  await seedHealth(tenant.id, seed);
  await seedTransport(tenant.id, seed);
  await seedLibrary(tenant.id, seed);
  await seedAdmissions(tenant.id, seed);
  await seedAdmissionForm(tenant.id, ownerId);
  await seedEvents(tenant.id, seed);
  await seedPayroll(tenant.id, seed);

  const verification = await verifyTenant(tenant.id);
  console.log(
    `[dev-ops] ${seed.slug}: ${verification.invoices} invoices, ` +
      `${verification.healthRecords} health records, ${verification.transportAssignments} transport assignments, ` +
      `${verification.libraryBooks} library copies, ${verification.admissions} admissions, ` +
      `${verification.admissionForms} published application form, ` +
      `${verification.events} events, ${verification.payroll} payroll rows`,
  );
}

async function main() {
  assertDevSeedAllowed('operational');

  console.log('[dev-ops] Starting operational dev seed');
  for (const seed of TENANTS) {
    await seedTenant(seed);
  }
  console.log('\n[dev-ops] Complete');
}

main()
  .catch((error) => {
    console.error('[dev-ops] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
