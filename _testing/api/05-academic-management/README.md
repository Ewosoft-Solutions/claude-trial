# 5. Academic Management

This section walks through the core academic workflow: setting up the academic calendar, creating courses and classes, enrolling students, creating assessments, and grading.

**Prerequisite:** You must be authenticated with a tenant-scoped JWT token. See [Authentication](../03-authentication/README.md).

All endpoints in this section require JWT authentication and an active tenant context. Most require specific permissions enforced by the `PermissionGuard`.

## 5.1 The Academic Data Model

Understanding the hierarchy helps you know what to create in what order:

```
Academic Year (e.g., 2025-2026)
  └── Term (e.g., Fall Semester)
        └── Course (e.g., Mathematics 101)
              └── Class (e.g., Section A, taught by Ms. Smith)
                    ├── Student Enrollment (links a student to a class)
                    │     └── Grade (score for a specific assessment)
                    └── Assessment (e.g., Midterm Exam)
```

**Creation order:**
1. Academic Year → Terms
2. Course
3. Class (links Course + Term + Academic Year)
4. Student record
5. Enroll student in class
6. Grading system (optional, but needed for grade computation)
7. Assessment (belongs to a class)
8. Grade (links enrollment + assessment)

## 5.2 Academic Years and Terms

### Create an Academic Year

```bash
curl -X POST http://localhost:3000/academic-years \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2025-2026",
    "startDate": "2025-09-01",
    "endDate": "2026-06-30",
    "status": "active",
    "isDefault": true,
    "description": "Primary academic year"
  }'
```

**Save the returned `id`.**

Status options: `planned`, `active`, `completed`, `archived`

### Create a Term

```bash
curl -X POST http://localhost:3000/academic-years/<academicYearId>/terms \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fall Semester",
    "type": "semester",
    "startDate": "2025-09-01",
    "endDate": "2026-01-15",
    "order": 1,
    "status": "active"
  }'
```

Term types: `semester`, `trimester`, `quarter`, `term`, `custom`

### List Academic Years and Terms

```bash
# List academic years
curl http://localhost:3000/academic-years \
  -H "Authorization: Bearer <accessToken>"

# List terms for an academic year
curl http://localhost:3000/academic-years/<academicYearId>/terms \
  -H "Authorization: Bearer <accessToken>"
```

## 5.3 Courses

### Create a Course

```bash
curl -X POST http://localhost:3000/courses \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "MATH-101",
    "name": "Introduction to Mathematics",
    "description": "Foundational math concepts",
    "category": "Mathematics",
    "subject": "Math",
    "gradeLevels": ["9", "10"],
    "credits": 3,
    "status": "active"
  }'
```

**Save the returned `id`.**

### List / Get Courses

```bash
curl http://localhost:3000/courses \
  -H "Authorization: Bearer <accessToken>"

curl http://localhost:3000/courses/<courseId> \
  -H "Authorization: Bearer <accessToken>"
```

## 5.4 Classes

A class is a section of a course offered in a specific term and academic year.

### Create a Class

```bash
curl -X POST http://localhost:3000/classes \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "<courseId>",
    "termId": "<termId>",
    "academicYearId": "<academicYearId>",
    "section": "A",
    "name": "Math 101 - Section A",
    "capacity": 30,
    "room": "Room 201",
    "status": "active"
  }'
```

**Save the returned `id`.**

### List / Get Classes

```bash
# List all classes (with optional filters)
curl "http://localhost:3000/classes?courseId=<id>&termId=<id>" \
  -H "Authorization: Bearer <accessToken>"

curl http://localhost:3000/classes/<classId> \
  -H "Authorization: Bearer <accessToken>"
```

### Assign a Student to a Class

```bash
curl -X POST http://localhost:3000/classes/<classId>/students \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{ "studentId": "<studentId>" }'
```

### List Class Students

```bash
curl http://localhost:3000/classes/<classId>/students \
  -H "Authorization: Bearer <accessToken>"
```

## 5.5 Students

### Create a Student Record

A student record is linked to a `UserTenant` profile. The user must already exist in the tenant (see [Tenant Management - Create Users](../04-tenant-management/README.md#47-create-users-in-a-tenant)).

```bash
curl -X POST http://localhost:3000/students \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "studentNumber": "STU-2025-001",
    "userTenantId": "<student-profile-uuid>",
    "admissionNumber": "ADM-001",
    "admissionDate": "2025-09-01",
    "gradeLevel": "9",
    "enrollmentStatus": "active",
    "personalInfo": {
      "dateOfBirth": "2010-05-15",
      "gender": "female",
      "nationality": "US"
    }
  }'
```

**Save the returned `id`.**

Enrollment statuses: `active`, `inactive`, `suspended`, `graduated`, `transferred`, `withdrawn`

### Search / List Students

```bash
curl "http://localhost:3000/students?search=smith&enrollmentStatus=active&page=1&limit=20" \
  -H "Authorization: Bearer <accessToken>"
```

### Enroll a Student in a Class

```bash
curl -X POST http://localhost:3000/students/<studentId>/enrollments \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "<classId>",
    "academicYearId": "<academicYearId>",
    "termId": "<termId>",
    "enrollmentDate": "2025-09-01",
    "status": "active"
  }'
```

**Save the returned enrollment `id` — you'll need it for grading.**

### List Student Enrollments

```bash
curl http://localhost:3000/students/<studentId>/enrollments \
  -H "Authorization: Bearer <accessToken>"
```

## 5.6 Grading Systems

Set up how grades are calculated before creating assessments.

### Create a Grading System

```bash
curl -X POST http://localhost:3000/grading-systems \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard Letter Grades",
    "systemType": "letter_grade",
    "gradeScale": [
      { "grade": "A", "minPercentage": 90, "maxPercentage": 100, "gpaPoints": 4.0 },
      { "grade": "B", "minPercentage": 80, "maxPercentage": 89, "gpaPoints": 3.0 },
      { "grade": "C", "minPercentage": 70, "maxPercentage": 79, "gpaPoints": 2.0 },
      { "grade": "D", "minPercentage": 60, "maxPercentage": 69, "gpaPoints": 1.0 },
      { "grade": "F", "minPercentage": 0, "maxPercentage": 59, "gpaPoints": 0.0 }
    ],
    "isDefault": true,
    "isActive": true
  }'
```

System types: `percentage`, `letter_grade`, `gpa`, `pass_fail`, `custom`

## 5.7 Assessments

### Create an Assessment

```bash
curl -X POST http://localhost:3000/assessments \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "<classId>",
    "name": "Midterm Exam",
    "type": "exam",
    "maxPoints": 100,
    "weight": 30,
    "gradingSystemId": "<gradingSystemId>",
    "dueDate": "2025-10-15",
    "status": "published",
    "instructions": "Covers chapters 1-5"
  }'
```

**Save the returned `id`.**

Assessment types: `quiz`, `test`, `exam`, `project`, `homework`, `assignment`, `lab`, `presentation`, `participation`, `custom`

Assessment statuses: `draft`, `published`, `in_progress`, `graded`, `archived`

### List Assessments

```bash
curl "http://localhost:3000/assessments?classId=<classId>&status=published" \
  -H "Authorization: Bearer <accessToken>"
```

## 5.8 Grades

### Record a Grade

Uses the **enrollment ID** (from enrolling a student in a class) and the **assessment ID**:

```bash
curl -X POST http://localhost:3000/grades \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "enrollmentId": "<enrollmentId>",
    "assessmentId": "<assessmentId>",
    "pointsEarned": 87,
    "status": "graded",
    "gradedAt": "2025-10-20",
    "feedback": "Good work on problem sets, review chapter 3"
  }'
```

Grade statuses: `draft`, `submitted`, `graded`, `late`, `excused`, `missing`

### Update a Grade

```bash
curl -X PUT http://localhost:3000/grades/<gradeId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "pointsEarned": 90,
    "feedback": "Updated after grade review"
  }'
```

### Get Grades for an Assessment

```bash
curl http://localhost:3000/grades/assessment/<assessmentId> \
  -H "Authorization: Bearer <accessToken>"
```

### Get Grade Analytics

```bash
curl http://localhost:3000/grades/assessment/<assessmentId>/stats \
  -H "Authorization: Bearer <accessToken>"
```

### Get Student Grades (Report Card Data)

```bash
curl http://localhost:3000/grades/student/<studentId> \
  -H "Authorization: Bearer <accessToken>"
```

### Generate a Report Card

```bash
curl -X POST http://localhost:3000/grades/student/<studentId>/report-card \
  -H "Authorization: Bearer <accessToken>"
```

## 5.9 Complete Testing Scenario

Here's a full walkthrough to test the entire academic flow:

```
1. POST /academic-years                           → Create "2025-2026"
2. POST /academic-years/<id>/terms                 → Create "Fall Semester"
3. POST /courses                                   → Create "MATH-101"
4. POST /classes                                   → Create Section A (links course + term + year)
5. POST /tenant/<tenantId>/users                   → Create a student user (with Student role)
6. POST /students                                  → Create student record (links to user profile)
7. POST /students/<id>/enrollments                 → Enroll student in the class
8. POST /grading-systems                           → Create letter grade system
9. POST /assessments                               → Create "Midterm Exam" for the class
10. POST /grades                                   → Grade the student on the midterm
11. GET  /grades/assessment/<id>/stats             → View class analytics
12. GET  /grades/student/<id>                      → View student's grade summary
13. POST /grades/student/<id>/report-card          → Generate report card
```

Each step depends on IDs from previous steps. Keep a scratchpad of the UUIDs as you go.

## What's Next

For a quick reference of all API endpoints, see [API Reference](../06-api-reference/README.md).
