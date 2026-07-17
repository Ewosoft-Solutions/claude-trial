import type { ResumeState } from './resume-state';

interface ResumeSession {
  permissions: readonly string[];
  scope: 'school' | 'platform';
  defaultSchoolId?: string;
  activeProfileId?: string;
}

const APPROVED_ROOTS = new Set([
  'overview',
  'students',
  'classes',
  'attendance',
  'finance',
  'reports',
  'transport',
  'library',
  'health',
  'hr',
  'events',
  'assistant',
  'account',
  'settings',
]);

function hasAny(session: ResumeSession, permissions: string[]): boolean {
  return permissions.some((permission) =>
    session.permissions.includes(permission),
  );
}

export function resolveResumeTarget(
  state: ResumeState | null,
  session: ResumeSession,
): { target: string; modalKey?: ResumeState['modalKey']; restored: boolean } {
  if (!state) return { target: '/overview', restored: false };
  if (state.tenantId && state.tenantId !== session.defaultSchoolId) {
    return { target: '/overview', restored: false };
  }
  if (state.profileId && state.profileId !== session.activeProfileId) {
    return { target: '/overview', restored: false };
  }

  const pathname = new URL(state.path, 'https://resume.invalid').pathname;
  if (/^\/classes\/assessments\/take\/[^/]+$/.test(pathname)) {
    return session.permissions.includes('assessments.take')
      ? { target: state.path, modalKey: state.modalKey, restored: true }
      : { target: '/overview', restored: false };
  }
  if (pathname === '/platform/settings/security') {
    return session.scope === 'platform' &&
      session.permissions.includes('platform.security')
      ? { target: state.path, modalKey: state.modalKey, restored: true }
      : { target: '/overview', restored: false };
  }
  if (pathname.startsWith('/platform/tenants')) {
    return session.scope === 'platform' &&
      session.permissions.includes('platform.tenants')
      ? { target: state.path, modalKey: state.modalKey, restored: true }
      : { target: '/overview', restored: false };
  }
  if (pathname.startsWith('/platform/')) {
    return { target: '/overview', restored: false };
  }
  if (pathname.startsWith('/settings/')) {
    return hasAny(session, ['settings.view', 'settings.security'])
      ? { target: state.path, modalKey: state.modalKey, restored: true }
      : { target: '/overview', restored: false };
  }

  const root = pathname.split('/').filter(Boolean)[0];
  return root && APPROVED_ROOTS.has(root)
    ? { target: state.path, modalKey: state.modalKey, restored: true }
    : { target: '/overview', restored: false };
}
