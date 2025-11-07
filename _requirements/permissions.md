# School Management App - Permissions Framework

## Permission-Based Authentication System

**Granular Access Control with Platform Oversight:**

**📋 Reference**: See [Access Control Framework](./access-control.md) for complete role hierarchy, clearance levels, and access scope definitions.

### **Role Hierarchy & Access Levels**

#### **Platform-Level Roles (Platform Owners)**

- **Architect** - Platform architect and owner with unrestricted access to all schools, data, and configurations
- **SuperAdmin** - Platform support staff with controlled access through maker-checker system for resolving issues securely

#### **School-Level Roles (Default System Roles)**

- **Owner** - School owner, CEO, or founder with complete access to their school's operations and data
- **Management** - School management with comprehensive administrative and operational oversight
- **ITSupport** - School IT support responsible for technical and system-related maintenance tasks
- **Finance** - Handles finance, billing, compliance, and legal documentation
- **Operations** - Manages school logistics, resources, and day-to-day operations
- **Teacher** - Academic staff with access to classes, student records, and assessments
- **Parent** - Guardians with access to their children's academic progress and records
- **Student** - Students with access to their own academic and performance data
- **Guest** - Visitors with access limited to publicly available school or platform information

#### **Custom Roles (School-Specific)**

- **Department Head** - Custom role with department-specific permissions
- **Counselor** - Custom role with student support permissions
- **Librarian** - Custom role with library management permissions
- **Staff** - Custom role with general staff permissions
- **Custom Role X** - School-defined roles with specific permission sets

### **Permission System Features**

- **Permissions**: Deep context-aware permissions with resource and action specificity
- **Context-aware**: Permissions are tenant-specific with optional global overrides
- **Hierarchical**: Role-based inheritance with permission overrides
- **Dynamic**: Permissions can be assigned/revoked per user, not just per role
- **Maker-Checker**: Approval workflows for sensitive operations
- **Platform Override**: Emergency access for platform owners

## Platform Oversight & Security Framework

### **SuperAdmin Capabilities (Platform Owners)**

#### **Emergency Override Access**

- **Complete System Access**: Full access to all schools and data
- **Emergency Intervention**: Immediate access during security breaches
- **Data Recovery**: Access to backup and recovery systems
- **System Maintenance**: Platform-wide maintenance and updates
- **Audit Access**: Complete audit trail visibility across all schools

#### **Platform Management Permissions**

- `platform.override` - Emergency override access to any school
- `platform.audit` - View all audit logs across platform
- `platform.maintenance` - Perform system maintenance
- `platform.backup` - Access backup and recovery systems
- `platform.security` - Manage platform-wide security settings
- `platform.tenants` - Manage school tenant accounts
- `platform.billing` - Access platform billing and subscriptions
- `platform.support` - Provide technical support to schools

### **PlatformAdmin Capabilities (Platform Support)**

#### **Limited Platform Access**

- **Support Functions**: Technical support and maintenance
- **Monitoring**: System health and performance monitoring
- **Limited Override**: Emergency access with approval workflow
- **Audit Review**: Limited audit access for support purposes

#### **Platform Support Permissions**

- `platform.support.access` - Access school systems for support
- `platform.monitoring` - View system health and performance
- `platform.audit.limited` - View limited audit information
- `platform.maintenance.limited` - Perform limited maintenance tasks

### **School Management Role Capabilities**

#### **Management Role (School Leadership)**

- **Complete School Access**: Full access to all school data and functions
- **Role Management**: Create and manage custom roles
- **Permission Assignment**: Assign permissions to users and roles
- **System Configuration**: Configure school-specific settings
- **Approval Authority**: Approve sensitive operations

#### **Admin Role (School Administrators)**

- **Broad Administrative Access**: Most school functions except sensitive operations
- **User Management**: Manage users within their school
- **Limited Role Creation**: Create roles with restricted permissions
- **System Configuration**: Limited configuration access

### **Maker-Checker System Implementation**

#### **Approval Workflows for Sensitive Operations**

```typescript
interface ApprovalWorkflow {
  operation: string;
  maker: string; // User who initiates the action
  checker: string; // User who must approve the action
  level: 'school' | 'platform';
  requiredPermissions: string[];
  autoApprove?: boolean;
  timeLimit?: number; // Hours before auto-approval
}

// Sensitive operations requiring approval
const sensitiveOperations = [
  'students.delete',
  'users.delete',
  'roles.create',
  'permissions.modify',
  'financial.transactions',
  'data.export',
  'system.configuration',
  'backup.restore',
];
```

#### **Approval Levels**

##### **Level 1: School-Level Approval**

- **Maker**: Any user with appropriate permissions
- **Checker**: School Management or Admin
- **Operations**: Student deletion, user management, role creation
- **Time Limit**: 24 hours for auto-approval

##### **Level 2: Platform-Level Approval**

- **Maker**: School Management
- **Checker**: PlatformAdmin or SuperAdmin
- **Operations**: School configuration changes, data exports, system settings
- **Time Limit**: 48 hours for auto-approval

##### **Level 3: Emergency Override**

- **Maker**: SuperAdmin
- **Checker**: None (immediate execution)
- **Operations**: Security breach response, emergency data access
- **Audit**: All actions logged with emergency flag

### **Role Creation & Permission Management**

#### **School-Level Role Creation**

```typescript
interface CustomRoleCreation {
  schoolId: string;
  roleName: string;
  permissions: string[];
  createdBy: string; // Must be Management or Admin
  approvedBy: string; // Must be Management
  restrictions: {
    maxPermissions: number;
    restrictedPermissions: string[]; // Cannot assign these
    requiresApproval: boolean;
  };
}
```

#### **Permission Assignment Rules**

- **Management**: Can assign any permission except platform-level
- **Admin**: Can assign most permissions with approval for sensitive ones
- **Custom Roles**: Limited to predefined permission sets
- **Platform Override**: SuperAdmin can assign any permission

### **Security & Audit Framework**

#### **Access Logging**

- **All Actions Logged**: Every action tracked with user, role, and timestamp
- **Platform Override Logging**: Special logging for platform-level access
- **Approval Workflow Logging**: Complete audit trail of maker-checker processes
- **Emergency Access Logging**: Immediate alerts for emergency overrides

#### **Security Monitoring**

- **Unusual Access Patterns**: AI-powered detection of suspicious activity
- **Permission Escalation Alerts**: Notifications for permission changes
- **Cross-School Access Alerts**: Alerts for platform-level access
- **Failed Access Attempts**: Monitoring and alerting for failed permissions

#### **Compliance & Reporting**

- **Audit Reports**: Comprehensive audit reports for compliance
- **Permission Reports**: Detailed permission assignment reports
- **Access Reports**: User access and activity reports
- **Security Reports**: Security event and incident reports

## Comprehensive Permissions Framework

### Permission Summary

The system includes **274 permissions** organized across **26 categories**:

- **Student Management** (14 permissions)
- **Academic Management** (11 permissions)
- **Grade & Assessment** (15 permissions)
- **Attendance** (7 permissions)
- **Financial** (12 permissions)
- **Communication** (12 permissions)
- **Staff Management** (10 permissions)
- **Reports & Analytics** (9 permissions)
- **System Administration** (18 permissions)
- **Platform** (13 permissions)
- **Library** (7 permissions)
- **Transportation** (8 permissions)
- **Cafeteria** (8 permissions)
- **Health** (8 permissions)
- **Facilities** (8 permissions)
- **Events** (7 permissions)
- **Sports** (8 permissions)
- **Clubs** (7 permissions)
- **Parent Portal** (7 permissions)
- **Inventory** (7 permissions)
- **Safety** (7 permissions)
- **Compliance** (6 permissions)
- **Timetable** (12 permissions)
- **Exams** (12 permissions)
- **Admissions** (15 permissions)

### Student Management Permissions

- `students.view` - View student list and basic info
- `students.view.detailed` - View detailed student profiles
- `students.view.personal_info` - Access personal/contact information
- `students.view.academic_records` - View academic history and transcripts
- `students.view.medical_info` - Access medical/health information
- `students.edit` - Edit basic student information
- `students.edit.personal_info` - Modify personal/contact details
- `students.edit.academic_info` - Update academic records
- `students.edit.medical_info` - Modify medical information
- `students.create` - Add new students to the system
- `students.delete` - Remove students from the system
- `students.export` - Export student data
- `students.import` - Import student data from external sources

### Academic Management Permissions

- `courses.view` - View course catalog and schedules
- `courses.view.detailed` - View detailed course information
- `courses.edit` - Modify course information
- `courses.create` - Create new courses
- `courses.delete` - Remove courses
- `schedules.view` - View class schedules
- `schedules.edit` - Modify schedules
- `schedules.create` - Create new schedules
- `subjects.view` - View subject listings
- `subjects.edit` - Modify subject information
- `subjects.create` - Add new subjects

### Grade & Assessment Permissions

- `grades.view` - View grades and assessments
- `grades.view.own` - View only own grades (students)
- `grades.view.children` - View children's grades (parents)
- `grades.edit` - Edit grades and assessments
- `grades.edit.own_classes` - Edit grades for own classes only
- `grades.create` - Create new grade entries
- `grades.delete` - Delete grade entries
- `grades.export` - Export grade reports
- `assessments.view` - View assessment details
- `assessments.edit` - Modify assessments
- `assessments.create` - Create new assessments
- `transcripts.view` - View academic transcripts
- `transcripts.edit` - Modify transcripts
- `transcripts.generate` - Generate official transcripts

### Attendance Management Permissions

- `attendance.view` - View attendance records
- `attendance.view.own` - View own attendance (students)
- `attendance.view.children` - View children's attendance (parents)
- `attendance.edit` - Edit attendance records
- `attendance.edit.own_classes` - Edit attendance for own classes
- `attendance.create` - Mark attendance
- `attendance.export` - Export attendance reports

### Financial Management Permissions

- `fees.view` - View fee structures and payments
- `fees.view.own` - View own fee information (students/parents)
- `fees.edit` - Modify fee structures
- `fees.create` - Create new fee categories
- `fees.delete` - Remove fee categories
- `payments.view` - View payment records
- `payments.edit` - Process payments
- `payments.refund` - Process refunds
- `billing.view` - View billing information
- `billing.edit` - Modify billing details
- `financial_reports.view` - Access financial reports
- `financial_reports.export` - Export financial data

### Communication Permissions

- `messages.view` - View messages and announcements
- `messages.send` - Send messages
- `messages.send.broadcast` - Send broadcast messages
- `messages.send.parents` - Send messages to parents
- `messages.send.students` - Send messages to students
- `messages.send.staff` - Send messages to staff
- `announcements.view` - View announcements
- `announcements.create` - Create announcements
- `announcements.edit` - Edit announcements
- `announcements.delete` - Delete announcements
- `notifications.view` - View notification settings
- `notifications.edit` - Modify notification preferences

### Staff Management Permissions

- `staff.view` - View staff directory
- `staff.view.detailed` - View detailed staff information
- `staff.edit` - Edit staff information
- `staff.create` - Add new staff members
- `staff.delete` - Remove staff members
- `staff.schedules` - Manage staff schedules
- `staff.performance` - View performance records
- `departments.view` - View department information
- `departments.edit` - Modify departments
- `departments.create` - Create new departments

### Reports & Analytics Permissions

- `reports.view` - Access general reports
- `reports.academic` - View academic reports
- `reports.financial` - View financial reports
- `reports.attendance` - View attendance reports
- `reports.export` - Export report data
- `analytics.view` - Access analytics dashboard
- `analytics.advanced` - Access advanced analytics
- `dashboard.view` - View main dashboard
- `dashboard.customize` - Customize dashboard layout

### System Administration Permissions

- `settings.view` - View system settings
- `settings.edit` - Modify system settings
- `settings.school` - Edit school-specific settings
- `settings.users` - Manage user accounts
- `settings.roles` - Manage roles and permissions
- `settings.backup` - Access backup/restore functions
- `settings.audit` - View audit logs
- `settings.integrations` - Manage third-party integrations
- `settings.theme` - Customize school theme/branding
- `settings.features` - Enable/disable features

### Library Management Permissions

- `library.view` - View library catalog
- `library.books.view` - View book information
- `library.books.edit` - Edit book records
- `library.books.create` - Add new books
- `library.books.delete` - Remove books
- `library.circulation` - Manage book circulation
- `library.reservations` - Handle book reservations

### Transportation Permissions

- `transportation.view` - View transportation routes
- `transportation.edit` - Modify routes and schedules
- `transportation.students` - Manage student transportation assignments
- `transportation.drivers` - Manage driver information
- `transportation.vehicles` - Manage school bus/vehicle information
- `transportation.routes` - Create and modify bus routes
- `transportation.tracking` - Real-time bus location tracking
- `transportation.emergency` - Handle transportation emergencies

### Food Service & Cafeteria Permissions

- `cafeteria.view` - View cafeteria operations
- `cafeteria.menu` - Manage meal menus and planning
- `cafeteria.orders` - Process meal orders and pre-orders
- `cafeteria.payments` - Handle meal payment processing
- `cafeteria.inventory` - Manage food inventory and supplies
- `cafeteria.nutrition` - Track nutritional information
- `cafeteria.allergies` - Manage dietary restrictions and allergies
- `cafeteria.reports` - Generate food service reports

### Health & Medical Services Permissions

- `health.view` - View health records and medical information
- `health.records` - Manage student health records
- `health.medications` - Track medication administration
- `health.emergency` - Handle medical emergencies
- `health.immunizations` - Track vaccination records
- `health.visits` - Log nurse visits and medical incidents
- `health.reports` - Generate health-related reports
- `health.parents` - Communicate health issues to parents

### Facilities & Maintenance Permissions

- `facilities.view` - View facility information
- `facilities.rooms` - Manage classroom and room assignments
- `facilities.maintenance` - Schedule and track maintenance
- `facilities.equipment` - Manage school equipment inventory
- `facilities.reservations` - Handle room/equipment reservations
- `facilities.cleaning` - Track cleaning schedules and tasks
- `facilities.security` - Manage security systems and access
- `facilities.utilities` - Monitor utility usage and costs

### Events & Activities Management Permissions

- `events.view` - View school events and activities
- `events.create` - Create new events and activities
- `events.edit` - Modify event details
- `events.delete` - Remove events
- `events.registration` - Handle event registrations
- `events.attendance` - Track event attendance
- `events.volunteers` - Manage volunteer coordination
- `events.facilities` - Reserve facilities for events

### Sports & Athletics Permissions

- `sports.view` - View sports programs and teams
- `sports.teams` - Manage team rosters and information
- `sports.schedules` - Handle game and practice schedules
- `sports.equipment` - Manage sports equipment inventory
- `sports.facilities` - Reserve sports facilities
- `sports.medical` - Track athlete medical clearances
- `sports.performance` - Record athletic performance data
- `sports.parents` - Communicate with parents about sports

### Clubs & Extracurricular Permissions

- `clubs.view` - View clubs and organizations
- `clubs.manage` - Manage club information and rosters
- `clubs.meetings` - Schedule and track club meetings
- `clubs.activities` - Plan and organize club activities
- `clubs.funding` - Manage club budgets and fundraising
- `clubs.leadership` - Track club leadership positions
- `clubs.achievements` - Record club achievements and awards

### Parent & Community Engagement Permissions

- `parent_portal.view` - Access parent portal features
- `parent_portal.communicate` - Send messages to parents
- `parent_portal.volunteer` - Manage parent volunteer programs
- `parent_portal.meetings` - Schedule parent-teacher conferences
- `parent_portal.feedback` - Collect and manage parent feedback
- `community.view` - View community engagement activities
- `community.partnerships` - Manage community partnerships

### Inventory & Asset Management Permissions

- `inventory.view` - View school inventory and assets
- `inventory.equipment` - Manage equipment assignments
- `inventory.textbooks` - Track textbook distribution
- `inventory.supplies` - Manage classroom supplies
- `inventory.technology` - Track technology devices
- `inventory.maintenance` - Schedule asset maintenance
- `inventory.disposal` - Handle asset disposal and recycling

### Safety & Security Permissions

- `safety.view` - View safety procedures and protocols
- `safety.incidents` - Report and track safety incidents
- `safety.drills` - Schedule and track safety drills
- `safety.visitors` - Manage visitor check-in/out
- `safety.emergency` - Handle emergency procedures
- `safety.cameras` - Access security camera systems
- `safety.alerts` - Send emergency alerts and notifications

### Compliance & Reporting Permissions

- `compliance.view` - View compliance requirements
- `compliance.reports` - Generate compliance reports
- `compliance.audits` - Conduct internal audits
- `compliance.training` - Track staff training requirements
- `compliance.policies` - Manage policy documentation
- `compliance.legal` - Handle legal and regulatory matters

### Lesson & Timetable Management Permissions

- `timetable.view` - View class timetables and schedules
- `timetable.edit` - Modify timetables and schedules
- `timetable.create` - Create new timetables
- `timetable.delete` - Remove timetables
- `timetable.teachers` - Assign teachers to classes
- `timetable.rooms` - Assign rooms to classes
- `timetable.subjects` - Manage subject scheduling
- `timetable.conflicts` - Resolve scheduling conflicts
- `timetable.export` - Export timetable data
- `timetable.import` - Import timetable from external sources
- `timetable.substitution` - Handle teacher substitutions
- `timetable.breaks` - Manage break and lunch periods

### Exam & Assessment Scheduling Permissions

- `exams.view` - View exam schedules and timetables
- `exams.create` - Create exam schedules
- `exams.edit` - Modify exam timetables
- `exams.delete` - Remove exam schedules
- `exams.rooms` - Assign exam rooms and venues
- `exams.invigilators` - Assign exam supervisors
- `exams.students` - Manage student exam registrations
- `exams.conflicts` - Resolve exam scheduling conflicts
- `exams.results` - Manage exam results and grading
- `exams.reports` - Generate exam reports
- `exams.emergency` - Handle exam emergencies and rescheduling
- `exams.accommodations` - Manage special exam accommodations

### Admissions Management Permissions

- `admissions.view` - View admission applications and status
- `admissions.create` - Create new admission applications
- `admissions.edit` - Modify application details
- `admissions.delete` - Remove applications
- `admissions.review` - Review and evaluate applications
- `admissions.approve` - Approve admission applications
- `admissions.reject` - Reject admission applications
- `admissions.waitlist` - Manage waitlist and priority
- `admissions.interviews` - Schedule and conduct interviews
- `admissions.documents` - Manage required documents
- `admissions.fees` - Handle admission fees and payments
- `admissions.communication` - Communicate with applicants
- `admissions.reports` - Generate admission reports
- `admissions.quotas` - Manage admission quotas and limits
- `admissions.criteria` - Set admission criteria and requirements

## Context-Aware Permission Examples

- `students.edit.own_classes` - Edit students only in own classes
- `grades.edit.own_students` - Edit grades only for own students
- `reports.view.department` - View reports only for own department
- `messages.send.own_classes` - Send messages only to own class students

## Role-Based Permission Inheritance

### Admin Role

- **Global Access**: All permissions across all modules
- **System Management**: Full control over tenant settings and configurations
- **User Management**: Create, modify, and delete user accounts
- **Security**: Access to audit logs and security monitoring

### Department Head Role

- **Department Scope**: All teacher permissions + department-specific permissions
- **Staff Management**: View and manage department staff
- **Reports**: Access to department-level reports and analytics
- **Scheduling**: Manage department schedules and resources

### Teacher Role

- **Class Management**: Manage own classes and students
- **Academic Functions**: Grade management, attendance, lesson planning
- **Communication**: Send messages to students and parents
- **Limited Access**: Cannot access system administration or other departments

### Student Role

- **Personal Access**: View own grades, attendance, and schedule
- **Limited Communication**: Send messages to teachers and staff
- **No Administrative Access**: Cannot modify system data

### Parent Role

- **Child Access**: View children's academic and attendance information
- **Communication**: Send messages to teachers and school staff
- **Limited Scope**: Cannot access other students' information

### Staff Role

- **Operational Access**: Access to relevant operational modules
- **Limited Academic Access**: Cannot modify grades or academic records
- **Communication**: Send messages within scope of responsibilities

## Permission Implementation Notes

### Granularity Levels

1. **Module Level**: Access to entire functional areas
2. **Action Level**: Specific actions within modules (view, edit, create, delete)
3. **Resource Level**: Access to specific resources or data
4. **Context Level**: Scope-based access (own classes, department, etc.)

### Security Considerations

- **Principle of Least Privilege**: Users get minimum required permissions
- **Regular Audits**: Periodic review of user permissions
- **Temporary Access**: Time-limited permission grants
- **Emergency Override**: Admin override capabilities for critical situations

### Polymorphic Adaptations

- **Elementary Schools**: Simplified permissions, parent-heavy access
- **High Schools**: Complex academic permissions, student self-service
- **Universities**: Department-based permissions, research access
- **Boarding Schools**: Additional residential and safety permissions
