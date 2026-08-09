import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { cookies } from 'next/headers';

import { FONT_SCALE_COOKIE, normalizeFontScaleStep } from '@/lib/font-scale';
import { getSession } from '@/lib/session';

// Geom (geometric display face) — the page-title font. Not yet in Next's
// next/font/google catalogue, so it's self-hosted the equivalent way: the
// Fontsource package bundles the woff2s (subset by unicode-range, font-display:
// swap), served from our own origin with no runtime call to Google. `wght.css`
// is the upright variable file (weights 300–900); the italic axis is omitted.
// Consumed app-wide through the --font-display token in ui globals.css.
import '@fontsource-variable/geom/wght.css';
import '@workspace/ui/globals.css';
import { ThemeProvider } from './providers/theme-provider';
import { PwaRegister } from './providers/pwa-register';
import { ColorScheme } from '@workspace/ui/custom/colors/color-scheme';
import { SessionNoticeToaster } from './providers/session-notice-toaster';
import { ThemeColorMeta } from './providers/theme-color-meta';

// Aurora type system: Plus Jakarta Sans is the UI face — body, stat-card
// numbers, and the default for headings — while Geom (above) is the page-title
// display face. Geist Mono is code only. The semantic font tokens live in ui
// globals.css (--font-sans / --font-display / --font-stat / --font-mono) —
// repoint any of them there to change a role's face app-wide in one place.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'School With Ease',
  description:
    'School With Ease — multi-tenant school management with auth, students, classes, assessments, communications, and reporting.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'School With Ease',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // First-paint default by OS scheme (matches the app --background: pure white
  // in light, flat #07060f in dark). ThemeColorMeta then refines this to the
  // user's actually-resolved theme (incl. classic-dark) on the client.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#07060f' },
  ],
};

const showColorSchemePreview =
  process.env.NEXT_PUBLIC_SHOW_COLOR_SCHEME_PREVIEW === 'true';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Apply the user's text-size preference on <html> before first paint
  // (flash-free, no hydration jump). Only font-size tokens read this var, so
  // text scales without the layout zooming. The cookie is the fast per-device
  // value; on a fresh device (no cookie) fall back to the account preference so
  // the choice follows the user across devices. getSession() is cache()-deduped
  // with the (app) layout and returns null (no fetch) on public pages.
  const cookieScale = (await cookies()).get(FONT_SCALE_COOKIE)?.value;
  const accountScale = cookieScale
    ? undefined
    : (await getSession())?.fontScale;
  const fontScale = normalizeFontScaleStep(cookieScale ?? accountScale);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-font-scale={fontScale.key}
      style={{ '--font-scale': String(fontScale.value) } as React.CSSProperties}
    >
      <body className={`${jakarta.variable} ${geistMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={['light', 'dark', 'classic-dark']}
          disableTransitionOnChange
        >
          {children}
          <ThemeColorMeta />
          <SessionNoticeToaster />
          {showColorSchemePreview ? <ColorScheme /> : null}
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
