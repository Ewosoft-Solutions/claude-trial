export const SwaggerTags = {
  app: { name: 'app', description: 'Application root/health endpoints' },
  auth: { name: 'auth', description: 'Authentication endpoints' },
  mfa: { name: 'mfa', description: 'Multi-factor authentication endpoints' },
  securityPolicies: {
    name: 'security-policies',
    description: 'Security policy management endpoints',
  },
  platformSecurityPolicies: {
    name: 'platform-security-policies',
    description: 'Platform-level security policies',
  },
  tenant: {
    name: 'tenant',
    description: 'Tenant (school) management endpoints',
  },
  links: { name: 'links', description: 'Links management endpoints' },
  students: { name: 'students', description: 'Student management endpoints' },
  academicStructure: {
    name: 'academic-structure',
    description: 'Academic structure endpoints',
  },
  courses: { name: 'courses', description: 'Course catalog endpoints' },
  classes: { name: 'classes', description: 'Class/section endpoints' },
  gradingSystems: {
    name: 'grading-systems',
    description: 'Grading system endpoints',
  },
  assessments: { name: 'assessments', description: 'Assessment endpoints' },
  grades: { name: 'grades', description: 'Grades endpoints' },
  announcements: {
    name: 'announcements',
    description: 'Announcements endpoints',
  },
  messages: { name: 'messages', description: 'Messaging endpoints' },
  attendance: { name: 'attendance', description: 'Attendance management endpoints' },
  finance: { name: 'finance', description: 'Finance & billing endpoints' },
  reports: { name: 'reports', description: 'Reporting & analytics endpoints' },
  auditLogs: { name: 'audit-logs', description: 'Audit log endpoints' },
  roles: { name: 'roles', description: 'Role management endpoints' },
  permissions: {
    name: 'permissions',
    description: 'Permission management endpoints',
  },
  breachResponse: {
    name: 'breach-response',
    description: 'Breach response endpoints',
  },
} as const;

export type SwaggerTagConfig = (typeof SwaggerTags)[keyof typeof SwaggerTags];
export const swaggerTagList: SwaggerTagConfig[] = Object.values(SwaggerTags);

export type SwaggerTagName = (typeof swaggerTagList)[number]['name'];
