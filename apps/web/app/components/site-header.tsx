'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@workspace/ui/components/button';
import { Separator } from '@workspace/ui/components/separator';
import { SidebarTrigger } from '@workspace/ui/components/sidebar';
import { ModeToggle } from '@workspace/ui/custom/mode-toggle';
import { SiteBreadcrumbs } from '@workspace/ui/custom/headers/site-breadcrumbs';
import { generateBreadcrumbs } from '@workspace/ui/lib/generate-breadcrumbs';
import { RouteConfig } from '@workspace/ui/types/route-config.types';
import { routeConfig } from '@/lib/routes';
import { MobileSidebarToggle } from '@workspace/ui/custom/sidebar-toggle';

export function SiteHeader() {
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(
    pathname,
    routeConfig as Record<string, RouteConfig>,
  );

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      {/* Desktop */}
      <div className="hidden md:flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <div className="flex sm:hidden items-center justify-center">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
        </div>

        <SiteBreadcrumbs items={breadcrumbs} />

        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
            <Link
              href="https://github.com/shadcn-ui/ui/tree/main/apps/v4/app/(examples)/dashboard"
              rel="noopener noreferrer"
              target="_blank"
              className="dark:text-foreground"
            >
              GitHub
            </Link>
          </Button>
        </div>
      </div>
      {/* Mobile */}
      <div className="flex flex-col md:hidden w-full gap-1 px-4 py-2">
        <div className="flex w-full items-center justify-between">
          <div className="flex sm:hidden items-center justify-center">
            <MobileSidebarToggle />
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModeToggle />
            <Button
              variant="ghost"
              asChild
              size="sm"
              className="hidden sm:flex"
            >
              <Link
                href="https://github.com/shadcn-ui/ui/tree/main/apps/v4/app/(examples)/dashboard"
                rel="noopener noreferrer"
                target="_blank"
                className="dark:text-foreground"
              >
                GitHub
              </Link>
            </Button>
          </div>
        </div>
        <div className="w-full -mt-2 mb-1">
          <SiteBreadcrumbs items={breadcrumbs} />
        </div>
      </div>
    </header>
  );
}
