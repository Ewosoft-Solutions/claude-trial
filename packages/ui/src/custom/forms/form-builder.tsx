'use client';

/**
 * FormBuilder — authors a FormDefinition: sections (pages) → items, with a type
 * picker, per-type config (options / scale / grid / file / validation), required
 * + help, per-answer branching (go-to-section), and section flow. Controlled:
 * the parent holds `value` + `onChange`. Consumes @workspace/forms types.
 */
import * as React from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

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
  CHOICE_ITEM_TYPES,
  DISPLAY_ITEM_TYPES,
  FORM_ITEM_TYPES,
  GRID_ITEM_TYPES,
  SUBMIT_TARGET,
  type FormDefinition,
  type FormItem,
  type FormItemType,
  type FormSection,
} from '@workspace/forms';

const TYPE_LABELS: Record<FormItemType, string> = {
  short_text: 'Short text',
  paragraph: 'Paragraph',
  number: 'Number',
  date: 'Date',
  time: 'Time',
  phone: 'Phone',
  address: 'Address',
  radio: 'Multiple choice',
  dropdown: 'Dropdown',
  checkboxes: 'Checkboxes',
  linear_scale: 'Linear scale',
  file: 'File upload',
  grid_radio: 'Multiple-choice grid',
  grid_checkbox: 'Checkbox grid',
  heading: 'Section heading',
  description: 'Description text',
};

const TEXT_TYPES: FormItemType[] = ['short_text', 'paragraph'];

let counter = 0;
const uid = (p: string) =>
  `${p}_${Date.now().toString(36)}${(counter++).toString(36)}`;
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

function emptyItem(): FormItem {
  return { id: uid('i'), key: '', type: 'short_text', label: '' };
}
function emptySection(): FormSection {
  return { id: uid('s'), title: '', items: [emptyItem()] };
}

export interface FormBuilderProps {
  value: FormDefinition;
  onChange: (def: FormDefinition) => void;
}

export function FormBuilder({ value, onChange }: FormBuilderProps) {
  const def = value;
  const setSections = (sections: FormSection[]) =>
    onChange({ ...def, sections });
  const updateSection = (si: number, patch: Partial<FormSection>) =>
    setSections(
      def.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)),
    );
  const updateItem = (si: number, ii: number, patch: Partial<FormItem>) =>
    updateSection(si, {
      items: def.sections[si]!.items.map((it, i) =>
        i === ii ? { ...it, ...patch } : it,
      ),
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fb-title">Form title</Label>
          <Input
            id="fb-title"
            value={def.title}
            onChange={(e) => onChange({ ...def, title: e.target.value })}
            placeholder="e.g. 2026/27 Application"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fb-desc">Description</Label>
          <Textarea
            id="fb-desc"
            rows={2}
            value={def.description ?? ''}
            onChange={(e) => onChange({ ...def, description: e.target.value })}
            placeholder="Shown to the applicant at the top (optional)"
          />
        </div>
      </div>

      {def.sections.map((section, si) => (
        <div
          key={section.id}
          className="flex flex-col gap-4 rounded-xl border border-border p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Section {si + 1}
            </span>
            <div className="flex items-center gap-1">
              <MoveButtons
                index={si}
                length={def.sections.length}
                onMove={(from, to) => setSections(move(def.sections, from, to))}
              />
              {def.sections.length > 1 && (
                <IconBtn
                  label="Remove section"
                  onClick={() =>
                    setSections(def.sections.filter((_, i) => i !== si))
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconBtn>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Section title</Label>
              <Input
                value={section.title ?? ''}
                onChange={(e) => updateSection(si, { title: e.target.value })}
                placeholder="e.g. About the applicant"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Section description</Label>
              <Input
                value={section.description ?? ''}
                onChange={(e) =>
                  updateSection(si, { description: e.target.value })
                }
                placeholder="optional"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {section.items.map((item, ii) => (
              <ItemEditor
                key={item.id}
                item={item}
                sections={def.sections}
                onChange={(patch) => updateItem(si, ii, patch)}
                onRemove={() =>
                  updateSection(si, {
                    items: section.items.filter((_, i) => i !== ii),
                  })
                }
                onMove={(from, to) =>
                  updateSection(si, { items: move(section.items, from, to) })
                }
                index={ii}
                length={section.items.length}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-dashed"
            onClick={() =>
              updateSection(si, { items: [...section.items, emptyItem()] })
            }
          >
            <Plus className="mr-1 size-4" aria-hidden /> Add question
          </Button>

          {def.sections.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">After this section</Label>
              <Select
                value={section.next ?? '__next__'}
                onValueChange={(v) =>
                  updateSection(si, {
                    next: v === '__next__' ? undefined : v,
                  })
                }
              >
                <SelectTrigger className="h-8 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__next__">Continue to next</SelectItem>
                  {def.sections
                    .filter((s) => s.id !== section.id)
                    .map((s, i) => (
                      <SelectItem key={s.id} value={s.id}>
                        Go to: {s.title || `Section ${i + 1}`}
                      </SelectItem>
                    ))}
                  <SelectItem value={SUBMIT_TARGET}>Submit the form</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => setSections([...def.sections, emptySection()])}
      >
        <Plus className="mr-1 size-4" aria-hidden /> Add section
      </Button>
    </div>
  );
}

// --------------------------------------------------------------- item editor

function ItemEditor({
  item,
  sections,
  onChange,
  onRemove,
  onMove,
  index,
  length,
}: {
  item: FormItem;
  sections: FormSection[];
  onChange: (patch: Partial<FormItem>) => void;
  onRemove: () => void;
  onMove: (from: number, to: number) => void;
  index: number;
  length: number;
}) {
  const isDisplay = DISPLAY_ITEM_TYPES.includes(item.type);
  const isChoice = CHOICE_ITEM_TYPES.includes(item.type);
  const isGrid = GRID_ITEM_TYPES.includes(item.type);
  const isText = TEXT_TYPES.includes(item.type);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start gap-2">
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            value={item.label}
            placeholder={isDisplay ? 'Text to show' : 'Question'}
            className="h-9"
            onChange={(e) => {
              const label = e.target.value;
              onChange(
                !item.key.trim() && !isDisplay
                  ? { label, key: slugify(label) }
                  : { label },
              );
            }}
          />
          <Select
            value={item.type}
            onValueChange={(v) => onChange({ type: v as FormItemType })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORM_ITEM_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col">
          <MoveButtons index={index} length={length} onMove={onMove} />
          <IconBtn label="Remove question" onClick={onRemove}>
            <Trash2 className="size-4" aria-hidden />
          </IconBtn>
        </div>
      </div>

      {!isDisplay && (
        <Input
          value={item.help ?? ''}
          placeholder="Help text (optional)"
          className="h-8 text-xs"
          onChange={(e) => onChange({ help: e.target.value })}
        />
      )}

      {isChoice && (
        <Input
          value={(item.options ?? []).join(', ')}
          placeholder="Options, comma-separated (e.g. Science, Arts)"
          className="h-9"
          onChange={(e) =>
            onChange({
              options: e.target.value.split(',').map((o) => o.trim()),
            })
          }
        />
      )}

      {item.type === 'linear_scale' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">From</span>
          <Input
            type="number"
            className="h-8 w-16"
            value={item.scale?.min ?? 1}
            onChange={(e) =>
              onChange({
                scale: {
                  min: Number(e.target.value),
                  max: item.scale?.max ?? 5,
                  minLabel: item.scale?.minLabel,
                  maxLabel: item.scale?.maxLabel,
                },
              })
            }
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="number"
            className="h-8 w-16"
            value={item.scale?.max ?? 5}
            onChange={(e) =>
              onChange({
                scale: {
                  min: item.scale?.min ?? 1,
                  max: Number(e.target.value),
                  minLabel: item.scale?.minLabel,
                  maxLabel: item.scale?.maxLabel,
                },
              })
            }
          />
        </div>
      )}

      {isGrid && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            value={(item.grid?.rows ?? []).join(', ')}
            placeholder="Rows, comma-separated"
            className="h-9"
            onChange={(e) =>
              onChange({
                grid: {
                  rows: e.target.value.split(',').map((r) => r.trim()),
                  columns: item.grid?.columns ?? [],
                },
              })
            }
          />
          <Input
            value={(item.grid?.columns ?? []).join(', ')}
            placeholder="Columns, comma-separated"
            className="h-9"
            onChange={(e) =>
              onChange({
                grid: {
                  rows: item.grid?.rows ?? [],
                  columns: e.target.value.split(',').map((c) => c.trim()),
                },
              })
            }
          />
        </div>
      )}

      {isText && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={item.validation?.kind ?? '__none__'}
            onValueChange={(v) =>
              onChange({
                validation: {
                  ...item.validation,
                  kind: v === '__none__' ? undefined : (v as 'email' | 'url'),
                },
              })
            }
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Any text</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="url">Link (URL)</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Max chars"
            className="h-8 w-28"
            value={item.validation?.maxLength ?? ''}
            onChange={(e) =>
              onChange({
                validation: {
                  ...item.validation,
                  maxLength: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                },
              })
            }
          />
        </div>
      )}

      {item.type === 'number' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox
              checked={item.validation?.kind === 'integer'}
              onCheckedChange={(c) =>
                onChange({
                  validation: {
                    ...item.validation,
                    kind: c === true ? 'integer' : undefined,
                  },
                })
              }
            />
            Whole numbers
          </label>
          <Input
            type="number"
            placeholder="Min"
            className="h-8 w-20"
            value={item.validation?.min ?? ''}
            onChange={(e) =>
              onChange({
                validation: {
                  ...item.validation,
                  min: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
          />
          <Input
            type="number"
            placeholder="Max"
            className="h-8 w-20"
            value={item.validation?.max ?? ''}
            onChange={(e) =>
              onChange({
                validation: {
                  ...item.validation,
                  max: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
          />
        </div>
      )}

      {isChoice && (
        <BranchingEditor item={item} sections={sections} onChange={onChange} />
      )}

      {!isDisplay && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={item.required === true}
            onCheckedChange={(c) => onChange({ required: c === true })}
          />
          Required
        </label>
      )}
    </div>
  );
}

function BranchingEditor({
  item,
  sections,
  onChange,
}: {
  item: FormItem;
  sections: FormSection[];
  onChange: (patch: Partial<FormItem>) => void;
}) {
  const options = (item.options ?? []).filter(Boolean);
  if (options.length === 0) return null;
  const branchFor = (answer: string) =>
    item.branching?.find((b) => b.answer === answer)?.goTo ?? '__default__';
  const setBranch = (answer: string, goTo: string) => {
    const rest = (item.branching ?? []).filter((b) => b.answer !== answer);
    onChange({
      branching: goTo === '__default__' ? rest : [...rest, { answer, goTo }],
    });
  };

  return (
    <details className="rounded-md border border-dashed border-border p-2 text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        Branch by answer (go to a section)
      </summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {options.map((opt) => (
          <div key={opt} className="flex items-center gap-2">
            <span className="w-28 truncate text-xs">{opt}</span>
            <Select
              value={branchFor(opt)}
              onValueChange={(v) => setBranch(opt, v)}
            >
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Continue</SelectItem>
                {sections.map((s, i) => (
                  <SelectItem key={s.id} value={s.id}>
                    Go to: {s.title || `Section ${i + 1}`}
                  </SelectItem>
                ))}
                <SelectItem value={SUBMIT_TARGET}>Submit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </details>
  );
}

// -------------------------------------------------------------------- helpers

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

function MoveButtons({
  index,
  length,
  onMove,
}: {
  index: number;
  length: number;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <div className="flex flex-col">
      <IconBtn
        label="Move up"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ChevronUp className="size-4" aria-hidden />
      </IconBtn>
      <IconBtn
        label="Move down"
        disabled={index === length - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ChevronDown className="size-4" aria-hidden />
      </IconBtn>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}
