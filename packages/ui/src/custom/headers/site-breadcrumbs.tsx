'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@workspace/ui/components/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';

export type BreadcrumbItem = {
  label: string;
  href?: string; // If omitted, renders as BreadcrumbPage (current page)
  items?: Array<{ label: string; href: string }>; // For dropdown ellipsis
};

export type SiteBreadcrumbsProps = {
  items: BreadcrumbItem[];
  homeLabel?: string; // Custom label for home (default: "Home")
  homeHref?: string; // Custom href for home (default: "/")
};

export function SiteBreadcrumbs({
  items,
  homeLabel = 'Home',
  homeHref = '/',
}: SiteBreadcrumbsProps) {
  const MAX_ITEMS = 3;
  // Always include home as first item
  const allItems: BreadcrumbItem[] = [
    { label: homeLabel, href: homeHref },
    ...items,
  ];

  // Determine which items to show, collapse, or hide
  const shouldCollapse = allItems.length > MAX_ITEMS;
  const visibleItems: (BreadcrumbItem | undefined)[] = [];
  const collapsedItems: BreadcrumbItem[] = [];

  if (shouldCollapse) {
    // Show: Home + ... + last 2 items (or last item if only 1 visible slot)
    const lastVisible = MAX_ITEMS - 1; // Reserve 1 for ellipsis
    visibleItems.push(allItems[0]); // Home

    // Collapse middle items
    collapsedItems.push(...allItems.slice(1, -lastVisible));

    // Show last N items
    visibleItems.push(...allItems.slice(-lastVisible));
  } else {
    visibleItems.push(...allItems);
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const shouldShowCollapsed = shouldCollapse && index === 1; // Show ellipsis after home

          return (
            <React.Fragment key={item?.href || item?.label}>
              {shouldShowCollapsed && item && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex items-center gap-1">
                        <BreadcrumbEllipsis className="size-4" />
                        <span className="sr-only">Toggle menu</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {collapsedItems.map(
                          (collapsedItem) =>
                            collapsedItem && (
                              <DropdownMenuItem
                                key={collapsedItem.href || collapsedItem.label}
                                asChild
                              >
                                <Link href={collapsedItem.href || '#'}>
                                  {collapsedItem.label}
                                </Link>
                              </DropdownMenuItem>
                            ),
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </BreadcrumbItem>
                </>
              )}

              {index > 0 && item && <BreadcrumbSeparator />}

              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="whitespace-nowrap">
                    {item?.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      className="whitespace-nowrap"
                      href={item?.href || '#'}
                    >
                      {item?.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
