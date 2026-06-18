/* ============================================================
   /settings/audit — audit log

   A chronological activity trail (actor · action · category · time).
   Mock events; the real feed lands with the monitoring/audit service.
   ============================================================ */

import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';

type Category = 'security' | 'finance' | 'records' | 'settings';

interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  category: Category;
  when: string;
}

const EVENTS: AuditEvent[] = [
  { id: 'e1', actor: 'Margaret Bello', action: 'updated the primary brand colour', category: 'settings', when: '2m ago' },
  { id: 'e2', actor: 'Patricia Adamu', action: 'recorded a ₦245k payment for Z. Yusuf', category: 'finance', when: '1h ago' },
  { id: 'e3', actor: 'Daniel Eze', action: 'accepted admission application AP-2051', category: 'records', when: '3h ago' },
  { id: 'e4', actor: 'System', action: 'suspended user H. Coker after 5 failed sign-ins', category: 'security', when: '5h ago' },
  { id: 'e5', actor: 'Samuel Okonkwo', action: 'changed the Bursar role clearance to level 5', category: 'security', when: 'yesterday' },
  { id: 'e6', actor: 'Patricia Adamu', action: 'exported the term billing report', category: 'finance', when: 'yesterday' },
];

const CATEGORY_META: Record<Category, { label: string; tone: StateTone }> = {
  security: { label: 'Security', tone: 'destructive' },
  finance: { label: 'Finance', tone: 'warning' },
  records: { label: 'Records', tone: 'info' },
  settings: { label: 'Settings', tone: 'neutral' },
};

export default function AuditSettingsPage() {
  return (
    <Card className="shadow-card">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">Audit log</CardTitle>
          <CardDescription>Recent activity across the school</CardDescription>
        </div>
        <Button variant="outline" size="sm">
          Export
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col">
        {EVENTS.map((e, i) => {
          const cat = CATEGORY_META[e.category];
          return (
            <div
              key={e.id}
              className={
                'flex flex-wrap items-center gap-x-3 gap-y-1 py-3' +
                (i > 0 ? ' border-t border-border' : '')
              }
            >
              <StatusBadge tone={cat.tone} dot>
                {cat.label}
              </StatusBadge>
              <span className="min-w-0 flex-1 text-sm text-foreground">
                <span className="font-semibold">{e.actor}</span> {e.action}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {e.when}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
