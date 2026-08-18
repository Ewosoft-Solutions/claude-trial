'use client';

/**
 * WB4-2 · Spreadsheet import — the other half of ONE entry flow (parity job 54).
 * Download a pre-filled template for a section, fill it in Excel or Sheets,
 * upload it, read the dry-run report, then commit. Nothing is written until the
 * report is clean, so a typo can never land as a silent zero; ABS / EXM keep an
 * absent or exempt learner out of the maths entirely.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';

import { apiGet, apiPost } from './results-api';

interface ImportIssue {
  row: number;
  column?: string;
  message: string;
}
interface ImportReport {
  committed: boolean;
  dataRows: number;
  matchedRows: number;
  cellsToWrite: number;
  scores: number;
  absent: number;
  exempt: number;
  blank: number;
  componentColumns: string[];
  errors: ImportIssue[];
  unmatchedStudents: string[];
  unmatchedSubjects: string[];
  upserted?: number;
}

export function ImportPanel({
  cycleId,
  editable,
  canEnter,
  sections,
  offerings,
  sectionId,
  offeringId,
  onImported,
}: {
  cycleId: string;
  editable: boolean;
  canEnter: boolean;
  sections: { id: string; displayLabel: string }[];
  offerings: { id: string; subjectLabel: string }[];
  sectionId: string;
  offeringId: string;
  onImported: () => void | Promise<void>;
}) {
  // The panel follows the grid's section, but the subject is independent: a
  // multi-subject sheet (with a Subject column) is the common upload.
  const [scope, setScope] = React.useState<'all' | 'one'>('all');
  const [file, setFile] = React.useState<File | null>(null);
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const section = sections.find((s) => s.id === sectionId);
  const offering = offerings.find((o) => o.id === offeringId);
  const subjectOfferingId = scope === 'one' ? offeringId : undefined;

  // A new file (or a scope change) invalidates the previous report — never let a
  // stale "0 problems" authorise a different upload.
  React.useEffect(() => setReport(null), [file, scope, sectionId, offeringId]);

  async function downloadTemplate() {
    setBusy(true);
    try {
      const query = new URLSearchParams({ sectionId });
      if (subjectOfferingId) query.set('subjectOfferingId', subjectOfferingId);
      const data = await apiGet<{ filename: string; csv: string }>(
        `/cycles/${cycleId}/import-template?${query.toString()}`,
      );
      const url = URL.createObjectURL(
        new Blob([data.csv], { type: 'text/csv;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not build the template',
      );
    } finally {
      setBusy(false);
    }
  }

  async function send(commit: boolean) {
    if (!file) return;
    setBusy(true);
    try {
      const contentBase64 = await toBase64(file);
      const result = await apiPost<ImportReport>(`/cycles/${cycleId}/import`, {
        sectionId,
        subjectOfferingId,
        filename: file.name,
        contentBase64,
        commit,
      });
      setReport(result);
      if (commit) {
        toast.success(`Imported ${result.upserted ?? 0} score cell(s)`);
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        await onImported();
      } else if (result.errors.length > 0) {
        toast.error(
          `${result.errors.length} problem(s) — see the report below`,
        );
      } else {
        toast.success(
          `Ready: ${result.cellsToWrite} cell(s) from ${result.matchedRows} row(s)`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  const canImport = editable && canEnter;
  const clean = report !== null && report.errors.length === 0;

  if (!sectionId) {
    return (
      <p className="text-sm text-muted-foreground">
        Choose a section above to download a template or import a sheet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-sm border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <FileSpreadsheet className="size-4" aria-hidden /> Import from a
          spreadsheet
        </h3>
        <p className="text-sm text-muted-foreground">
          Same rules as keyed entry — write <code>ABS</code> for an absent
          learner and <code>EXM</code> for an exemption; leave a cell blank to
          change nothing. Nothing is saved until the check comes back clean.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="imp-scope">Sheet covers</Label>
          <Select
            value={scope}
            onValueChange={(v) => setScope(v as 'all' | 'one')}
          >
            <SelectTrigger id="imp-scope" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Every subject (sheet has a Subject column)
              </SelectItem>
              <SelectItem value="one" disabled={!offeringId}>
                {offering
                  ? `Only ${offering.subjectLabel}`
                  : 'Only the selected subject'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={downloadTemplate} disabled={busy}>
          <Download className="size-4" aria-hidden /> Template for{' '}
          {section?.displayLabel ?? 'section'}
        </Button>
      </div>

      {canImport ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="imp-file">Filled sheet (.csv or .xlsx)</Label>
            <Input
              id="imp-file"
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="w-72"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => send(false)}
            disabled={busy || !file}
          >
            Check sheet
          </Button>
          <Button onClick={() => send(true)} disabled={busy || !file || !clean}>
            <Upload className="size-4" aria-hidden /> Import{' '}
            {report ? `${report.cellsToWrite} cell(s)` : ''}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {editable
            ? 'You need the “Enter results” permission to import scores.'
            : 'Entry is closed for this cycle, so importing is disabled.'}
        </p>
      )}

      {report && (
        <div className="flex flex-col gap-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge tone={clean ? 'success' : 'destructive'}>
              {report.committed
                ? 'Imported'
                : clean
                  ? 'Ready to import'
                  : `${report.errors.length} problem(s)`}
            </StatusBadge>
            <span className="text-muted-foreground">
              {report.matchedRows} of {report.dataRows} row(s) matched ·{' '}
              {report.scores} score(s) · {report.absent} absent ·{' '}
              {report.exempt} exempt · {report.blank} blank cell(s) left
              untouched
            </span>
          </div>
          {report.componentColumns.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Columns read: {report.componentColumns.join(', ')}
            </p>
          )}
          {report.errors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Row</th>
                    <th className="px-2 py-1.5 font-medium">Column</th>
                    <th className="px-2 py-1.5 font-medium">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {report.errors.map((issue, i) => (
                    <tr
                      key={`${issue.row}-${i}`}
                      className="border-b last:border-0"
                    >
                      <td className="px-2 py-1.5">{issue.row}</td>
                      <td className="px-2 py-1.5">{issue.column ?? '—'}</td>
                      <td className="px-2 py-1.5">{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Read the picked file as base64 (the API takes the sheet in a JSON body). */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      // data:<mime>;base64,<payload>
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}
