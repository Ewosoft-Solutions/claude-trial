import type { MetadataRoute } from 'next';

/**
 * Web app manifest (PWA Phase 2, mobile-web-hybrid.md). Makes the app
 * installable with a standalone display mode and the school brand colours.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'School With Ease',
    short_name: 'SchoolWithEase',
    description:
      'Multi-tenant school management — students, classes, attendance, finance, and reporting.',
    start_url: '/overview',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f6df5',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
