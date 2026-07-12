import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import '@workspace/ui/globals.css';
import { ThemeProvider } from './providers/theme-provider';
import { PwaRegister } from './providers/pwa-register';
import { ColorScheme } from '@workspace/ui/custom/colors/color-scheme';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
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
  themeColor: '#4f6df5',
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
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {showColorSchemePreview ? <ColorScheme /> : null}
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
