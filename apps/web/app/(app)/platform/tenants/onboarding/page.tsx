'use client';

/* ============================================================
   /platform/tenants/onboarding — register a new school

   Platform Architect surface (G3). Registers a tenant via the BFF
   (/api/platform/schools -> POST /tenant/register). A school starts
   PENDING; the architect activates it from the schools list.
   ============================================================ */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../../_shared/use-step-up-action';

const SCHOOL_TYPES = [
  { value: 'nursery', label: 'Nursery' },
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'university', label: 'University' },
  { value: 'college', label: 'College' },
  { value: 'training_institute', label: 'Training institute' },
  { value: 'organization', label: 'Educational organization' },
];

interface CreatedSchool {
  id: string;
  name: string;
  slug: string;
  status: string;
  schoolType: string | null;
}

export default function OnboardSchoolPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [schoolType, setSchoolType] = useState('secondary');
  const [emailDomain, setEmailDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedSchool | null>(null);
  const { requestStepUp, stepUpPrompt } = useStepUpAction();

  async function registerSchool(stepUpChallengeId: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/platform/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepUpChallengeId,
          name: name.trim(),
          slug: slug.trim() || undefined,
          schoolType,
          emailDomain: emailDomain.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || 'Failed to register school');
      }
      setCreated(body as CreatedSchool);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.TENANT_PROVISION,
        title: 'Confirm school registration',
        description:
          'Creating a tenant changes platform access and requires a fresh identity confirmation.',
      },
      registerSchool,
    );
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl py-6">
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5" />
              <CardTitle className="text-base">School registered</CardTitle>
            </div>
            <CardDescription>
              <strong>{created.name}</strong> was created as{' '}
              <code>{created.slug}</code> and is currently{' '}
              <strong>{created.status}</strong>. Activate it from the schools
              list, then invite its owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={() => router.push('/platform/tenants/all')}>
              Go to schools
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreated(null);
                setName('');
                setSlug('');
                setEmailDomain('');
                setSchoolType('secondary');
              }}
            >
              Register another
            </Button>
          </CardContent>
        </Card>
        {stepUpPrompt}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Onboard a school</CardTitle>
          </div>
          <CardDescription>
            Register a new school on the platform. It starts pending until you
            activate it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">School name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Greenfield Secondary School"
                required
                minLength={2}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated from name"
                pattern="[a-z0-9-]+"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers and hyphens. Leave blank to generate.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schoolType">School type</Label>
              <Select value={schoolType} onValueChange={setSchoolType}>
                <SelectTrigger id="schoolType">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emailDomain">Email domain (optional)</Label>
              <Input
                id="emailDomain"
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
                placeholder="greenfield.edu.ng"
              />
              <p className="text-xs text-muted-foreground">
                If set, invited users must have an email on this domain.
              </p>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex gap-3 pt-1">
              <Button
                type="submit"
                disabled={submitting || name.trim().length < 2}
              >
                {submitting ? 'Registering…' : 'Register school'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/platform/tenants/all')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {stepUpPrompt}
    </div>
  );
}
