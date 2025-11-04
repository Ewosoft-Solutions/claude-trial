import { RouteConfig } from '@workspace/ui/types/route-config.types';

// Centralized route-to-breadcrumb mapping
export const routeConfig: Record<string, RouteConfig> = {
  '/schools': {
    label: 'Schools',
    href: '/schools',
    children: {
      '/[schoolId]': {
        label: 'School Details',
        href: '/schools/[schoolId]',
        // generateLabel: (params) => `School ${params.schoolId} Details`,
        children: {
          '/users': {
            label: 'Users',
            href: '/schools/[schoolId]/users',
            children: {
              '/[userId]': {
                label: 'User Details',
                href: '/schools/[schoolId]/users/[userId]',
                // generateLabel: (params) => `User ${params.userId}`,
                children: {
                  '/edit': {
                    label: 'Edit User',
                    href: '/schools/[schoolId]/users/[userId]/edit',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
