'use client';

/**
 * Recusal on an admission application — the admissions half of the
 * no-one-approves-their-own-request rule (docs/self-approval-audit.md).
 *
 * Everywhere else in that audit the server can SEE the conflict: it compares
 * the requester's id against the approver's. Admissions can't. The applicant is
 * an external prospect with no user account, so the conflict that matters here
 * — deciding on your own child's application — is invisible to the system and
 * can only be declared. This panel is how it gets declared.
 *
 * It has three states, and only ever shows one of them:
 *
 *   · declared   — you stepped away. The decision card is gone; this says why,
 *                  because unlike the other flows the disappearance is
 *                  self-inflicted and would otherwise read as a bug.
 *   · prompted   — your own email or phone is on this file. A nudge, never a
 *                  block: the server still lets you decide until you declare.
 *   · quiet      — nothing to say, so nothing is rendered.
 *
 * The declaration is deliberately one-way. There is no "undeclare": a recusal
 * you can revoke the moment it becomes inconvenient is not a recusal.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Info, UserMinus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';

import { errorMessage, type ApplicationDetail } from '../admissions-types';

const RELATIONSHIPS: { value: string; label: string }[] = [
  { value: 'parent', label: 'Parent' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'relative', label: 'Relative' },
  { value: 'family_friend', label: 'Family friend' },
  { value: 'other', label: 'Other' },
];

const RELATIONSHIP_LABEL = new Map(
  RELATIONSHIPS.map((r) => [r.value, r.label]),
);

export function DeclareInterestPanel({
  detail,
  hasDecisionRights,
}: {
  detail: ApplicationDetail;
  /**
   * Whether the viewer holds any decision permission at all. Someone who could
   * never decide this application has nothing to recuse themselves from, so
   * they are not prompted — the nudge would be noise.
   */
  hasDecisionRights: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [relationship, setRelationship] = React.useState('parent');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const declared = detail.myDeclaredInterest;
  const others = detail.interestDeclarations.filter((d) => !d.isMine);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admissions/applications/${detail.id}/declare-interest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationship,
            note: note.trim() || undefined,
          }),
        },
      );
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not record the declaration'));
        return;
      }
      toast.success('Interest declared — someone else will decide this one');
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (declared) {
    return (
      <Card className="border-warning/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserMinus className="size-4 text-warning" aria-hidden />
            You stepped away from this one
          </CardTitle>
          <CardDescription>
            You declared an interest
            {RELATIONSHIP_LABEL.has(declared.relationship)
              ? ` (${RELATIONSHIP_LABEL.get(declared.relationship)?.toLowerCase()})`
              : ''}
            , so the decision belongs to a colleague. You can still read the
            file and its history.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!hasDecisionRights) return null;

  // Someone else's recusal is worth showing — it explains a gap in who acted —
  // but only as a count. Why they stepped away was written to justify a
  // recusal, not to be read by the room.
  const othersLine =
    others.length > 0 ? (
      <p className="text-xs text-muted-foreground">
        {others.length === 1
          ? 'One colleague has declared an interest in this application.'
          : `${others.length} colleagues have declared an interest in this application.`}
      </p>
    ) : null;

  if (!detail.looksConnected) {
    return othersLine ? <div className="px-1">{othersLine}</div> : null;
  }

  return (
    <Card className="border-warning/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="size-4 text-warning" aria-hidden />
          Is this applicant connected to you?
        </CardTitle>
        <CardDescription>
          Your own contact details appear on this application. If the applicant
          is family, declare it and a colleague will take the decision. This is
          a prompt, not a block — and it can&apos;t be undone once declared.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {othersLine}
        {open ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="declare-relationship">Relationship</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger id="declare-relationship" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <Label htmlFor="declare-note">Note (optional)</Label>
              <Input
                id="declare-note"
                value={note}
                maxLength={240}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. My daughter"
              />
            </div>
            <Button onClick={submit} disabled={busy}>
              Declare and step away
            </Button>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Declare an interest
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
