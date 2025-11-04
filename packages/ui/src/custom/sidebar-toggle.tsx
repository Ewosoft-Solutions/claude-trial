'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';

import { useSidebar } from '@workspace/ui/components/sidebar';
import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

export function SidebarToggle({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { state, toggleSidebar } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'absolute right-0 top-0 z-30 h-6 w-6 -translate-y-1/2 translate-x-1/2 rounded-full border bg-background shadow-md transition-all hover:bg-accent hover:text-accent-foreground',
        'group-data-[state=collapsed]:translate-x-1/2',
        className,
      )}
      onClick={toggleSidebar}
      {...props}
    >
      {state === 'expanded' ? (
        <ChevronLeft className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

export function MobileSidebarToggle({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      variant="default"
      size="icon-sm"
      className={cn('size-4 text-primary bg-primary-foreground', className)}
      onClick={toggleSidebar}
      {...props}
    >
      <Menu className="h-3.5 w-3.5" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}
