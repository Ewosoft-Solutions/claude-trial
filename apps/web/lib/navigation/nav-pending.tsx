'use client';

/* ============================================================
   Where a navigation's placeholder belongs

   The App Router does not commit a navigation until the destination's
   payload arrives, so between the click and the commit the shell is
   still rendering the page being LEFT. Something has to stand in for
   it, or the reader sees stale content — measured at up to 10s.

   The question this module answers is WHERE that stand-in goes.

   Replacing everything below the app shell is right when the whole page
   changes (Admissions → People). It is wrong when the destination sits
   inside chrome that is already on screen and is not going anywhere:
   the settings frame, a record's header and tabs. Skeletoning those
   repaints furniture the reader is still looking at.

   So a scope is a path prefix whose LAYOUT survives navigation within
   it. If a navigation stays inside one, the app shell stands down and
   that scope's own layout swaps only its body.

   Cross-scope navigation has no alternative: the destination's layout
   is not mounted yet, so only the shell can hold the placeholder.
   ============================================================ */

import * as React from 'react';

export interface NavPendingValue {
  /** A navigation is in flight. */
  navPending: boolean;
  /** Where it is going, before the router agrees. */
  pendingHref: string | null;
  /** Where the router still thinks we are. */
  pathname: string;
}

const Ctx = React.createContext<NavPendingValue>({
  navPending: false,
  pendingHref: null,
  pathname: '/',
});

export const NavPendingProvider = Ctx.Provider;

export function useNavPending(): NavPendingValue {
  return React.useContext(Ctx);
}

const strip = (href: string) => href.split('?')[0] ?? href;

/**
 * The chrome a path lives inside, or null when its page owns everything.
 *
 * Only layouts that render VISIBLE, persistent furniture belong here —
 * permission-gate layouts (`return <>{children}</>`) have nothing to protect.
 */
export function chromeScope(href: string): string | null {
  const path = strip(href);
  if (path === '/settings' || path.startsWith('/settings/')) return '/settings';
  if (path === '/account' || path.startsWith('/account/')) return '/account';
  // A record profile: its header and tab strip persist across its tabs.
  const profile = /^\/people\/([^/]+)/.exec(path);
  if (profile?.[1]) return `/people/${profile[1]}`;
  return null;
}

/**
 * Whether a navigation stays inside chrome that is already on screen — in
 * which case the app shell must NOT replace it.
 */
export function staysWithinChrome(from: string, to: string | null): boolean {
  if (to === null) return false;
  const scope = chromeScope(from);
  return scope !== null && scope === chromeScope(to);
}

/**
 * True for the layout that owns the chrome a pending navigation is staying
 * inside — i.e. the one that should swap its own body.
 */
export function usePendingWithinChrome(): boolean {
  const { navPending, pendingHref, pathname } = useNavPending();
  return navPending && staysWithinChrome(pathname, pendingHref);
}
