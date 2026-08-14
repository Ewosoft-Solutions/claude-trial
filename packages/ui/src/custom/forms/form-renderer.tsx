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
  visibleItems,
  type CascadeAnswer,
  type FormDefinition,
  type FormItem,
  type FormSection,
} from '@workspace/forms';

import { Dropzone, fileToBase64 } from './dropzone';
import { PhoneField } from './phone-field';

type Answers = Record<string, unknown>;

/** The tenant academic structure a `cascade` item selects from. */
export interface CascadeStructure {
  campuses: { id: string; name: string }[];
  stages: { id: string; name: string }[];
  yearLevels: { id: string; name: string; stageId: string }[];
  streams: { id: string; name: string }[];
}

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
  /** Academic structure for any `cascade` item (the "applying for" picker). */
  structure?: CascadeStructure;
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
  structure,
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

  const setAnswer = (key: string, v: unknown) => {
    setError(null);
    onChange({ ...value, [key]: v });
  };

  if (flat) {
    return (
      <div className="flex flex-col gap-6">
        {definition.sections
          .filter((s) => !s.hidden)
          .map((s) => (
            <div key={s.id} className="flex flex-col gap-5">
              {s.title && (
                <h3 className="text-base font-semibold">{s.title}</h3>
              )}
              {s.description && (
                <p className="text-sm text-muted-foreground">{s.description}</p>
              )}
              <SectionBody
                section={s}
                value={value}
                disabled={readOnly || submitting}
                structure={structure}
                setAnswer={setAnswer}
              />
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

      <SectionBody
        section={section}
        value={value}
        disabled={readOnly || submitting}
        structure={structure}
        setAnswer={setAnswer}
      />

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

// ------------------------------------------------------------- section body

/** A section's controls — a repeatable group (e.g. Guardians) or a flat list. */
function SectionBody({
  section,
  value,
  disabled,
  structure,
  setAnswer,
}: {
  section: FormSection;
  value: Answers;
  disabled?: boolean;
  structure?: CascadeStructure;
  setAnswer: (key: string, v: unknown) => void;
}) {
  if (section.repeatable && section.binding) {
    const key = section.binding;
    return (
      <RepeatableSection
        section={section}
        entries={Array.isArray(value[key]) ? (value[key] as Answers[]) : []}
        disabled={disabled}
        structure={structure}
        onChange={(entries) => setAnswer(key, entries)}
      />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {visibleItems(section).map((item) => (
        <ItemControl
          key={item.id}
          item={item}
          value={value[item.key]}
          disabled={disabled}
          structure={structure}
          onChange={(v) => setAnswer(item.key, v)}
        />
      ))}
    </div>
  );
}

/** A repeatable section: its items rendered once per entry, with add/remove. */
function RepeatableSection({
  section,
  entries,
  disabled,
  structure,
  onChange,
}: {
  section: FormSection;
  entries: Answers[];
  disabled?: boolean;
  structure?: CascadeStructure;
  onChange: (entries: Answers[]) => void;
}) {
  const noun = section.repeatable?.entryNoun ?? 'entry';
  const min = section.repeatable?.min ?? 0;
  const max = section.repeatable?.max;
  const items = visibleItems(section);
  // Show at least one blank entry when the section demands one.
  const list = entries.length === 0 && min > 0 ? [{}] : entries;

  const setEntry = (i: number, key: string, v: unknown) =>
    onChange(list.map((e, idx) => (idx === i ? { ...e, [key]: v } : e)));

  return (
    <div className="flex flex-col gap-3">
      {list.map((entry, i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-lg border border-border p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium capitalize text-muted-foreground">
              {noun} {i + 1}
              {i === 0 ? ' · primary' : ''}
            </span>
            {list.length > Math.max(min, 1) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => onChange(list.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            )}
          </div>
          {items.map((item) => (
            <ItemControl
              key={item.id}
              item={item}
              value={entry[item.key]}
              disabled={disabled}
              structure={structure}
              onChange={(v) => setEntry(i, item.key, v)}
            />
          ))}
        </div>
      ))}
      {(max == null || list.length < max) && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...list, {}])}
          className="w-fit"
        >
          Add {noun}
        </Button>
      )}
    </div>
  );
}

// --------------------------------------------------------------- item control

function ItemControl({
  item,
  value,
  disabled,
  structure,
  onChange,
}: {
  item: FormItem;
  value: unknown;
  disabled?: boolean;
  structure?: CascadeStructure;
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
      const defaultDialCode = item.phone?.defaultDialCode || '+234';
      const dialCode = v.dialCode || defaultDialCode;
      return wrap(
        <PhoneField
          id={id}
          dialCode={dialCode}
          number={v.number ?? ''}
          disabled={disabled}
          defaultDialCode={defaultDialCode}
          onDialCodeChange={(d) => onChange({ ...v, dialCode: d })}
          onNumberChange={(n) => onChange({ dialCode, number: n })}
        />,
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
    case 'cascade':
      return wrap(
        <CascadeControl
          value={(value as CascadeAnswer) ?? {}}
          structure={structure}
          disabled={disabled}
          onChange={onChange}
        />,
      );
    default:
      return null;
  }
}

/** The "applying for" academic-structure picker (stage → class → stream/campus). */
function CascadeControl({
  value,
  structure,
  disabled,
  onChange,
}: {
  value: CascadeAnswer;
  structure?: CascadeStructure;
  disabled?: boolean;
  onChange: (v: CascadeAnswer) => void;
}) {
  const stages = structure?.stages ?? [];
  const campuses = structure?.campuses ?? [];
  const streams = structure?.streams ?? [];
  const yearLevels = (structure?.yearLevels ?? []).filter(
    (y) => !value.stageId || y.stageId === value.stageId,
  );
  const sel = (patch: Partial<CascadeAnswer>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {campuses.length > 1 && (
        <PickerField label="Campus">
          <Select
            value={value.campusId ?? ''}
            disabled={disabled}
            onValueChange={(v) => sel({ campusId: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose campus…" />
            </SelectTrigger>
            <SelectContent>
              {campuses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PickerField>
      )}
      <PickerField label="Level">
        <Select
          value={value.stageId ?? ''}
          disabled={disabled}
          onValueChange={(v) => sel({ stageId: v, yearLevelId: undefined })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose level…" />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PickerField>
      <PickerField label="Class">
        <Select
          value={value.yearLevelId ?? ''}
          disabled={disabled}
          onValueChange={(v) => sel({ yearLevelId: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose class…" />
          </SelectTrigger>
          <SelectContent>
            {yearLevels.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PickerField>
      {streams.length > 0 && (
        <PickerField label="Department (optional)">
          <Select
            value={value.streamId ?? ''}
            disabled={disabled}
            onValueChange={(v) => sel({ streamId: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {streams.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PickerField>
      )}
    </div>
  );
}

function PickerField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
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
