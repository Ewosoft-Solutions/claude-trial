/**
 * Minimal RFC-4180-ish CSV parser (F2). Handles quoted fields, escaped quotes
 * (""), embedded commas/newlines, and CRLF. No dependency — a bulk-import
 * platform should not pull a parser it can't audit. Returns the header row and
 * the data rows as string cells.
 */
export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = () => {
    record.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      endField();
      i++;
      continue;
    }
    if (ch === '\r') {
      // swallow CR; a following LF ends the record
      if (text[i + 1] === '\n') {
        endRecord();
        i += 2;
      } else {
        endRecord();
        i++;
      }
      continue;
    }
    if (ch === '\n') {
      endRecord();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // flush trailing field/record if the file did not end with a newline
  if (field.length > 0 || record.length > 0) {
    endRecord();
  }

  // Drop a trailing empty record (file ending in newline).
  const nonEmpty = records.filter(
    (r) => !(r.length === 1 && r[0].trim() === ''),
  );
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const [headers, ...rows] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows };
}

/** Zip a data row with headers into an object keyed by column name. */
export function rowToObject(
  headers: string[],
  cells: string[],
): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((h, idx) => {
    obj[h] = cells[idx] ?? '';
  });
  return obj;
}
