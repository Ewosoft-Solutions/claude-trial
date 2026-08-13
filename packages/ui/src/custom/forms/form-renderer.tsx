'use client';

/**
 * FormRenderer — renders a published FormDefinition for a respondent: paginated
 * by section (Back / Next + progress), following per-answer BRANCHING, with
 * client-side validation via the shared @workspace/forms validator. Collects
 * answers keyed by item key; `file` items produce an upload marker
 * ({ filename, mime, contentBase64 }) which the server materialises through F4.
 *
 * Controlled: the parent holds `value` (answers) + `onChange`, and `onSubmit`
 * receives the final answers.
 */
import * as React from 'react';
import { toast } from 'sonner';

import { cn } from '@workspace/ui/lib/utils';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  SUBMIT_TARGET,
  FormValidationError,
  validateAnswers,
  type FormDefinition,
  type FormItem,
  type FormSection,
} from '@workspace/forms';

import { Dropzone, fileToBase64 } from './dropzone';
import { COUNTRIES, flagEmoji } from './countries';

type Answers = Record<string, unknown>;

export interface FormRendererProps {
  definition: FormDefinition;
  value: Answers;
  onChange: (answers: Answers) => void;
  onSubmit?: (answers: Answers) => void | Promise<void>;
  submitting?: boolean;
  readOnly?: boolean;
  submitLabel?: string;
  /** Render every section stacked (no pagination / nav) — for embedding inside a
   *  larger form whose own submit sends the answers (e.g. the public apply page). */
  flat?: boolean;
}

/** The section a choice's branch (or the section default, else order) leads to. */
function nextSectionId(
  def: FormDefinition,
  section: FormSection,
  answers: Answers,
): string | undefined {
  for (const item of section.items) {
    if (item.branching?.length) {
      const match = item.branching.find((b) => b.answer === answers[item.key]);
      if (match) return match.goTo;
    }
  }
  if (section.next) return section.next;
  const order = def.sections.map((s) => s.id);
  return order[order.indexOf(section.id) + 1];
}

export function FormRenderer({
  definition,
  value,
  onChange,
  onSubmit,
  submitting,
  readOnly,
  submitLabel = 'Submit',
  flat,
}: FormRendererProps) {
  const first = definition.sections[0]?.id;
  const [path, setPath] = React.useState<string[]>(() =>
    first ? [first] : [],
  );
  const [error, setError] = React.useState<string | null>(null);

  const currentId = path[path.length - 1];
  const section = definition.sections.find((s) => s.id === currentId);
  const sectionIndex = definition.sections.findIndex((s) => s.id === currentId);

  if (!section) return null;

  if (flat) {
    return (
      <div className="flex flex-col gap-6">
        {definition.sections.map((s) => (
          <div key={s.id} className="flex flex-col gap-5">
            {s.title && <h3 className="text-base font-semibold">{s.title}</h3>}
            {s.description && (
              <p className="text-sm text-muted-foreground">{s.description}</p>
            )}
            {s.items.map((item) => (
              <ItemControl
                key={item.id}
                item={item}
                value={value[item.key]}
                disabled={readOnly || submitting}
                onChange={(v) => setAnswer(item.key, v)}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const next = nextSectionId(definition, section, value);
  const isLast = !next || next === SUBMIT_TARGET;
  const progress =
    definition.sections.length > 0
      ? ((sectionIndex + 1) / definition.sections.length) * 100
      : 0;

  const setAnswer = (key: string, v: unknown) => {
    setError(null);
    onChange({ ...value, [key]: v });
  };

  /** Validate just the current section (a single-section slice of the form). */
  function validateSection(): boolean {
    try {
      validateAnswers({ title: definition.title, sections: [section!] }, value);
      return true;
    } catch (e) {
      const msg =
        e instanceof FormValidationError
          ? e.message
          : 'Please check your answers.';
      setError(msg);
      toast.error(msg);
      return false;
    }
  }

  async function submit() {
    try {
      validateAnswers(definition, value);
    } catch (e) {
      const msg =
        e instanceof FormValidationError
          ? e.message
          : 'Please check your answers.';
      setError(msg);
      toast.error(msg);
      return;
    }
    await onSubmit?.(value);
  }

  function goNext() {
    if (readOnly) {
      if (!isLast) setPath([...path, next!]);
      return;
    }
    if (!validateSection()) return;
    if (isLast) {
      void submit();
    } else {
      setPath([...path, next!]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {definition.settings?.progressBar && definition.sections.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            Section {sectionIndex + 1} of {definition.sections.length}
          </span>
        </div>
      )}

      {(section.title || section.description) && (
        <div className="flex flex-col gap-1">
          {section.title && (
            <h3 className="text-base font-semibold">{section.title}</h3>
          )}
          {section.description && (
            <p className="text-sm text-muted-foreground">
              {section.description}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {section.items.map((item) => (
          <ItemControl
            key={item.id}
            item={item}
            value={value[item.key]}
            disabled={readOnly || submitting}
            onChange={(v) => setAnswer(item.key, v)}
          />
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {(definition.sections.length > 1 || !readOnly) && (
        <div className="flex items-center justify-between gap-2">
          {path.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => setPath(path.slice(0, -1))}
            >
              Back
            </Button>
          ) : (
            <span />
          )}
          {!(readOnly && isLast) && (
            <Button type="button" disabled={submitting} onClick={goNext}>
              {readOnly
                ? 'Next'
                : isLast
                  ? submitting
                    ? 'Submitting…'
                    : submitLabel
                  : 'Next'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------- item control

function ItemControl({
  item,
  value,
  disabled,
  onChange,
}: {
  item: FormItem;
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}) {
  const id = `fi-${item.id}`;

  if (item.type === 'heading') {
    return <h4 className="text-sm font-semibold">{item.label}</h4>;
  }
  if (item.type === 'description') {
    return <p className="text-sm text-muted-foreground">{item.label}</p>;
  }

  const label = (
    <Label htmlFor={id} className="text-sm">
      {item.label}
      {item.required && <span className="ml-1 text-destructive">*</span>}
    </Label>
  );
  const help = item.help ? (
    <span className="text-xs text-muted-foreground">{item.help}</span>
  ) : null;

  const wrap = (control: React.ReactNode, extra?: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      {label}
      {control}
      {extra}
      {help}
    </div>
  );

  switch (item.type) {
    case 'paragraph': {
      const text = (value as string) ?? '';
      const max = item.validation?.maxLength;
      return wrap(
        <Textarea
          id={id}
          value={text}
          maxLength={max}
          placeholder={item.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
        max ? <CharCount value={text} max={max} /> : null,
      );
    }
    case 'short_text': {
      const text = (value as string) ?? '';
      const max = item.validation?.maxLength;
      return wrap(
        <Input
          id={id}
          value={text}
          maxLength={max}
          placeholder={item.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
        max ? <CharCount value={text} max={max} /> : null,
      );
    }
    case 'number':
      return wrap(
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={value === undefined || value === null ? '' : String(value)}
          placeholder={item.placeholder}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value === '' ? '' : Number(e.target.value))
          }
        />,
      );
    case 'date':
      return wrap(
        <Input
          id={id}
          type="date"
          value={(value as string) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );
    case 'time':
      return wrap(
        <Input
          id={id}
          type="time"
          value={(value as string) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );
    case 'address':
      return wrap(
        <Input
          id={id}
          value={
            typeof value === 'string'
              ? value
              : ((value as { formatted?: string })?.formatted ?? '')
          }
          placeholder={item.placeholder ?? 'Street, city, state'}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );
    case 'phone': {
      const v = (value as { dialCode?: string; number?: string }) ?? {};
      const dialCode = v.dialCode || item.phone?.defaultDialCode || '+234';
      return wrap(
        <div className="flex gap-2">
          <Select
            value={dialCode}
            disabled={disabled}
            onValueChange={(d) => onChange({ ...v, dialCode: d })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.iso2} value={c.dial}>
                  {flagEmoji(c.iso2)} {c.dial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id={id}
            className="flex-1"
            inputMode="tel"
            value={v.number ?? ''}
            placeholder="801 234 5678"
            disabled={disabled}
            onChange={(e) => onChange({ dialCode, number: e.target.value })}
          />
        </div>,
      );
    }
    case 'dropdown':
      return wrap(
        <Select
          value={(value as string) ?? ''}
          disabled={disabled}
          onValueChange={onChange}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {(item.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      );
    case 'radio': {
      const selected = (value as string) ?? '';
      return wrap(
        <div className="flex flex-col gap-1.5">
          {(item.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={id}
                className="size-4 accent-primary"
                checked={selected === opt}
                disabled={disabled}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>,
      );
    }
    case 'checkboxes': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (opt: string) =>
        onChange(
          selected.includes(opt)
            ? selected.filter((o) => o !== opt)
            : [...selected, opt],
        );
      return wrap(
        <div className="flex flex-col gap-1.5">
          {(item.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(opt)}
                disabled={disabled}
                onCheckedChange={() => toggle(opt)}
              />
              {opt}
            </label>
          ))}
        </div>,
      );
    }
    case 'linear_scale': {
      const min = item.scale?.min ?? 1;
      const max = item.scale?.max ?? 5;
      const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      const selected = value as number | undefined;
      return wrap(
        <div className="flex items-center gap-2">
          {item.scale?.minLabel && (
            <span className="text-xs text-muted-foreground">
              {item.scale.minLabel}
            </span>
          )}
          <div className="flex flex-wrap gap-1.5">
            {nums.map((n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onChange(n)}
                className={cn(
                  'size-9 rounded-md border text-sm transition-colors',
                  selected === n
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-muted',
                )}
              >
                {n}
              </button>
            ))}
          </div>
          {item.scale?.maxLabel && (
            <span className="text-xs text-muted-foreground">
              {item.scale.maxLabel}
            </span>
          )}
        </div>,
      );
    }
    case 'file': {
      const v = value as { filename?: string } | undefined;
      const accept = item.file?.accept?.join(',');
      const maxBytes = item.file?.maxSizeMb
        ? item.file.maxSizeMb * 1024 * 1024
        : undefined;
      return wrap(
        <Dropzone
          currentName={v?.filename ?? null}
          accept={accept}
          maxBytes={maxBytes}
          disabled={disabled}
          onSelect={(file) => {
            void fileToBase64(file).then((contentBase64) =>
              onChange({
                filename: file.name,
                mime: file.type || 'application/octet-stream',
                contentBase64,
              }),
            );
          }}
          onClear={() => onChange(undefined)}
        />,
      );
    }
    case 'grid_radio':
    case 'grid_checkbox': {
      const rows = item.grid?.rows ?? [];
      const cols = item.grid?.columns ?? [];
      const isCheckbox = item.type === 'grid_checkbox';
      const grid = (value as Record<string, string | string[]>) ?? {};
      const setCell = (row: string, col: string) => {
        if (isCheckbox) {
          const cur = Array.isArray(grid[row]) ? (grid[row] as string[]) : [];
          const nextVal = cur.includes(col)
            ? cur.filter((c) => c !== col)
            : [...cur, col];
          onChange({ ...grid, [row]: nextVal });
        } else {
          onChange({ ...grid, [row]: col });
        }
      };
      return wrap(
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th />
                {cols.map((c) => (
                  <th key={c} className="px-2 pb-1 text-xs font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r}>
                  <td className="pr-3 text-muted-foreground">{r}</td>
                  {cols.map((c) => {
                    const checked = isCheckbox
                      ? Array.isArray(grid[r]) &&
                        (grid[r] as string[]).includes(c)
                      : grid[r] === c;
                    return (
                      <td key={c} className="px-2 text-center">
                        <input
                          type={isCheckbox ? 'checkbox' : 'radio'}
                          name={`${id}-${r}`}
                          className="size-4 accent-primary"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => setCell(r, c)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }
    default:
      return null;
  }
}

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={cn(
        'self-end text-xs',
        value.length > max ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {value.length}/{max}
    </span>
  );
}
