'use client';

/* ============================================================
   /settings/profile — sign-in profile & default context

   Lists every profile the signed-in user holds (flattened across
   schools, same data as the header profile switcher) and lets them
   pin one as the default sign-in context. Without a default, login
   auto-selects the first profile in a deterministic-but-arbitrary
   order (see orderWithDefaultFirst in the backend) — this page is
   how a user overrides that.

   Setting a default does not change the *current* session; it only
   affects future logins. The active-now badge reflects the profile
   the current access token was issued for.
   ============================================================ */

import * as React from 'react';
import { Check, Star } from 'lucide-react';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';

import { useViewer } from '@/app/providers/viewer-provider';

interface ProfileRow {
  profileId: string;
  tenantId: string;
  schoolName: string;
  schoolInitials: string;
  schoolColor?: string;
  role: string;
}

export default function ProfileSettingsPage() {
  const { schools, activeProfileId, defaultProfileId, setDefaultProfile } = useViewer();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const rows: ProfileRow[] = React.useMemo(
    () =>
      schools.flatMap((school) =>
        (school.profiles ?? []).map((profile) => ({
          profileId: profile.profileId,
          tenantId: school.id,
          schoolName: school.name,
          schoolInitials: school.initials,
          schoolColor: school.color,
          role: profile.role,
        })),
      ),
    [schools],
  );

  const handleSetDefault = async (profileId: string) => {
    setPendingId(profileId);
    setError(null);
    try {
      await setDefaultProfile(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default profile');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Default sign-in profile</CardTitle>
          <CardDescription>
            Choose which profile you land in automatically when you log in. Useful if
            you hold more than one role — e.g. Teacher at one school and Parent at
            another, or two roles at the same school.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles found.</p>
          ) : (
            rows.map((row) => {
              const isDefault = row.profileId === defaultProfileId;
              const isActive = row.profileId === activeProfileId;
              const isPending = pendingId === row.profileId;

              return (
                <div
                  key={row.profileId}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3"
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-md text-xs font-extrabold text-white"
                    style={{ background: row.schoolColor ?? 'var(--primary)' }}
                    aria-hidden
                  >
                    {row.schoolInitials}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="break-words text-sm font-semibold text-foreground">
                      {row.schoolName}
                    </span>
                    <span className="text-xs text-muted-foreground">{row.role}</span>
                  </div>
                  <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
                    {isActive ? (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Check className="size-3" /> Active now
                      </Badge>
                    ) : null}
                    {isDefault ? (
                      <Badge className="gap-1 text-xs">
                        <Star className="size-3" /> Default
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleSetDefault(row.profileId)}
                      >
                        {isPending ? 'Setting…' : 'Set as default'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
