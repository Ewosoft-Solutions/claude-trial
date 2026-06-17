import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['http://localhost:3000'],
  // Self-contained server output so the preview can be served from a
  // location the sandboxed preview launcher is allowed to read (see
  // AI_HANDOFF.md → Known Issues: macOS TCC blocks ~/Documents).
  output: 'standalone',
  turbopack: {
    root: path.resolve(__dirname, '..', '..'),
  },
};

export default nextConfig;
