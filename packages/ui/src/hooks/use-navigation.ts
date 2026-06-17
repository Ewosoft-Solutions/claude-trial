/* ============================================================
   useResolvedNavigation — React binding for the M4 nav model

   A thin, memoized wrapper over the pure `resolveNavigation`
   resolver (lib/navigation.ts). It carries no framework-routing
   dependency: the host passes the current path (e.g. from
   `usePathname()`) and an `onNavigate` callback (e.g. `router.push`).
   This keeps `@workspace/ui` free of `next/navigation` while still
   giving apps a stable, recomputation-friendly hook.
   ============================================================ */

import * as React from 'react';

import {
  resolveNavigation,
  type ResolveNavigationOptions,
} from '@workspace/ui/lib/navigation';
import type { ViewerContext } from '@workspace/ui/types/access.types';
import type {
  NavigationConfig,
  ResolvedNavigation,
} from '@workspace/ui/types/navigation.types';

/**
 * Resolve a navigation config for a viewer + current route, memoized on the
 * inputs. `onNavigate` (when supplied) routes resolved items through a
 * callback instead of plain links — pass a stable reference (e.g. wrap
 * `router.push` in `useCallback`) so the memo only recomputes when the
 * config, viewer, or path actually change.
 */
export function useResolvedNavigation(
  config: NavigationConfig,
  viewer: ViewerContext,
  currentPath: string,
  options: ResolveNavigationOptions = {},
): ResolvedNavigation {
  const { onNavigate } = options;
  return React.useMemo(
    () => resolveNavigation(config, viewer, currentPath, { onNavigate }),
    [config, viewer, currentPath, onNavigate],
  );
}
