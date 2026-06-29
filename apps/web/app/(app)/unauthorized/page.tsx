'use client';

import { ShieldOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@workspace/ui/components/button';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <ShellMain>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldOff className="size-8" />
        </span>
        <div className="max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Access restricted
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to view this page. If you think this
            is a mistake, contact your school administrator.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Go back
          </Button>
          <Button onClick={() => router.push('/overview')}>Dashboard</Button>
        </div>
      </div>
    </ShellMain>
  );
}
