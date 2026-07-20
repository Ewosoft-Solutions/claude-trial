'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Clock3,
  GraduationCap,
  LayoutGrid,
  LoaderCircle,
  Search,
  UserRound,
} from 'lucide-react';

import { Input } from '@workspace/ui/components/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@workspace/ui/components/sheet';
import { cn } from '@workspace/ui/lib/utils';
import { canAccess } from '@workspace/ui/lib/navigation';
import type { ViewerContext } from '@workspace/ui/types/access.types';
import type {
  NavGroupNode,
  NavigationConfig,
  NavNode,
} from '@workspace/ui/types/navigation.types';

type ResultKind = 'page' | 'student' | 'class' | 'person';

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  description: string;
  meta?: string;
  href: string;
}

interface ApiSearchResponse {
  query: string;
  results: SearchResult[];
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigation: NavigationConfig;
  viewer: ViewerContext;
}

const RECENT_KEY = 'swe.global-search.recent.v1';

const KIND_META: Record<
  ResultKind,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  page: { label: 'Pages', icon: LayoutGrid },
  student: { label: 'Students', icon: GraduationCap },
  class: { label: 'Classes', icon: BookOpen },
  person: { label: 'People', icon: UserRound },
};

function collectNodePages(
  nodes: NavNode[],
  viewer: ViewerContext,
  sectionLabel: string,
  groupLabel?: string,
): SearchResult[] {
  return nodes.flatMap((node) => {
    if (!canAccess(node.access, viewer)) return [];
    const own = node.href
      ? [
          {
            id: `page:${node.key}`,
            kind: 'page' as const,
            title: node.label,
            description: [sectionLabel, groupLabel].filter(Boolean).join(' · '),
            href: node.href,
          },
        ]
      : [];
    return [
      ...own,
      ...collectNodePages(node.items ?? [], viewer, sectionLabel, groupLabel),
    ];
  });
}

function collectGroupPages(
  groups: NavGroupNode[] | undefined,
  viewer: ViewerContext,
  sectionLabel: string,
): SearchResult[] {
  return (groups ?? []).flatMap((group) =>
    canAccess(group.access, viewer)
      ? collectNodePages(group.items, viewer, sectionLabel, group.label)
      : [],
  );
}

function navigationPages(
  navigation: NavigationConfig,
  viewer: ViewerContext,
): SearchResult[] {
  const sections = [...navigation.sections, ...(navigation.footer ?? [])];
  const pages = sections.flatMap((section) => {
    if (!canAccess(section.access, viewer)) return [];
    return [
      {
        id: `page:${section.key}`,
        kind: 'page' as const,
        title: section.label,
        description: section.panelHeader?.title ?? 'Page',
        href: section.href,
      },
      ...collectGroupPages(section.groups, viewer, section.label),
    ];
  });

  pages.push(
    {
      id: 'page:account',
      kind: 'page',
      title: 'Account & preferences',
      description: 'Personal settings',
      href: '/account/profile',
    },
    {
      id: 'page:appearance',
      kind: 'page',
      title: 'Appearance',
      description: 'Personal settings',
      href: '/account/appearance',
    },
  );
  return Array.from(new Map(pages.map((page) => [page.href, page])).values());
}

function readRecent(): SearchResult[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value) ? value.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveRecent(result: SearchResult) {
  try {
    const next = [
      result,
      ...readRecent().filter((item) => item.href !== result.href),
    ]
      .slice(0, 6)
      .map(({ id, kind, title, description, meta, href }) => ({
        id,
        kind,
        title,
        description,
        meta,
        href,
      }));
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable in private browsing; search still works.
  }
}

export function GlobalSearch({
  open,
  onOpenChange,
  navigation,
  viewer,
}: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [remoteResults, setRemoteResults] = React.useState<SearchResult[]>([]);
  const [recent, setRecent] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const pages = React.useMemo(
    () => navigationPages(navigation, viewer),
    [navigation, viewer],
  );
  const canSearchRecords = React.useMemo(
    () =>
      ['students.view', 'schedules.view', 'users.view'].some((permission) =>
        viewer.permissions.has(permission),
      ),
    [viewer.permissions],
  );

  React.useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  React.useEffect(() => {
    const trimmed = query.trim();
    setError(null);
    if (
      !open ||
      trimmed.length < 2 ||
      viewer.scope !== 'school' ||
      !canSearchRecords
    ) {
      setRemoteResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=5`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error('Search is unavailable right now.');
        }
        const body = (await response.json()) as ApiSearchResponse;
        setRemoteResults(body.results ?? []);
      } catch (cause) {
        if ((cause as { name?: string }).name !== 'AbortError') {
          setRemoteResults([]);
          setError(
            cause instanceof Error
              ? cause.message
              : 'Search is unavailable right now.',
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canSearchRecords, open, query, viewer.scope]);

  const trimmedQuery = query.trim().toLowerCase();
  const matchingPages = React.useMemo(
    () =>
      trimmedQuery
        ? pages.filter((page) =>
            `${page.title} ${page.description}`
              .toLowerCase()
              .includes(trimmedQuery),
          )
        : [],
    [pages, trimmedQuery],
  );
  const browseResults = React.useMemo(
    () => [
      ...recent,
      ...pages.filter(
        (page) => !recent.some((recentItem) => recentItem.href === page.href),
      ),
    ],
    [pages, recent],
  );
  const results = trimmedQuery
    ? [...matchingPages, ...remoteResults]
    : browseResults;

  React.useEffect(() => setActiveIndex(0), [query, remoteResults]);

  const navigateTo = React.useCallback(
    (result: SearchResult) => {
      saveRecent(result);
      setRecent(readRecent());
      onOpenChange(false);
      router.push(result.href);
    },
    [onOpenChange, router],
  );

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length ? (current + 1) % results.length : 0,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length ? (current - 1 + results.length) % results.length : 0,
      );
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      navigateTo(results[activeIndex]);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="top"
        className="inset-0 h-[100dvh] w-full gap-0 border-0 bg-popover p-0 sm:inset-x-auto sm:left-1/2 sm:top-[9vh] sm:h-[min(76vh,44rem)] sm:w-[min(48rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        <SheetTitle className="sr-only">Search</SheetTitle>
        <SheetDescription className="sr-only">
          Search accessible pages and records in the active school.
        </SheetDescription>

        <div className="flex h-16 shrink-0 items-center gap-3 border-b px-4 pr-12 sm:px-5 sm:pr-12">
          {loading ? (
            <LoaderCircle
              className="size-5 shrink-0 animate-spin text-primary"
              aria-hidden
            />
          ) : (
            <Search
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search students, classes, people, or pages"
            aria-label="Search students, classes, people, or pages"
            aria-controls="global-search-results"
            aria-activedescendant={
              results[activeIndex]
                ? `global-search-result-${activeIndex}`
                : undefined
            }
            className="h-auto border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 sm:text-base"
          />
        </div>

        <div
          id="global-search-results"
          role="listbox"
          aria-label="Search results"
          className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3"
        >
          {!trimmedQuery ? (
            <div className="flex items-center gap-2 px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden /> Browse accessible
              pages
            </div>
          ) : null}

          {results.map((result, index) => {
            const meta = KIND_META[result.kind];
            const Icon = meta.icon;
            return (
              <button
                key={`${result.kind}:${result.id}`}
                id={`global-search-result-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => navigateTo(result)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  index === activeIndex ? 'bg-accent' : 'hover:bg-accent/60',
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {result.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {result.description}
                  </span>
                </span>
                <span className="hidden max-w-40 shrink-0 truncate text-xs capitalize text-muted-foreground sm:block">
                  {result.meta ?? meta.label}
                </span>
              </button>
            );
          })}

          {!results.length && !loading ? (
            <div className="grid min-h-52 place-items-center px-6 text-center">
              <div>
                <Search
                  className="mx-auto mb-3 size-7 text-muted-foreground"
                  aria-hidden
                />
                <p className="text-sm font-semibold text-foreground">
                  {trimmedQuery ? 'No matches found' : 'Nothing to browse yet'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {trimmedQuery
                    ? 'Try a name, student number, class, or page.'
                    : 'Accessible destinations will appear here.'}
                </p>
              </div>
            </div>
          ) : null}
          {error ? (
            <p role="status" className="px-3 py-2 text-sm text-destructive">
              {error} Page results are still available.
            </p>
          ) : null}
        </div>

        <div className="hidden h-10 shrink-0 items-center gap-4 border-t px-5 text-[11px] text-muted-foreground sm:flex [@media(pointer:coarse)]:hidden">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>Esc close</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
