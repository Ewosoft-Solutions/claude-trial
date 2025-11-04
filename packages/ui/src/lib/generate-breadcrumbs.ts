import type { BreadcrumbItem } from '@workspace/ui/custom/headers/site-breadcrumbs';
import { RouteConfig } from '../types/route-config.types';

/**
 * Generate breadcrumbs from pathname and optional params
 */

export function generateBreadcrumbs(
  pathname: string,
  routeConfig: Record<string, RouteConfig>,
): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  const params: Record<string, string> = {};

  let currentPath = '';
  let currentConfig = routeConfig;

  // Loop through each segment and add it to the breadcrumbs
  segments.forEach((segment) => {
    currentPath += `/${segment}`;

    // First try exact match in root config (for paths like /schools)
    let config = routeConfig[currentPath];

    // If not found in root, try to find in currentConfig's children
    // This handles nested routes like /[schoolId] or /users
    if (!config && currentConfig) {
      // Try exact match first (e.g., /users)
      const exactPattern = `/${segment}`;
      config = currentConfig[exactPattern];

      // If no exact match, try dynamic route pattern (e.g., /[schoolId])
      if (!config) {
        const dynamicRoute = findDynamicRoute(currentConfig);
        if (dynamicRoute) {
          config = dynamicRoute.config;
          // Extract param name from dynamic route pattern (e.g., [schoolId] -> schoolId)
          const paramName = dynamicRoute.pattern.replace(/^\[|\]$/g, '');
          params[paramName] = segment;
        }
      }
    }

    if (config) {
      // Use generateLabel if available, otherwise use label or formatSegment
      let label = config.label || formatSegment(segment);
      if (config.generateLabel) {
        label = config.generateLabel(params);
      }

      // Update href with actual params if it contains dynamic segments
      let href = config.href || currentPath;
      if (config.href && config.href.includes('[')) {
        href = replaceDynamicSegments(config.href, params);
      }

      breadcrumbs.push({
        label,
        href,
      });

      // Move to children for next iteration
      if (config.children) {
        currentConfig = config.children;
      } else {
        currentConfig = {};
      }
    } else {
      breadcrumbs.push({
        label: formatSegment(segment),
        href: currentPath,
      });
      currentConfig = {};
    }
  });

  return breadcrumbs;
}

/**
 * Find a dynamic route pattern (e.g., /[schoolId]) in the config
 */
function findDynamicRoute(
  config: Record<string, RouteConfig>,
): { pattern: string; config: RouteConfig } | null {
  for (const [pattern, routeConfig] of Object.entries(config)) {
    // Check if pattern is a dynamic route (starts with /[ and ends with ])
    if (pattern.startsWith('/[') && pattern.endsWith(']')) {
      return { pattern: pattern.slice(1), config: routeConfig }; // Remove leading /
    }
  }
  return null;
}

/**
 * Replace dynamic segments in href with actual param values
 */
function replaceDynamicSegments(
  href: string,
  params: Record<string, string>,
): string {
  let result = href;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`[${key}]`, value);
  }
  return result;
}

function formatSegment(segment: string) {
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

// http://localhost:3001/schools/school0930/users/user090/edit
