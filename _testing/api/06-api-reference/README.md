# 6. API Reference

Quick-reference table of all API endpoints. For interactive testing, use Swagger UI at `http://localhost:3000/api/docs`.

**Legend:**
- **Auth** = Requires JWT `Authorization: Bearer <token>` header
- **Tenant** = Requires active tenant context (set during school selection)
- **CL** = Minimum clearance level required
- **Perm** = Requires specific permission via PermissionGuard

---

## Health Check

| Method | Path | Auth | Description          |
| ------ | ---- | ---- | -------------------- |
| GET    | `/`  | No   | Returns "Hello World!" |

---

## Authentication (`/auth`)

| Method | Path                        | Auth | Description                            |
| ------ | --------------------------- | ---- | -------------------------------------- |
| POST   | `/auth/login`               | No   | Login with email and password          |
| POST   | `/auth/verify-mfa-login`    | No   | Complete MFA challenge during login    |
| POST   | `/auth/select-school`       | Yes  | Select tenant, get scoped JWT tokens   |
| POST   | `/auth/refresh`             | No   | Refresh access token                   |
| POST   | `/auth/request-password-reset` | No | Request password reset email        |
| POST   | `/auth/reset-password`      | No   | Reset password with token              |
| POST   | `/auth/logout`              | Yes  | Logout current session                 |
| POST   | `/auth/logout-all`          | Yes  | Logout all sessions                    |

---

## MFA (`/auth/mfa`)

All require JWT authentication.

| Method | Path                                   | Description                       |
| ------ | -------------------------------------- | --------------------------------- |
| GET    | `/auth/mfa/methods`                    | List active MFA methods           |
| POST   | `/auth/mfa/setup/sms`                  | Setup SMS-based MFA               |
| POST   | `/auth/mfa/setup/email`               | Setup email-based MFA             |
| POST   | `/auth/mfa/setup/totp`                | Setup TOTP (authenticator app)    |
| POST   | `/auth/mfa/setup/webauthn`            | Setup WebAuthn (passkey)          |
| POST   | `/auth/mfa/verify-activate`           | Verify and activate pending MFA   |
| POST   | `/auth/mfa/verify/initiate`           | Initiate MFA verification         |
| POST   | `/auth/mfa/verify`                    | Verify MFA challenge              |
| POST   | `/auth/mfa/recovery/generate`         | Generate recovery codes           |
| POST   | `/auth/mfa/recovery/verify`           | Verify a recovery code            |
| PUT    | `/auth/mfa/methods/:methodId/primary` | Set primary MFA method            |
| PUT    | `/auth/mfa/methods/:methodId/disable` | Disable an MFA method             |
| DELETE | `/auth/mfa/methods/:methodId`         | Delete an MFA method              |

---

## Security Policies (`/security-policies`)

| Method | Path                   | Auth | CL  | Description              |
| ------ | ---------------------- | ---- | --- | ------------------------ |
| GET    | `/security-policies`   | Yes  | —   | Get school security policy |
| POST   | `/security-policies`   | Yes  | —   | Assign/update policy     |
| PUT    | `/security-policies/tier` | Yes | — | Change security tier     |

---

## Platform Security (`/platform/security-policies`)

| Method | Path                                            | Auth | CL  | Description               |
| ------ | ----------------------------------------------- | ---- | --- | ------------------------- |
| POST   | `/platform/security-policies/:schoolId/emergency` | Yes | 9+  | Set emergency policy     |
| DELETE | `/platform/security-policies/:schoolId/emergency` | Yes | 9+  | Remove emergency policy  |
| GET    | `/platform/security-policies/:schoolId`          | Yes  | 9+  | Get any school's policy  |

---

## Breach Response (`/breach-response`)

| Method | Path                          | Auth | CL   | Description                    |
| ------ | ----------------------------- | ---- | ---- | ------------------------------ |
| POST   | `/breach-response/school`     | Yes  | 9+   | School-level breach response   |
| POST   | `/breach-response/profile`    | Yes  | 9+   | Profile-level breach response  |
| POST   | `/breach-response/platform`   | Yes  | 10   | Platform-wide breach response  |

---

## Tenant Management (`/tenant`)

All require JWT authentication.

| Method | Path                                     | CL  | Description                       |
| ------ | ---------------------------------------- | --- | --------------------------------- |
| POST   | `/tenant/register`                       | 8+  | Register a new school             |
| GET    | `/tenant`                                | 9+  | List all tenants                  |
| GET    | `/tenant/:id`                            | —   | Get tenant by ID                  |
| PUT    | `/tenant/:id`                            | 8+  | Update tenant info                |
| PATCH  | `/tenant/:id/status`                     | 9+  | Update tenant status              |
| GET    | `/tenant/:id/configuration`              | —   | Get tenant configuration          |
| PUT    | `/tenant/:id/configuration`              | 8+  | Update tenant configuration       |
| POST   | `/tenant/:id/validate-email-domain`      | 8+  | Validate email domain DNS         |
| GET    | `/tenant/:id/verification-txt-record`    | —   | Get DNS TXT verification record   |
| POST   | `/tenant/:id/invitations`                | 7+  | Create user invitation            |
| POST   | `/tenant/:id/invitations/bulk`           | 7+  | Bulk create invitations           |
| POST   | `/tenant/invitations/accept`             | —*  | Accept invitation (public)        |
| POST   | `/tenant/:id/users`                      | 7+  | Create user directly              |
| POST   | `/tenant/:id/users/bulk`                 | 7+  | Bulk create users                 |
| POST   | `/tenant/:id/users/add`                  | 7+  | Add existing user to tenant       |
| GET    | `/tenant/:id/users`                      | 7+  | List user profiles                |
| GET    | `/tenant/:id/users/:profileId`           | 7+  | Get user profile                  |
| PUT    | `/tenant/users/:userId`                  | 7+  | Update user                       |
| PUT    | `/tenant/:id/users/:profileId`           | 7+  | Update user profile               |
| DELETE | `/tenant/:id/users/:profileId`           | 7+  | Remove user from tenant           |
| POST   | `/tenant/:id/jwt-secret/rotate`          | 9+  | Rotate tenant JWT secret          |
| POST   | `/tenant/:id/jwt-secret/rotate-emergency`| 9+  | Emergency JWT rotation            |
| GET    | `/tenant/:id/jwt-secret/rotation-status` | 9+  | Get JWT rotation status           |

*Accept invitation requires the invitation token, not JWT auth.

---

## Roles (`/roles`)

| Method | Path         | Auth | CL  | Description         |
| ------ | ------------ | ---- | --- | ------------------- |
| GET    | `/roles`     | Yes  | —   | List all roles      |
| GET    | `/roles/:id` | Yes  | —   | Get role by ID      |
| POST   | `/roles`     | Yes  | 7+  | Create custom role  |

---

## Permissions (`/permissions`)

| Method | Path                                   | Auth | CL  | Description                  |
| ------ | -------------------------------------- | ---- | --- | ---------------------------- |
| GET    | `/permissions`                         | Yes  | —   | List permissions (searchable)|
| GET    | `/permissions/:id`                     | Yes  | —   | Get permission by ID         |
| GET    | `/permissions/category/:category`      | Yes  | —   | Get by category              |
| GET    | `/permissions/role/:roleId`            | Yes  | —   | Get permissions for a role   |
| POST   | `/permissions/role/:roleId/assign`     | Yes  | 7+  | Assign permissions to role   |

---

## Students (`/students`)

All require JWT + Tenant Context + PermissionGuard.

| Method | Path                                            | Description                     |
| ------ | ----------------------------------------------- | ------------------------------- |
| POST   | `/students`                                     | Create student record           |
| GET    | `/students`                                     | Search/list students            |
| GET    | `/students/:id`                                 | Get student detail              |
| PUT    | `/students/:id`                                 | Update student                  |
| PATCH  | `/students/:id/status`                          | Update enrollment status        |
| PATCH  | `/students/:id/profile`                         | Update profile sections         |
| DELETE | `/students/:id`                                 | Delete student                  |
| POST   | `/students/:id/enrollments`                     | Enroll student in a class       |
| GET    | `/students/:id/enrollments`                     | List student enrollments        |
| PATCH  | `/students/:id/enrollments/:enrollmentId/status`| Update enrollment status        |
| POST   | `/students/guardians/bulk-upsert`               | Bulk upsert guardians           |

---

## Academic Years (`/academic-years`)

All require JWT + Tenant Context + PermissionGuard.

| Method | Path                                 | Description           |
| ------ | ------------------------------------ | --------------------- |
| POST   | `/academic-years`                    | Create academic year  |
| GET    | `/academic-years`                    | List academic years   |
| GET    | `/academic-years/:id`                | Get academic year     |
| PUT    | `/academic-years/:id`                | Update academic year  |
| DELETE | `/academic-years/:id`                | Delete academic year  |
| POST   | `/academic-years/:id/terms`          | Create term           |
| GET    | `/academic-years/:id/terms`          | List terms            |
| GET    | `/academic-years/terms/:termId`      | Get term              |
| PUT    | `/academic-years/terms/:termId`      | Update term           |
| DELETE | `/academic-years/terms/:termId`      | Delete term           |

---

## Courses (`/courses`)

All require JWT + Tenant Context + PermissionGuard.

| Method | Path             | Description    |
| ------ | ---------------- | -------------- |
| POST   | `/courses`       | Create course  |
| GET    | `/courses`       | List courses   |
| GET    | `/courses/:id`   | Get course     |
| PUT    | `/courses/:id`   | Update course  |
| DELETE | `/courses/:id`   | Delete course  |

---

## Classes (`/classes`)

All require JWT + Tenant Context + PermissionGuard.

| Method | Path                               | Description                |
| ------ | ---------------------------------- | -------------------------- |
| POST   | `/classes`                         | Create class               |
| GET    | `/classes`                         | List classes               |
| GET    | `/classes/:id`                     | Get class                  |
| PUT    | `/classes/:id`                     | Update class               |
| DELETE | `/classes/:id`                     | Delete class               |
| PATCH  | `/classes/:id/schedule`            | Update timetable/schedule  |
| POST   | `/classes/:id/students`            | Assign student to class    |
| GET    | `/classes/:id/students`            | List class students        |
| DELETE | `/classes/:id/students/:studentId` | Remove student from class  |

---

## Grading Systems (`/grading-systems`)

All require JWT + Tenant Context + PermissionGuard.

| Method | Path                    | Description            |
| ------ | ----------------------- | ---------------------- |
| POST   | `/grading-systems`      | Create grading system  |
| GET    | `/grading-systems`      | List grading systems   |
| PUT    | `/grading-systems/:id`  | Update grading system  |
| DELETE | `/grading-systems/:id`  | Delete grading system  |

---

## Assessments (`/assessments`)

All require JWT + Tenant Context + PermissionGuard.

| Method | Path                | Description         |
| ------ | ------------------- | ------------------- |
| POST   | `/assessments`      | Create assessment   |
| GET    | `/assessments`      | List assessments    |
| GET    | `/assessments/:id`  | Get assessment      |
| PUT    | `/assessments/:id`  | Update assessment   |
| DELETE | `/assessments/:id`  | Delete assessment   |

---

## Grades (`/grades`)

All require JWT + Tenant Context + PermissionGuard.

| Method | Path                                    | Description                  |
| ------ | --------------------------------------- | ---------------------------- |
| POST   | `/grades`                               | Create/record a grade        |
| PUT    | `/grades/:id`                           | Update a grade               |
| GET    | `/grades/assessment/:assessmentId`      | List grades for assessment   |
| GET    | `/grades/assessment/:assessmentId/stats`| Grade analytics/statistics   |
| GET    | `/grades/student/:studentId`            | Student grades (report data) |
| POST   | `/grades/student/:studentId/report-card`| Generate report card         |

---

## Announcements (`/announcements`)

All require JWT + Tenant Context + PermissionGuard.

| Method | Path                              | Description           |
| ------ | --------------------------------- | --------------------- |
| POST   | `/announcements`                  | Create announcement   |
| GET    | `/announcements`                  | List announcements    |
| GET    | `/announcements/:id`              | Get announcement      |
| PUT    | `/announcements/:id`              | Update announcement   |
| PATCH  | `/announcements/:id/publish`      | Publish announcement  |
| PATCH  | `/announcements/:id/archive`      | Archive announcement  |
| DELETE | `/announcements/:id`              | Delete announcement   |

---

## Messages (`/messages`)

All require JWT + Tenant Context + PermissionGuard.

| Method | Path                    | Description       |
| ------ | ----------------------- | ----------------- |
| POST   | `/messages`             | Send message      |
| GET    | `/messages/inbox`       | List inbox        |
| GET    | `/messages/sent`        | List sent         |
| GET    | `/messages/thread/:id`  | Get thread        |
| POST   | `/messages/read`        | Mark as read      |

---

## Reports (`/reports`)

All require JWT + Tenant Context + PermissionGuard.

| Method | Path                            | Description             |
| ------ | ------------------------------- | ----------------------- |
| GET    | `/reports/academic-performance` | Academic performance    |
| GET    | `/reports/dashboard`            | Dashboard metrics       |
| POST   | `/reports/export`               | Export report (queued)  |
| POST   | `/reports/schedule`             | Schedule a report       |
| POST   | `/reports/custom`               | Custom report builder   |

---

## Audit Logs (`/audit-logs`)

All require JWT + Tenant Context + Clearance 7+.

| Method | Path                                          | Description              |
| ------ | --------------------------------------------- | ------------------------ |
| GET    | `/audit-logs`                                 | Query audit logs         |
| GET    | `/audit-logs/:id`                             | Get single audit log     |
| GET    | `/audit-logs/resource/:resource/:resourceId`  | Logs for a resource      |
| GET    | `/audit-logs/actor/:actorId`                  | Logs for an actor        |

---

## Links (`/links`)

Demo/utility endpoints — no authentication required.

| Method | Path          | Description  |
| ------ | ------------- | ------------ |
| POST   | `/links`      | Create link  |
| GET    | `/links`      | List links   |
| GET    | `/links/:id`  | Get link     |
| PATCH  | `/links/:id`  | Update link  |
| DELETE | `/links/:id`  | Delete link  |
