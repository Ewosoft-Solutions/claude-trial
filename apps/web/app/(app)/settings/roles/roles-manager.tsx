'use client';

/**
 * WB1-5 · Role editor + effective-access preview.
 *
 * Wires the previously-dead "Add role" into a working flow: pick a template →
 * name + scope → live effective-access PREVIEW (the matrix, each permission with
 * its source pool + a plain-language reason, searchable over resource.action.
 * context), with sensitive capabilities in a destructive badge and separation-
 * of-duties conflicts in a warning callout. Any existing role can be opened to
 * explain its effective access + see who's affected. All evaluation is
 * server-side (POST /roles/preview, GET /roles/:id/effective-access); this only
 * renders it.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Plus, ShieldAlert, Users } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { StateTone } from '@workspace/ui/types/states.types';

export interface ApiRole {
  id: string;
  name?: string | null;
  description?: string | null;
  clearanceLevel?: number | null;
  roleType?: string | null;
  members?: number;
}

export interface RoleTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  clearanceLevel: number;
  poolIds: string[];
  permissionPoolNames: string[];
  unresolvedPools: string[];
  sensitive: boolean;
}

interface AccessEntry {
  permission: string;
  label: string;
  resource: string;
  action: string;
  context: string | null;
  requiredClearance: number;
  sourcePool: string | null;
  sensitive: boolean;
  reason: string;
}
interface SoDConflict {
  a: string;
  b: string;
  rule: string;
}
interface EffectiveAccess {
  roleName: string | null;
  clearanceLevel: number;
  scope: { type: string; value?: string; label?: string } | null;
  templateKey: string | null;
  entries: AccessEntry[];
  sensitive: string[];
  conflicts: SoDConflict[];
  summary: string;
}
interface Affected {
  count: number;
  profiles: {
    userTenantId: string;
    name: string;
    email: string | null;
    status: string;
  }[];
}

function clearanceTone(level: number): StateTone {
  if (level >= 7) return 'destructive';
  if (level >= 5) return 'warning';
  if (level >= 3) return 'info';
  return 'neutral';
}

export function RolesManager({
  roles,
  templates,
  clearanceLevel,
}: {
  roles: ApiRole[];
  templates: RoleTemplate[];
  clearanceLevel: number;
}) {
  const canManage = clearanceLevel >= 7;
  const [previewRole, setPreviewRole] = React.useState<ApiRole | null>(null);

  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const roleTypes = React.useMemo(
    () =>
      Array.from(
        new Set(roles.map((r) => r.roleType).filter(Boolean) as string[]),
      ).sort(),
    [roles],
  );

  const columns: DirectoryColumn<ApiRole>[] = [
    {
      id: 'name',
      header: 'Role',
      sortable: true,
      cell: (role) => (
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 font-medium text-foreground">
            {role.name ?? role.id}
            {role.roleType ? (
              <StatusBadge tone="info">{role.roleType}</StatusBadge>
            ) : null}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {role.description ?? 'No description'}
          </span>
        </div>
      ),
    },
    {
      id: 'members',
      header: 'Members',
      align: 'end',
      sortable: true,
      cell: (role) => (
        <span className="tabular-nums text-muted-foreground">
          {role.members ?? 0}
        </span>
      ),
    },
    {
      id: 'clearance',
      header: 'Clearance',
      align: 'end',
      sortable: true,
      cell: (role) => {
        const level = Number(role.clearanceLevel ?? 0);
        return (
          <StatusBadge tone={clearanceTone(level)} dot>
            Level {level}
          </StatusBadge>
        );
      },
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const roleType = filters.roleType;
    let out = roles.filter((role) => {
      const name = (role.name ?? role.id).toLowerCase();
      const desc = (role.description ?? '').toLowerCase();
      const matchesQ =
        !q ||
        name.includes(q) ||
        desc.includes(q) ||
        (role.roleType?.toLowerCase().includes(q) ?? false);
      const matchesType = !roleType || role.roleType === roleType;
      return matchesQ && matchesType;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'members'
          ? dir * (Number(a.members ?? 0) - Number(b.members ?? 0))
          : sort.field === 'clearance'
            ? dir *
              (Number(a.clearanceLevel ?? 0) - Number(b.clearanceLevel ?? 0))
            : dir * (a.name ?? a.id).localeCompare(b.name ?? b.id),
      );
    }
    return out;
  }, [roles, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <DirectoryTable<ApiRole>
        title="Roles"
        description={`${filtered.length} ${filtered.length === 1 ? 'role' : 'roles'}`}
        columns={columns}
        rows={pageRows}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.name ?? r.id}
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sort={sort}
        onSortChange={(field) =>
          setSort((cur) =>
            cur?.field !== field
              ? { field, dir: 'asc' }
              : cur.dir === 'asc'
                ? { field, dir: 'desc' }
                : null,
          )
        }
        onRowClick={canManage ? (role) => setPreviewRole(role) : undefined}
        caption="Tenant roles"
        search={{
          value: term,
          onChange: setTerm,
          placeholder: 'Search role or description…',
          label: 'Search roles',
          id: 'roles-search',
        }}
        filters={
          roleTypes.length > 1
            ? [
                {
                  key: 'roleType',
                  label: 'Type',
                  options: roleTypes.map((t) => ({ value: t, label: t })),
                },
              ]
            : []
        }
        filterValues={filters}
        onFilterChange={(key, value) =>
          setFilters((f) => ({ ...f, [key]: value }))
        }
        onClearFilters={() => setFilters({})}
        toolbarActions={
          canManage ? (
            <RoleEditorDialog
              templates={templates}
              maxClearance={Math.min(clearanceLevel, 7)}
            />
          ) : undefined
        }
        emptyState={
          <EmptyState
            compact
            title={hasQuery ? 'No roles match your filters' : 'No roles found'}
            description={
              hasQuery
                ? 'Try a different search term, or clear the filters.'
                : 'Tenant roles returned by the API will appear here.'
            }
          />
        }
      />

      <RolePreviewDialog
        role={previewRole}
        onClose={() => setPreviewRole(null)}
      />
    </div>
  );
}

/* ---- Effective-access presentation (shared) ----------------------------- */

function EffectiveAccessView({ access }: { access: EffectiveAccess }) {
  const [q, setQ] = React.useState('');
  const query = q.trim().toLowerCase();
  const entries = query
    ? access.entries.filter(
        (e) =>
          e.permission.toLowerCase().includes(query) ||
          e.resource.toLowerCase().includes(query) ||
          e.action.toLowerCase().includes(query) ||
          (e.context ?? '').toLowerCase().includes(query) ||
          e.label.toLowerCase().includes(query),
      )
    : access.entries;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{access.summary}</p>

      {access.conflicts.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--warning)]/40 bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle
              className="size-4 text-[var(--warning)]"
              aria-hidden
            />
            Separation-of-duties conflicts
          </p>
          <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {access.conflicts.map((c) => (
              <li key={`${c.a}-${c.b}`}>
                <span className="font-medium text-foreground">
                  {c.a} + {c.b}
                </span>{' '}
                — {c.rule}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {access.sensitive.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <ShieldAlert className="size-3.5" aria-hidden /> Sensitive:
          </span>
          {access.sensitive.map((s) => (
            <StatusBadge key={s} tone="destructive">
              {s}
            </StatusBadge>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search permissions (resource.action.context)…"
          aria-label="Search permissions"
        />
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
          {entries.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {access.entries.length === 0
                ? 'No permissions granted yet — choose a template.'
                : 'No permissions match your search.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li
                  key={e.permission}
                  className="flex items-start justify-between gap-3 p-2.5"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 font-mono text-xs text-foreground">
                      {e.permission}
                      {e.sensitive ? (
                        <StatusBadge tone="destructive">sensitive</StatusBadge>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.label}
                      {e.sourcePool ? ` · ${e.sourcePool}` : ''}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    clr {e.requiredClearance}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const SCOPE_TYPES = [
  { value: 'global', label: 'Whole school (no scope)' },
  { value: 'campus', label: 'A campus' },
  { value: 'department', label: 'A department' },
];

/* ---- Create a role from a template -------------------------------------- */

function RoleEditorDialog({
  templates,
  maxClearance,
}: {
  templates: RoleTemplate[];
  maxClearance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [templateKey, setTemplateKey] = React.useState('');
  const [name, setName] = React.useState('');
  const [scopeType, setScopeType] = React.useState('global');
  const [scopeLabel, setScopeLabel] = React.useState('');
  const [preview, setPreview] = React.useState<EffectiveAccess | null>(null);
  const [busy, setBusy] = React.useState(false);

  const template = templates.find((t) => t.key === templateKey) ?? null;
  const clearance = Math.min(template?.clearanceLevel ?? 0, maxClearance);

  const scope =
    scopeType === 'global'
      ? null
      : {
          type: scopeType,
          label: scopeLabel.trim() || undefined,
          value: scopeLabel.trim()
            ? scopeLabel.trim().toLowerCase().replace(/\s+/g, '-')
            : undefined,
        };

  // Live preview whenever the draft changes.
  React.useEffect(() => {
    if (!open || !template) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch('/api/roles/preview', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              clearanceLevel: clearance,
              poolIds: template.poolIds,
              scope,
              templateKey: template.key,
              name: name.trim() || template.name,
            }),
          });
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as EffectiveAccess;
          if (!cancelled) setPreview(data);
        } catch {
          if (!cancelled) setPreview(null);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // scope is derived from scopeType/scopeLabel; list those to avoid a new
    // object identity re-triggering every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateKey, name, scopeType, scopeLabel, clearance]);

  const reset = () => {
    setTemplateKey('');
    setName('');
    setScopeType('global');
    setScopeLabel('');
    setPreview(null);
  };

  const create = async () => {
    if (!template) return;
    setBusy(true);
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || template.name,
          description: template.description ?? undefined,
          clearanceLevel: clearance,
          permissionPoolIds: template.poolIds,
          templateKey: template.key,
          scope,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          data?.message ?? `Could not create role (${res.status})`,
        );
      }
      toast.success('Role created');
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden /> Add role
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a role</DialogTitle>
          <DialogDescription>
            Start from a template, scope it, and preview exactly what it grants
            before you save.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-template">Template</Label>
            <Select value={templateKey} onValueChange={setTemplateKey}>
              <SelectTrigger id="role-template">
                <SelectValue placeholder="Choose a preset" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.name}
                    {t.category ? ` · ${t.category}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {template?.sensitive ? (
              <span className="text-xs text-[var(--warning)]">
                This preset grants sensitive access.
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder={template ? template.name : 'e.g. Bursar (Campus A)'}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-scope-type">Scope</Label>
            <Select value={scopeType} onValueChange={setScopeType}>
              <SelectTrigger id="role-scope-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {scopeType !== 'global' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-scope-label">
                {scopeType === 'campus' ? 'Campus' : 'Department'} name
              </Label>
              <Input
                id="role-scope-label"
                value={scopeLabel}
                maxLength={80}
                onChange={(e) => setScopeLabel(e.target.value)}
                placeholder="e.g. Campus A"
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Clearance</span>
            <StatusBadge tone={clearanceTone(clearance)} dot>
              Level {clearance}
            </StatusBadge>
            {scope ? (
              <span className="text-xs text-muted-foreground">
                Scoped to {scope.label ?? scope.type}. Enforcement lands in a
                later slice; the preview explains it now.
              </span>
            ) : null}
          </div>
        </div>

        {template ? (
          preview ? (
            <EffectiveAccessView access={preview} />
          ) : (
            <div
              className="h-40 animate-pulse rounded-lg border border-border bg-card/40"
              aria-hidden
            />
          )
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Choose a template to preview its effective access.
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" disabled={busy || !template} onClick={create}>
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Explain an existing role ------------------------------------------- */

function RolePreviewDialog({
  role,
  onClose,
}: {
  role: ApiRole | null;
  onClose: () => void;
}) {
  const [access, setAccess] = React.useState<EffectiveAccess | null>(null);
  const [affected, setAffected] = React.useState<Affected | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!role) return;
    setAccess(null);
    setAffected(null);
    setLoading(true);
    void (async () => {
      try {
        const [a, w] = await Promise.all([
          fetch(`/api/roles/${role.id}/effective-access`, {
            cache: 'no-store',
          }).then((r) =>
            r.ok ? (r.json() as Promise<EffectiveAccess>) : null,
          ),
          fetch(`/api/roles/${role.id}/affected`, { cache: 'no-store' }).then(
            (r) => (r.ok ? (r.json() as Promise<Affected>) : null),
          ),
        ]);
        setAccess(a);
        setAffected(w);
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role?.name ?? 'Role'}</DialogTitle>
          <DialogDescription>
            Effective access — inheritance, source pool, scope and who&rsquo;s
            affected.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div
            className="h-40 animate-pulse rounded-lg border border-border bg-card/40"
            aria-hidden
          />
        ) : access ? (
          <div className="flex flex-col gap-5">
            <EffectiveAccessView access={access} />
            {affected ? (
              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Users className="size-4 text-muted-foreground" aria-hidden />
                  Who&rsquo;s affected ({affected.count})
                </p>
                {affected.count === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No one currently holds this role.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {affected.profiles.slice(0, 20).map((p) => (
                      <li
                        key={p.userTenantId}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{p.name}</span>
                        <StatusBadge
                          tone={p.status === 'active' ? 'success' : 'neutral'}
                        >
                          {p.status}
                        </StatusBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Could not load effective access for this role.
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
