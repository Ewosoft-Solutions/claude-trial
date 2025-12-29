'use client';

import { type ReactNode } from 'react';
import { AuthProvider } from '../providers/auth-provider';

export function ProtectedProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
