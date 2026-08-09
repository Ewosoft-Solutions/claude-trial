import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';

import '@workspace/ui/globals.css';
import { ThemeProvider } from './providers/theme-provider';
import { PwaRegister } from './providers/pwa-register';
import { ColorScheme } from '@workspace/ui/custom/colors/color-scheme';
import { SessionNoticeToaster } from './providers/session-notice-toaster';
import { ThemeColorMeta } from './providers/theme-color-meta';

// Aurora type system: Plus Jakarta Sans is the single UI face — body, display
// headings, AND stat-card numbers all resolve to it. Geist Mono is code only.
// The semantic font tokens live in ui globals.css (--font-sans / --font-display
// / --font-stat / --font-mono) — repoint any of them there to change a role's
// face app-wide in one place.
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
