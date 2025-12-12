import { cookies } from 'next/headers';
import { AppSidebar } from '@workspace/ui/custom/app-sidebar';
import {
  SidebarInset,
  SidebarProvider,
} from '@workspace/ui/components/sidebar';
import { SiteHeader } from '../components/site-header';
import ProtectedClient from './protected-client';
import { ProtectedProviders } from './layout.client';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';

  return (
    <ProtectedProviders>
      <ProtectedClient>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <SidebarInset>
            <SiteHeader />
            <main>{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </ProtectedClient>
    </ProtectedProviders>
  );
}
