'use client';

/* ============================================================
   ExportMenu — a format dropdown for table/report exports.

   Presentational: it renders the CSV / XLSX / PDF choices and calls back with
   the picked format. The consumer owns the actual download (build the URL with
   the current filters, fetch, save) — so the same control drops into a page
   header or a DirectoryTable toolbar unchanged.
   ============================================================ */

import * as React from 'react';
import { Download, FileSpreadsheet, FileText, FileType2 } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const FORMATS: {
  value: ExportFormat;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: 'csv', label: 'CSV', icon: <FileText aria-hidden /> },
  {
    value: 'xlsx',
    label: 'Excel (XLSX)',
    icon: <FileSpreadsheet aria-hidden />,
  },
  { value: 'pdf', label: 'PDF', icon: <FileType2 aria-hidden /> },
];

export interface ExportMenuProps {
  /** Run the download for the chosen format. May be async. */
  onExport: (format: ExportFormat) => void | Promise<void>;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
}

export function ExportMenu({
  onExport,
  label = 'Export',
  disabled = false,
  size = 'sm',
}: ExportMenuProps) {
  const [busy, setBusy] = React.useState(false);

  const run = async (format: ExportFormat) => {
    setBusy(true);
    try {
      await onExport(format);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={disabled || busy}
          style={{ backgroundColor: 'transparent' }}
        >
          <Download aria-hidden />
          {busy ? 'Exporting…' : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {FORMATS.map((format) => (
          <DropdownMenuItem
            key={format.value}
            disabled={busy}
            onSelect={(event) => {
              event.preventDefault();
              void run(format.value);
            }}
          >
            {format.icon}
            {format.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
