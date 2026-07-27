'use client';

/* ============================================================
   ThemeColorMeta — keep the browser/OS chrome in the app's colour

   <meta name="theme-color"> tints the mobile browser's surrounding UI
   (Safari's top bar, Android's status bar, the PWA splash). A fixed
   value leaves that chrome a different colour from the app canvas when
   the theme changes. This syncs it to the ACTIVE theme's `--background`
   token — read from the computed style so all three themes (light,
   dark, classic-dark) stay in lock-step with zero hardcoding. The
   static `viewport.themeColor` in layout.tsx covers the first paint by
   OS scheme; this refines it to the user's resolved theme.
   ============================================================ */

import * as React from 'react';
import { useTheme } from 'next-themes';

export function ThemeColorMeta() {
  const { theme, resolvedTheme, systemTheme } = useTheme();

  React.useEffect(() => {
    const background = getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
      .trim();
    if (!background) return;

    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', background);
  }, [theme, resolvedTheme, systemTheme]);

  return null;
}
