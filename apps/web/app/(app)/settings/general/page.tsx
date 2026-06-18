/* ============================================================
   /settings/general — school profile & locale

   The General settings panel: school profile + academic/locale
   fields in Cards, with a save bar. Fields are uncontrolled mock
   inputs (defaultValue); persistence lands with the API.
   ============================================================ */

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

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export default function GeneralSettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">School profile</CardTitle>
          <CardDescription>
            How your school appears across the platform and on documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="school-name" label="School name">
            <Input id="school-name" defaultValue="St. Jude Academy" />
          </Field>
          <Field id="short-name" label="Short name">
            <Input id="short-name" defaultValue="St. Jude" />
          </Field>
          <Field id="contact-email" label="Contact email">
            <Input id="contact-email" type="email" defaultValue="admin@stjude.edu.ng" />
          </Field>
          <Field id="phone" label="Phone">
            <Input id="phone" type="tel" defaultValue="+234 801 234 5678" />
          </Field>
          <div className="sm:col-span-2">
            <Field id="address" label="Address">
              <Input id="address" defaultValue="12 Awolowo Road, Ikoyi, Lagos" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Academic & locale</CardTitle>
          <CardDescription>
            Defaults for terms, scheduling and formatting.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="academic-year" label="Academic year">
            <Select defaultValue="2024-2025">
              <SelectTrigger id="academic-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024-2025">2024 / 2025</SelectItem>
                <SelectItem value="2025-2026">2025 / 2026</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="current-term" label="Current term">
            <Select defaultValue="spring">
              <SelectTrigger id="current-term">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="autumn">First term</SelectItem>
                <SelectItem value="spring">Second term</SelectItem>
                <SelectItem value="summer">Third term</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="timezone" label="Timezone">
            <Select defaultValue="lagos">
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lagos">West Africa Time (UTC+1)</SelectItem>
                <SelectItem value="accra">Greenwich Mean Time (UTC)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="currency" label="Currency">
            <Select defaultValue="ngn">
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ngn">Nigerian Naira (₦)</SelectItem>
                <SelectItem value="usd">US Dollar ($)</SelectItem>
                <SelectItem value="ghs">Ghanaian Cedi (₵)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2.5">
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button size="sm">Save changes</Button>
      </div>
    </div>
  );
}
