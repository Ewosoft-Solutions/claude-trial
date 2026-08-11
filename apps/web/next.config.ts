import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Hosts allowed to reach the dev server's /_next assets & Server Actions from
  // a non-localhost origin. The Cloudflare tunnel host is added so physical
  // devices can test over HTTPS (passkey/biometric enrolment).
  allowedDevOrigins: ['http://localhost:3000', 'swe-dev.schoolwithease.com'],
  // Self-contained server output so the preview can be served from a
  // location the sandboxed preview launcher is allowed to read (see
  // AI_HANDOFF.md → Known Issues: macOS TCC blocks ~/Documents).
  output: 'standalone',
  turbopack: {
    root: path.resolve(__dirname, '..', '..'),
  },
  // Admissions moved under its domain (/students/admissions). Keep old links
  // (and the retired /students/enrollment duplicate) working.
  async redirects() {
    return [
      {
        source: '/admissions',
        destination: '/students/admissions',
        permanent: false,
      },
      {
        source: '/admissions/:path*',
        destination: '/students/admissions/:path*',
        permanent: false,
      },
      {
        source: '/students/enrollment',
        destination: '/students/admissions',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
