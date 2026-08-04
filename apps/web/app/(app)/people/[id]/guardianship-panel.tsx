'use client';

/**
 * WB1-4 · Guardianship authority / priority / consent on the person detail.
 *
 * Lists a person's caregiver relationships (their guardians when the person is a
 * student/ward, and their wards when the person is a guardian) with authority
 * (custody, pickup, medical, emergency, billing), per-category contact consent,
 * verification, and the effective-dated lifecycle. Management actions are gated
 * on `guardians.manage` (server-side authoritative; `canManage` only decides
 * whether the controls render).
 */
import * as React from 'react';
import { toast } from 'sonner';
import { Ban, Loader2, Pencil, Plus, ShieldCheck } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import { Checkbox } from '@workspace/ui/components/checkbox';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';

import { isSearchable } from '@/lib/input-validation';

import { Section } from '../person-detail-ui';
import {
  GUARDIAN_RELATIONSHIPS,
  guardianRoleLabel,
  humanize,
  initials,
  wardRoleLabel,
} from '../person-detail.types';

/** A small initials avatar for a person, so rows/dialogs are easy to confirm. */
function PersonAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <Avatar className={className ?? 'size-8'}>
      <AvatarFallback seed={name} className="text-[10px] font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Avatar + name + subtitle chip — a "who am I looking at" confirmation row. */
function PersonIdentity({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-2.5">
      <PersonAvatar name={name} className="size-9 shrink-0" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium capitalize text-foreground">
          {name}
        </span>
        {sub ? (
          <span className="truncate text-xs text-muted-foreground">{sub}</span>
        ) : null}
      </div>
    </div>
  );
}

export interface Guardianship {
  id: string;
  guardianPersonId: string;
  guardianName: string;
  wardPersonId: string;
  wardName: string;
  relationship: string;
  isPrimary: boolean;
  legalGuardian: boolean;
  contactPriority: number | null;
  custodyType: string | null;
  canPickup: boolean;
  canAuthorizeMedical: boolean;
  isEmergencyContact: boolean;
  isBillingContact: boolean;
  consent: {
    results: boolean;
    finance: boolean;
    attendance: boolean;
    general: boolean;
  };
  verified: boolean;
  verificationMethod: string | null;
  effectiveTo: string | null;
}

interface GuardForm {
  relationship: string;
  isPrimary: boolean;
  legalGuardian: boolean;
  custodyType: string;
  canPickup: boolean;
  canAuthorizeMedical: boolean;
  isEmergencyContact: boolean;
  isBillingContact: boolean;
  consentResults: boolean;
  consentFinance: boolean;
  consentAttendance: boolean;
  consentGeneral: boolean;
}

const CUSTODY = ['full', 'joint', 'partial', 'none', 'visitation'];
const VERIFY_METHODS = ['document', 'in_person', 'id_check', 'existing_record'];

function emptyForm(): GuardForm {
  return {
    relationship: 'parent',
    isPrimary: false,
    legalGuardian: false,
    custodyType: '',
    canPickup: false,
    canAuthorizeMedical: false,
    isEmergencyContact: false,
    isBillingContact: false,
    consentResults: true,
    consentFinance: true,
    consentAttendance: true,
    consentGeneral: true,
  };
}

function formFrom(g: Guardianship): GuardForm {
  return {
    relationship: g.relationship,
    isPrimary: g.isPrimary,
    legalGuardian: g.legalGuardian,
    custodyType: g.custodyType ?? '',
    canPickup: g.canPickup,
    canAuthorizeMedical: g.canAuthorizeMedical,
    isEmergencyContact: g.isEmergencyContact,
    isBillingContact: g.isBillingContact,
    consentResults: g.consent.results,
    consentFinance: g.consent.finance,
    consentAttendance: g.consent.attendance,
    consentGeneral: g.consent.general,
  };
}

function toPayload(f: GuardForm): Record<string, unknown> {
  return {
    relationship: f.relationship || 'parent',
    isPrimary: f.isPrimary,
    legalGuardian: f.legalGuardian,
    ...(f.custodyType ? { custodyType: f.custodyType } : {}),
    canPickup: f.canPickup,
    canAuthorizeMedical: f.canAuthorizeMedical,
    isEmergencyContact: f.isEmergencyContact,
    isBillingContact: f.isBillingContact,
    consentResults: f.consentResults,
    consentFinance: f.consentFinance,
    consentAttendance: f.consentAttendance,
    consentGeneral: f.consentGeneral,
  };
}

export function GuardianshipPanel({
  personId,
  isWard,
  isGuardian,
  canManage,
}: {
  personId: string;
  isWard: boolean;
  isGuardian: boolean;
  canManage: boolean;
}) {
  const [asWard, setAsWard] = React.useState<Guardianship[]>([]);
  const [asGuardian, setAsGuardian] = React.useState<Guardianship[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const jobs: Promise<Guardianship[]>[] = [];
      if (isWard) {
        jobs.push(
          fetch(`/api/guardianships?wardPersonId=${personId}`, {
            cache: 'no-store',
          }).then((r) => (r.ok ? r.json() : Promise.reject())),
        );
      } else {
        jobs.push(Promise.resolve([]));
      }
      if (isGuardian) {
        jobs.push(
          fetch(`/api/guardianships?guardianPersonId=${personId}`, {
            cache: 'no-store',
          }).then((r) => (r.ok ? r.json() : Promise.reject())),
        );
      } else {
        jobs.push(Promise.resolve([]));
      }
      const [wards, guardians] = await Promise.all(jobs);
      setAsWard(wards ?? []);
      setAsGuardian(guardians ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [personId, isWard, isGuardian]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!isWard && !isGuardian) return null;

  return (
    <Section
      title="Guardianship"
      action={
        canManage && isWard ? (
          <AddGuardianDialog wardPersonId={personId} onDone={load} />
        ) : null
      }
    >
      {loading ? (
        <div
          className="h-20 animate-pulse rounded-lg border border-border bg-card/40"
          aria-hidden
        />
      ) : error ? (
        <div className="rounded-lg border border-border bg-card/40 p-4 text-sm">
          <p className="text-muted-foreground">Could not load guardianships.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {isWard ? (
            <RelGroup
              heading="Guardians of this person"
              rels={asWard}
              nameOf={(g) => g.guardianName}
              // These rows are the ward's GUARDIANS → show the guardian's role.
              roleLabel={guardianRoleLabel}
              emptyText="No guardians recorded."
              canManage={canManage}
              onChanged={load}
            />
          ) : null}
          {isGuardian ? (
            <RelGroup
              heading="Wards"
              rels={asGuardian}
              nameOf={(g) => g.wardName}
              // These rows are this person's WARDS → show the ward's role
              // (the inverse), so "Amara · Child" not "Amara · Parent".
              roleLabel={wardRoleLabel}
              emptyText="No wards recorded."
              canManage={canManage}
              onChanged={load}
            />
          ) : null}
        </div>
      )}
    </Section>
  );
}

function RelGroup({
  heading,
  rels,
  nameOf,
  roleLabel,
  emptyText,
  canManage,
  onChanged,
}: {
  heading: string;
  rels: Guardianship[];
  nameOf: (g: Guardianship) => string;
  /** Direction-aware relationship label for the rows in this group. */
  roleLabel: (relationship: string) => string;
  emptyText: string;
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {heading}
      </span>
      {rels.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        rels.map((g) => (
          <GuardRow
            key={g.id}
            g={g}
            name={nameOf(g)}
            roleLabel={roleLabel}
            canManage={canManage}
            onChanged={onChanged}
          />
        ))
      )}
    </div>
  );
}

function GuardRow({
  g,
  name,
  roleLabel,
  canManage,
  onChanged,
}: {
  g: Guardianship;
  name: string;
  roleLabel: (relationship: string) => string;
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const consentOn = (
    ['results', 'finance', 'attendance', 'general'] as const
  ).filter((k) => g.consent[k]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start gap-3">
        <PersonAvatar name={name} className="mt-0.5 size-9 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium capitalize text-foreground">
              {name}
            </span>
            <span className="text-xs text-muted-foreground">
              {roleLabel(g.relationship)}
            </span>
            {g.isPrimary ? (
              <StatusBadge tone="info" dot>
                Primary contact
              </StatusBadge>
            ) : null}
            {g.verified ? (
              <StatusBadge tone="success" dot>
                Verified
              </StatusBadge>
            ) : (
              <StatusBadge tone="warning" dot>
                Unverified
              </StatusBadge>
            )}
          </div>

          {g.legalGuardian ||
          g.custodyType ||
          g.canPickup ||
          g.canAuthorizeMedical ||
          g.isEmergencyContact ||
          g.isBillingContact ? (
            <div className="flex flex-wrap gap-1.5">
              {g.legalGuardian ? <Tag>Legal guardian</Tag> : null}
              {g.custodyType ? <Tag>Custody: {g.custodyType}</Tag> : null}
              {g.canPickup ? <Tag>Pickup</Tag> : null}
              {g.canAuthorizeMedical ? <Tag>Medical</Tag> : null}
              {g.isEmergencyContact ? <Tag>Emergency</Tag> : null}
              {g.isBillingContact ? <Tag>Billing</Tag> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Consent:</span>
            {consentOn.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">none</span>
            ) : (
              consentOn.map((k) => <ConsentPill key={k}>{k}</ConsentPill>)
            )}
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          <EditGuardianDialog
            g={g}
            name={name}
            roleLabel={roleLabel}
            onDone={onChanged}
          />
          {!g.verified ? <VerifyDialog id={g.id} onDone={onChanged} /> : null}
          <EndDialog id={g.id} onDone={onChanged} />
        </div>
      ) : null}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

/** A consent pill in the theme's primary blue (mirrors StatusBadge markup). */
function ConsentPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/40 bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
      {children}
    </span>
  );
}

/* ---- Shared authority/consent form ------------------------------------- */

function AuthorityConsentFields({
  form,
  set,
}: {
  form: GuardForm;
  set: <K extends keyof GuardForm>(k: K, v: GuardForm[K]) => void;
}) {
  const toggle = (k: keyof GuardForm, label: string): React.ReactNode => (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={form[k] as boolean}
        onCheckedChange={(v) => set(k, Boolean(v) as never)}
      />
      {label}
    </label>
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="g-rel">Relationship</Label>
        <Select
          value={form.relationship || 'parent'}
          onValueChange={(v) => set('relationship', v)}
        >
          <SelectTrigger id="g-rel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GUARDIAN_RELATIONSHIPS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="g-custody">Custody</Label>
        <Select
          value={form.custodyType || 'none-set'}
          onValueChange={(v) => set('custodyType', v === 'none-set' ? '' : v)}
        >
          <SelectTrigger id="g-custody">
            <SelectValue placeholder="Not specified" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none-set">Not specified</SelectItem>
            {CUSTODY.map((c) => (
              <SelectItem key={c} value={c}>
                {humanize(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Authority
        </legend>
        {toggle('isPrimary', 'Primary contact (only one per ward)')}
        {toggle('legalGuardian', 'Legal guardian')}
        {toggle('canPickup', 'May collect the child')}
        {toggle('canAuthorizeMedical', 'May authorise medical treatment')}
        {toggle('isEmergencyContact', 'Emergency contact')}
        {toggle('isBillingContact', 'Billing contact')}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Contact consent (emergency always allowed)
        </legend>
        {toggle('consentResults', 'Results')}
        {toggle('consentFinance', 'Finance / fees')}
        {toggle('consentAttendance', 'Attendance / behaviour')}
        {toggle('consentGeneral', 'General announcements')}
      </fieldset>
    </div>
  );
}

/* ---- Dialogs ------------------------------------------------------------ */

function EditGuardianDialog({
  g,
  name,
  roleLabel,
  onDone,
}: {
  g: Guardianship;
  name: string;
  roleLabel: (relationship: string) => string;
  onDone: () => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<GuardForm>(() => formFrom(g));
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof GuardForm>(k: K, v: GuardForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  React.useEffect(() => {
    if (open) setForm(formFrom(g));
  }, [open, g]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil aria-hidden /> Edit
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit guardianship</DialogTitle>
          <DialogDescription>
            Authority and per-category contact consent.
          </DialogDescription>
        </DialogHeader>
        <PersonIdentity name={name} sub={roleLabel(g.relationship)} />
        <AuthorityConsentFields form={form} set={set} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await fetch(`/api/guardianships/${g.id}`, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(toPayload(form)),
                });
                if (!res.ok) throw new Error(String(res.status));
                toast.success('Guardianship updated');
                setOpen(false);
                await onDone();
              } catch {
                toast.error('Update failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddGuardianDialog({
  wardPersonId,
  onDone,
}: {
  wardPersonId: string;
  onDone: () => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [guardian, setGuardian] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [form, setForm] = React.useState<GuardForm>(emptyForm);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof GuardForm>(k: K, v: GuardForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  React.useEffect(() => {
    if (open) {
      setGuardian(null);
      setForm(emptyForm());
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Add guardian
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a guardian</DialogTitle>
          <DialogDescription>
            Find the caregiver, then set their authority and contact consent.
          </DialogDescription>
        </DialogHeader>

        {guardian ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <PersonAvatar name={guardian.name} className="size-8 shrink-0" />
              <span className="truncate text-sm font-medium capitalize text-foreground">
                {guardian.name}
              </span>
            </div>
            <Button
              variant="link"
              size="sm"
              className="h-auto shrink-0 p-0 font-medium"
              onClick={() => setGuardian(null)}
            >
              Change
            </Button>
          </div>
        ) : (
          <PersonSearch
            excludeId={wardPersonId}
            onPick={(p) => setGuardian(p)}
          />
        )}

        {guardian ? <AuthorityConsentFields form={form} set={set} /> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={busy || !guardian}
            onClick={async () => {
              if (!guardian) return;
              setBusy(true);
              try {
                const res = await fetch('/api/guardianships', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    guardianPersonId: guardian.id,
                    wardPersonId,
                    ...toPayload(form),
                  }),
                });
                if (!res.ok) {
                  const d = (await res.json().catch(() => null)) as {
                    message?: string;
                  } | null;
                  throw new Error(d?.message ?? String(res.status));
                }
                toast.success('Guardian added');
                setOpen(false);
                await onDone();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Add failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Add guardian
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonSearch({
  excludeId,
  onPick,
}: {
  excludeId: string;
  onPick: (p: { id: string; name: string }) => void;
}) {
  const [term, setTerm] = React.useState('');
  const [results, setResults] = React.useState<{ id: string; name: string }[]>(
    [],
  );
  const [searching, setSearching] = React.useState(false);
  // Only the newest request may write state — a slow response for an earlier
  // term must never overwrite the results the user is now looking at.
  const seq = React.useRef(0);

  React.useEffect(() => {
    const q = term.trim();
    // Only search once the query carries real signal (≥2 letters/digits) — so
    // punctuation-only input like "??" waits rather than firing an empty search.
    if (!isSearchable(q)) {
      setResults([]);
      setSearching(false);
      return;
    }
    const mySeq = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/directory/people?type=all&match=name&q=${encodeURIComponent(q)}&limit=8`,
          { cache: 'no-store' },
        );
        const data = (await res.json()) as {
          data?: { id: string; name: string }[];
        };
        if (mySeq !== seq.current) return; // superseded by a newer search
        setResults((data.data ?? []).filter((r) => r.id !== excludeId));
      } catch {
        if (mySeq === seq.current) setResults([]);
      } finally {
        if (mySeq === seq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term, excludeId]);

  const q = term.trim();
  return (
    <div className="flex flex-col gap-2 py-2">
      <Label htmlFor="g-search">Search people</Label>
      <Input
        id="g-search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Name…"
        autoComplete="off"
      />
      {/* Fixed-height results area so the dialog does not resize as matches
          load, clear, or come back empty. No border/background — otherwise it
          reads as a second input the user might try to type into. */}
      <div className="h-52 overflow-y-auto">
        {!isSearchable(q) ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            Type at least 2 letters to search.
          </p>
        ) : searching ? (
          <p className="flex items-center gap-1.5 px-1 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Searching…
          </p>
        ) : results.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="flex w-full items-center gap-2.5 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-left text-sm hover:border-ring/60 hover:bg-accent/40"
                >
                  <PersonAvatar name={r.name} className="size-7 shrink-0" />
                  <span className="truncate capitalize">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 py-2 text-xs text-muted-foreground">No matches.</p>
        )}
      </div>
    </div>
  );
}

function VerifyDialog({
  id,
  onDone,
}: {
  id: string;
  onDone: () => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [method, setMethod] = React.useState('document');
  const [busy, setBusy] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck aria-hidden /> Verify
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify this guardianship</DialogTitle>
          <DialogDescription>
            Record how the caregiver relationship was confirmed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-2">
          <Label htmlFor="v-method">Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger id="v-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERIFY_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {humanize(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await fetch(`/api/guardianships/${id}/verify`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ method }),
                });
                if (!res.ok) throw new Error(String(res.status));
                toast.success('Guardianship verified');
                setOpen(false);
                await onDone();
              } catch {
                toast.error('Verification failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndDialog({
  id,
  onDone,
}: {
  id: string;
  onDone: () => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Ban aria-hidden /> End
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End this guardianship?</DialogTitle>
          <DialogDescription>
            The relationship is ended (kept in history), not deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-2">
          <Label htmlFor="end-reason">
            Reason <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="end-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Custody transferred"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await fetch(`/api/guardianships/${id}/end`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ reason: reason || undefined }),
                });
                if (!res.ok) throw new Error(String(res.status));
                toast.success('Guardianship ended');
                setOpen(false);
                await onDone();
              } catch {
                toast.error('Could not end relationship');
              } finally {
                setBusy(false);
              }
            }}
          >
            End relationship
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
