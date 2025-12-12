import { AuthProvider } from '../providers/auth-provider';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <main className="min-h-screen">{children}</main>
    </AuthProvider>
  );
}

