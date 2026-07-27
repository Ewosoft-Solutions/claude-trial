import type { Metadata, Viewport } from 'next';
import { Caveat, Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';

import '@workspace/ui/globals.css';
import { ThemeProvider } from './providers/theme-provider';
import { PwaRegister } from './providers/pwa-register';
import { ColorScheme } from '@workspace/ui/custom/colors/color-scheme';
import { SessionNoticeToaster } from './providers/session-notice-toaster';
import { ThemeColorMeta } from './providers/theme-color-meta';

// Aurora type system: Plus Jakarta Sans for body/UI, Caveat for the
// handwritten display face (headings + big stat numbers). Applied app-wide.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
});
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  weight: ['400', '500', '600', '700'],
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
      <body
        className={`${jakarta.variable} ${caveat.variable} ${geistMono.variable}`}
      >
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
