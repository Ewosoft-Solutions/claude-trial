/**
 * TransformRule executor (F2 / ADR-09). A mapping may reference a transform to
 * normalize a raw cell before validation/commit. Deterministic + pure, so a
 * dry-run and the real commit see identical normalized values.
 */
export type TransformType =
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'date_parse'
  | 'number'
  | 'constant'
  | 'split'
  | 'lookup';

export interface TransformResult {
  value: string | null;
  error?: string;
}

export function applyTransform(
  type: TransformType | string,
  config: Record<string, unknown> | null | undefined,
  raw: string,
): TransformResult {
  const cfg = config ?? {};
  switch (type) {
    case 'trim':
      return { value: raw.trim() };
    case 'lowercase':
      return { value: raw.trim().toLowerCase() };
    case 'uppercase':
      return { value: raw.trim().toUpperCase() };
    case 'constant':
      return { value: String(cfg.value ?? '') };
    case 'number': {
      const cleaned = raw.replace(/[,\s]/g, '');
      if (cleaned === '') return { value: null };
      if (!/^[-+]?\d*\.?\d+$/.test(cleaned)) {
        return { value: null, error: `not a number: "${raw}"` };
      }
      return { value: cleaned };
    }
    case 'date_parse': {
      const parsed = parseDate(raw.trim(), String(cfg.format ?? 'DD/MM/YYYY'));
      if (!parsed) return { value: null, error: `invalid date: "${raw}"` };
      return { value: parsed };
    }
    case 'split': {
      const sep = String(cfg.separator ?? ' ');
      const index = Number(cfg.index ?? 0);
      const parts = raw.split(sep);
      return { value: (parts[index] ?? '').trim() };
    }
    case 'lookup': {
      const table = (cfg.table as Record<string, string>) ?? {};
      const key = raw.trim();
      if (key in table) return { value: table[key] };
      if (cfg.default !== undefined) return { value: String(cfg.default) };
      return { value: null, error: `no lookup match for "${raw}"` };
    }
    default:
      return { value: raw };
  }
}

/** Parse DD/MM/YYYY or YYYY-MM-DD (dirty legacy dates) into ISO YYYY-MM-DD. */
function parseDate(raw: string, format: string): string | null {
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const sep = raw.includes('/') ? '/' : raw.includes('-') ? '-' : null;
  if (!sep) return null;
  const parts = raw.split(sep);
  if (parts.length !== 3) return null;

  let day: string, month: string, year: string;
  if (format.startsWith('MM')) {
    [month, day, year] = parts;
  } else {
    [day, month, year] = parts;
  }
  const d = Number(day),
    m = Number(month),
    y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const yyyy = String(y).padStart(4, '0');
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
