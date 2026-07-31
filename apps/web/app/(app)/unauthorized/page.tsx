'use client';

import { useRouter } from 'next/navigation';

import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <ShellMain className="justify-center">
      <PermissionDeniedState
        title="You don’t have access to this area"
        description="Your current school profile does not include access to this page. Ask a school administrator to review your access if you need it for your work."
        primaryAction={{
          label: 'Go to overview',
          href: '/overview',
        }}
        secondaryAction={{
          label: 'Go back',
          onClick: () => router.back(),
        }}
      />
    </ShellMain>
  );
}
