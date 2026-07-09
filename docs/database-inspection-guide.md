# Database Inspection Guide

SchoolWithEase is multi-tenant and security-sensitive. Prefer live local tools
over generated schema artifacts. Do not commit exported schema diagrams,
database dumps, screenshots containing sensitive rows, or tool-generated reports.

## Tool Roles

Use DBeaver for deep inspection:

- Browse schemas, tables, indexes, foreign keys, and row data.
- Build temporary ER diagrams from selected tables.
- Run read-only SQL while following tenant isolation rules.
- Compare the real database to Prisma models during debugging.

Use Prisma Studio for quick model-level row inspection:

- Verify seed data and relationships through Prisma's model naming.
- Check a small set of rows while developing flows.
- Avoid raw SQL when a simple visual browse is enough.

Use the application itself for permission and RLS behavior:

- DBeaver and Prisma Studio usually connect as privileged local users.
- They are not a substitute for testing API endpoints with real tenant context,
  profile context, permissions, and RLS runtime roles.

## Starting Prisma Studio

```bash
corepack pnpm --filter @workspace/database db:studio
```

Prisma Studio is best for quick checks such as:

- Did the seed create the expected tenants, roles, permissions, and users?
- Does a lesson/material/question/assessment row exist?
- Are relation IDs populated as expected?

## Connecting DBeaver

Create a PostgreSQL connection using the values from
`packages/database/.env`.

Typical local settings:

- Host: `localhost`
- Port: `5432`
- Database: the database name from `DATABASE_URL`
- User/password: from `DATABASE_URL`
- SSL: disabled for the local dev database unless the URL explicitly says
  otherwise

Keep the connection local. Do not store production credentials in DBeaver unless
there is an approved operational reason.

## DBeaver Workflow

Open these schemas first:

- `tenant`
- `profile`
- `roles-permissions`
- `academic-structure`
- `learning`
- `student-management`
- `ai`

For a focused ER view, select only the tables involved in the flow, then create
an ER diagram from the selection. Avoid whole-database diagrams unless you are
working locally and temporarily.

## Academic Flow Tables

Start with:

- `tenant.tenants`
- `profile.user_tenants`
- `profile.user_tenant_roles`
- `roles-permissions.roles`
- `roles-permissions.permissions`
- `academic-structure.academic_years`
- `academic-structure.terms`
- `academic-structure.courses`
- `academic-structure.classes`
- `academic-structure.class_teachers`
- `student-management.students`
- `student-management.enrollments`

Lesson/material flow:

- `learning.lessons`
- `learning.lesson_materials`
- `learning.material_chunks`

Question and assessment flow:

- `academic-structure.questions`
- `academic-structure.assessments`
- `academic-structure.assessment_questions`
- `academic-structure.assessment_submissions`
- `academic-structure.grades`

AI tutor flow:

- `ai.chat_sessions`
- `ai.chat_messages`
- `learning.material_chunks`

## Useful Read-Only Queries

Replace IDs with local values from your database.

```sql
select id, name, slug, status
from tenant.tenants
order by created_at desc;
```

```sql
select ut.id as profile_id,
       u.email,
       u.first_name,
       u.last_name,
       r.name as role_name,
       ut.status
from profile.user_tenants ut
join "user-management".users u on u.id = ut.user_id
left join profile.user_tenant_roles utr on utr.user_tenant_id = ut.id
left join "roles-permissions".roles r on r.id = utr.role_id
where ut.tenant_id = '<tenant-id>'
order by u.email;
```

```sql
select c.id,
       c.name,
       c.section,
       co.name as course_name,
       count(ct.id) as teacher_count
from "academic-structure".classes c
left join "academic-structure".courses co on co.id = c.course_id
left join "academic-structure".class_teachers ct
  on ct.class_id = c.id and ct.is_active = true
where c.tenant_id = '<tenant-id>'
group by c.id, c.name, c.section, co.name
order by co.name, c.name;
```

```sql
select l.id,
       l.title,
       l.status,
       l.review_status,
       count(m.id) as material_count
from learning.lessons l
left join learning.lesson_materials m on m.lesson_id = l.id
where l.tenant_id = '<tenant-id>'
group by l.id, l.title, l.status, l.review_status
order by l.created_at desc;
```

```sql
select a.id,
       a.name,
       a.status,
       a.max_points,
       count(aq.id) as question_count,
       count(s.id) as submission_count
from "academic-structure".assessments a
left join "academic-structure".assessment_questions aq
  on aq.assessment_id = a.id
left join "academic-structure".assessment_submissions s
  on s.assessment_id = a.id
where a.tenant_id = '<tenant-id>'
group by a.id, a.name, a.status, a.max_points
order by a.created_at desc;
```

## Safety Rules

- Prefer read-only queries in DBeaver.
- Do not export result sets containing tenant/user/student/staff data.
- Do not commit generated ER diagrams or schema reports.
- Do not paste database URLs into issue trackers, prompts, docs, or screenshots.
- Treat table and column names for auth, MFA, sessions, JWT secrets, health,
  finance, and security policy as sensitive architecture details.
- Verify access control through the API and app, not through privileged database
  browsing.
