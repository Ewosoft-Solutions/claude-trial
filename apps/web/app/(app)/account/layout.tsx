'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Fingerprint, Palette, UserCircle, UsersRound, X } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';

import { isSafeRedirectPath } from '@/lib/auth-cookies';

const SECTIONS = [
  {
    href: '/account/profile',
    label: 'Profile',
    description: 'Your personal details',
    icon: UserCircle,
  },
  {
    href: '/account/roles',
    label: 'Schools & roles',
    description: 'Default sign-in context',
    icon: UsersRound,
  },
  {
    href: '/account/security',
    label: 'Security',
    description: 'Biometric sign-in',
    icon: Fingerprint,
  },
  {
    href: '/account/appearance',
    label: 'Appearance',
    description: 'Theme preference',
    icon: Palette,
  },
] as const;

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReturn = searchParams.get('from');
  const returnTo =
    isSafeRedirectPath(requestedReturn) &&
    !requestedReturn.startsWith('/account')
      ? requestedReturn
      : '/overview';
  const returnQuery = `?from=${encodeURIComponent(returnTo)}`;

  function close() {
    router.replace(returnTo);
  }

  return (
    <div
      className="fixed inset-0 z-40 h-[100dvh] bg-background/75 backdrop-blur-sm sm:p-5 lg:p-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
    >
      <h1 id="account-settings-title" className="sr-only">
        Account & preferences
      </h1>
      <div className="mx-auto grid h-full w-full overflow-hidden bg-background shadow-2xl sm:max-w-6xl sm:grid-cols-[15rem_minmax(0,1fr)] sm:rounded-2xl sm:border sm:border-border">
        <aside className="hidden border-r border-border bg-sidebar p-4 sm:flex sm:flex-col">
          <div className="px-2 pb-4 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Personal
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">
              Account & preferences
            </p>
          </div>
          <nav aria-label="Personal settings" className="flex flex-col gap-1">
            {SECTIONS.map((section) => {
              const active = pathname === section.href;
              const Icon = section.icon;
              return (
                <Link
                  key={section.href}
                  href={`${section.href}${returnQuery}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    active
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {section.label}
                    </span>
                    <span className="block truncate text-[11px]">
                      {section.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-0 flex-col">
          <div className="shrink-0 border-b border-border pt-[env(safe-area-inset-top)]">
            <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-6">
              <div className="min-w-0 flex-1 sm:hidden">
                <p className="truncate text-xs text-muted-foreground">
                  Personal
                </p>
                <p className="truncate text-base font-bold text-foreground">
                  Account & preferences
                </p>
              </div>
              <div className="hidden flex-1 sm:block" />
              <button
                type="button"
                onClick={close}
                aria-label="Close account settings"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav
              aria-label="Personal settings"
              className="flex min-w-0 gap-1 overflow-x-auto px-3 pb-2 sm:hidden"
            >
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = pathname === section.href;
                return (
                  <Link
                    key={section.href}
                    href={`${section.href}${returnQuery}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      active
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    <span>{section.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-3xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
