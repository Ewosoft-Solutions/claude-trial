'use client';

/**
 * Reusable drag-and-drop file picker for the Form engine's `file` items (and
 * anywhere else). Presentational: reports the chosen File (after an accept/size
 * check) via `onSelect`, shows the current file as a chip with a clear action.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { File as FileIcon, Upload, X } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function Dropzone({
  onSelect,
  currentName,
  onClear,
  accept,
  maxBytes = DEFAULT_MAX_BYTES,
  disabled,
  className,
}: {
  onSelect: (file: File) => void;
  currentName?: string | null;
  onClear?: () => void;
  accept?: string;
  maxBytes?: number;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  function take(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > maxBytes) {
      toast.error(
        `File is too large (max ${Math.round(maxBytes / 1048576)} MB).`,
      );
      return;
    }
    onSelect(file);
  }

  if (currentName) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-2.5 text-sm',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <FileIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="truncate">{currentName}</span>
        </span>
        {onClear && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remove file"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center text-sm transition-colors hover:border-muted-foreground/40',
        dragOver && 'border-primary bg-primary/5',
        disabled && 'cursor-not-allowed opacity-60 hover:border-border',
        className,
      )}
    >
      <Upload className="size-5 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">Click to upload</span> or
        drag and drop
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Read a File as base64 (no data: prefix) for a JSON upload body. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
