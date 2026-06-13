import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['http://localhost:3000'],
  turbopack: {
    root: path.resolve(__dirname, '..', '..'),
  },
};

export default nextConfig;
