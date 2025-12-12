"use client";

import { AuthProvider } from '../providers/auth-provider';

export function ProtectedProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

