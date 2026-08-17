/**
 * WB4-2 · ResultImportService — spreadsheet score capture as the SAME flow as
 * keyed entry (parity job 54: "direct entry + Excel import in one flow").
 *
 *   template → fill in Excel/Sheets → upload → DRY-RUN report → commit
 *
 * Three properties make this safe rather than magic:
 *   1. It is a **dry run by default**. The report names every row it could not
 *      match and every cell it could not read; a commit is refused while any
 *      error stands, so a typo can never land as a silent 0.
 *   2. It writes through **ResultEntryService.upsertEntries** — the one
 *      authoritative entry writer — so the cycle-open gate, the in-scope
 *      (student · offering) check, the per-component max and the audit trail are
 *      identical to keyed entry. This service only translates a sheet into that
 *      command.
 *   3. **Absent ≠ zero survives the round trip**: ABS/EXM tokens import as
 *      absent/exempt, and a blank cell writes nothing at all.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@workspace/database';
import { Workbook } from 'exceljs';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { parseCsv } from '../../imports/csv';
import { ResultCycleService } from './result-cycle.service';
import { ResultEntryService } from './result-entry.service';
import type { ResultActor } from './results.types';
import {
  findColumn,
  labelsMatch,
  mapComponentColumns,
  parseScoreCell,
  STUDENT_NAME_HEADERS,
  STUDENT_NUMBER_HEADERS,
  SUBJECT_HEADERS,
} from './result-import';
import type { ImportFormat, ImportResultScoresDto } from '../dto';

export interface ImportIssue {
  /** 1-based row number as the user sees it in the spreadsheet (header = 1). */
  row: number;
  column?: string;
  message: string;
}

export interface ImportReport {
  committed: boolean;
  dataRows: number;
  matchedRows: number;
  cellsToWrite: number;
  scores: number;
  absent: number;
  exempt: number;
  blank: number;
  /** Component columns the sheet actually carried, in sheet order. */
  componentColumns: string[];
  errors: ImportIssue[];
  unmatchedStudents: string[];
  unmatchedSubjects: string[];
  /** Only set on a commit. */
  upserted?: number;
}

interface Sheet {
  headers: string[];
  rows: string[][];
}

const MAX_ISSUES = 50;

@Injectable()
export class ResultImportService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly cycles: ResultCycleService,
    private readonly entries: ResultEntryService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /**
   * A ready-to-fill CSV template for one section: one row per student (× per
   * offering when no single subject is chosen) and one column per component,
   * pre-filled with the student's identity so the sheet round-trips.
   */
  async buildTemplate(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    sectionId: string,
    subjectOfferingId?: string,
  ): Promise<{ filename: string; mime: string; csv: string }> {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    const [components, scope] = await Promise.all([
      this.client.resultComponent.findMany({
        where: { tenantId, cycleId },
        orderBy: { order: 'asc' },
        select: { key: true, label: true, maxScore: true },
      }),
      this.cycles.resolveScope(tenantId, cycle),
    ]);
    if (components.length === 0) {
      throw new BadRequestException('Configure components before importing.');
    }
    const section = scope.sections.find((s) => s.id === sectionId);
    if (!section) {
      throw new BadRequestException('Section is not part of this cycle.');
    }
    const students = scope.studentsBySectionId.get(sectionId) ?? [];
    const offerings = (scope.offeringsBySectionId.get(sectionId) ?? []).filter(
      (o) => !subjectOfferingId || o.id === subjectOfferingId,
    );
    if (subjectOfferingId && offerings.length === 0) {
      throw new BadRequestException('Subject is not offered to this section.');
    }

    const singleSubject = Boolean(subjectOfferingId);
    const headers = [
      'Student number',
      'Student name',
      ...(singleSubject ? [] : ['Subject']),
      ...components.map((c) => `${c.label} (max ${Number(c.maxScore)})`),
    ];
    const lines = [headers.map(csvCell).join(',')];
    for (const student of students) {
      for (const offering of offerings) {
        lines.push(
          [
            student.studentNumber,
            student.name,
            ...(singleSubject ? [] : [offering.subjectLabel]),
            ...components.map(() => ''),
          ]
            .map(csvCell)
            .join(','),
        );
      }
    }
    // A trailing hint row would corrupt the parse, so the guidance rides in the
    // filename + the UI copy instead.
    const slug = section.displayLabel
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase();
    return {
      filename: `result-template-${slug}.csv`,
      mime: 'text/csv',
      csv: `${lines.join('\n')}\n`,
    };
  }

  /**
   * Validate an uploaded sheet against the cycle and (when `commit`) write it
   * through the keyed-entry path. Always returns the full report.
   */
  async importScores(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    dto: ImportResultScoresDto,
  ): Promise<ImportReport> {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    if (cycle.status !== 'entry_open') {
      throw new BadRequestException('This cycle is not open for entry.');
    }

    const [components, scope] = await Promise.all([
      this.client.resultComponent.findMany({
        where: { tenantId, cycleId },
        orderBy: { order: 'asc' },
        select: { key: true, label: true, maxScore: true },
      }),
      this.cycles.resolveScope(tenantId, cycle),
    ]);
    if (components.length === 0) {
      throw new BadRequestException('Configure components before importing.');
    }
    const section = scope.sections.find((s) => s.id === dto.sectionId);
    if (!section) {
      throw new BadRequestException('Section is not part of this cycle.');
    }
    const students = scope.studentsBySectionId.get(dto.sectionId) ?? [];
    const offerings = scope.offeringsBySectionId.get(dto.sectionId) ?? [];
    const chosenOffering = dto.subjectOfferingId
      ? offerings.find((o) => o.id === dto.subjectOfferingId)
      : undefined;
    if (dto.subjectOfferingId && !chosenOffering) {
      throw new BadRequestException('Subject is not offered to this section.');
    }

    const sheet = await this.readSheet(dto);
    if (sheet.headers.length === 0) {
      throw new BadRequestException('The sheet has no header row.');
    }

    const componentSpecs = components.map((c) => ({
      key: c.key,
      label: c.label,
      maxScore: Number(c.maxScore),
    }));
    const componentColumns = mapComponentColumns(sheet.headers, componentSpecs);
    if (componentColumns.size === 0) {
      throw new BadRequestException(
        `No component column recognised. Expected one of: ${componentSpecs
          .map((c) => c.label)
          .join(', ')}.`,
      );
    }
    const numberColumn = findColumn(sheet.headers, STUDENT_NUMBER_HEADERS);
    const nameColumn = findColumn(sheet.headers, STUDENT_NAME_HEADERS);
    if (numberColumn < 0 && nameColumn < 0) {
      throw new BadRequestException(
        'The sheet needs a "Student number" (or "Student name") column.',
      );
    }
    const subjectColumn = findColumn(sheet.headers, SUBJECT_HEADERS);
    if (!chosenOffering && subjectColumn < 0) {
      throw new BadRequestException(
        'A multi-subject sheet needs a "Subject" column — or pick one subject before importing.',
      );
    }

    const report: ImportReport = {
      committed: false,
      dataRows: sheet.rows.length,
      matchedRows: 0,
      cellsToWrite: 0,
      scores: 0,
      absent: 0,
      exempt: 0,
      blank: 0,
      componentColumns: [...componentColumns.values()].map((c) => c.label),
      errors: [],
      unmatchedStudents: [],
      unmatchedSubjects: [],
    };
    const unmatchedStudents = new Set<string>();
    const unmatchedSubjects = new Set<string>();
    const pending: {
      studentId: string;
      subjectOfferingId: string;
      componentKey: string;
      score: number | null;
      isAbsent: boolean;
      isExempt: boolean;
    }[] = [];
    const seen = new Set<string>();

    sheet.rows.forEach((cells, index) => {
      const rowNumber = index + 2; // header is row 1
      const numberCell = numberColumn >= 0 ? (cells[numberColumn] ?? '') : '';
      const nameCell = nameColumn >= 0 ? (cells[nameColumn] ?? '') : '';
      if (numberCell.trim() === '' && nameCell.trim() === '') return; // spacer row

      const student =
        students.find(
          (s) =>
            numberCell.trim() !== '' &&
            labelsMatch(s.studentNumber, numberCell),
        ) ??
        students.find(
          (s) => nameCell.trim() !== '' && labelsMatch(s.name, nameCell),
        );
      if (!student) {
        unmatchedStudents.add((numberCell || nameCell).trim());
        this.addIssue(report, {
          row: rowNumber,
          column: sheet.headers[numberColumn >= 0 ? numberColumn : nameColumn],
          message: `No student in ${section.displayLabel} matches "${(numberCell || nameCell).trim()}"`,
        });
        return;
      }

      let offering = chosenOffering;
      if (!offering) {
        const subjectCell = cells[subjectColumn] ?? '';
        offering = offerings.find((o) =>
          labelsMatch(o.subjectLabel, subjectCell),
        );
        if (!offering) {
          unmatchedSubjects.add(subjectCell.trim());
          this.addIssue(report, {
            row: rowNumber,
            column: sheet.headers[subjectColumn],
            message: `"${subjectCell.trim()}" is not a subject offered to ${section.displayLabel}`,
          });
          return;
        }
      }
      report.matchedRows += 1;

      for (const [columnIndex, component] of componentColumns) {
        const header = sheet.headers[columnIndex] ?? component.label;
        const parsed = parseScoreCell(
          cells[columnIndex] ?? '',
          component.maxScore,
        );
        if (parsed.kind === 'blank') {
          report.blank += 1;
          continue;
        }
        if (parsed.kind === 'error') {
          this.addIssue(report, {
            row: rowNumber,
            column: header,
            message: parsed.message ?? 'Could not read this cell',
          });
          continue;
        }
        // A sheet listing the same (student · subject · component) twice is a
        // copy-paste mistake, not an update — refuse rather than pick a winner.
        const cellKey = `${student.id}::${offering.id}::${component.key}`;
        if (seen.has(cellKey)) {
          this.addIssue(report, {
            row: rowNumber,
            column: header,
            message: `Duplicate row: ${student.name} / ${offering.subjectLabel} / ${component.label} appears earlier in the sheet`,
          });
          continue;
        }
        seen.add(cellKey);

        if (parsed.kind === 'score') report.scores += 1;
        if (parsed.kind === 'absent') report.absent += 1;
        if (parsed.kind === 'exempt') report.exempt += 1;
        pending.push({
          studentId: student.id,
          subjectOfferingId: offering.id,
          componentKey: component.key,
          score: parsed.score,
          isAbsent: parsed.kind === 'absent',
          isExempt: parsed.kind === 'exempt',
        });
      }
    });

    report.cellsToWrite = pending.length;
    report.unmatchedStudents = [...unmatchedStudents];
    report.unmatchedSubjects = [...unmatchedSubjects];

    if (!dto.commit) return report;
    if (report.errors.length > 0) {
      throw new BadRequestException(
        `The sheet has ${report.errors.length} problem(s) — fix them and re-check before importing.`,
      );
    }
    if (pending.length === 0) {
      throw new BadRequestException('The sheet has no scores to import.');
    }

    // One owner for entry writes: the same command keyed entry uses (cycle-open
    // gate, in-scope pair check, per-component max, audit).
    const { upserted } = await this.entries.upsertEntries(
      tenantId,
      actor,
      cycleId,
      { entries: pending },
    );
    return { ...report, committed: true, upserted };
  }

  private addIssue(report: ImportReport, issue: ImportIssue) {
    if (report.errors.length < MAX_ISSUES) report.errors.push(issue);
    else if (report.errors.length === MAX_ISSUES) {
      report.errors.push({
        row: issue.row,
        message: `…more problems after row ${issue.row} (only the first ${MAX_ISSUES} are listed)`,
      });
    }
  }

  /** Decode + parse the upload into a header row + string cells. */
  private async readSheet(dto: ImportResultScoresDto): Promise<Sheet> {
    const buffer = Buffer.from(dto.contentBase64, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('The uploaded file is empty.');
    }
    const format = resolveFormat(dto.format, dto.filename);
    return format === 'xlsx'
      ? await readXlsx(buffer)
      : readCsvSheet(buffer.toString('utf8'));
  }
}

/** Explicit format wins; otherwise infer from the extension, defaulting to csv. */
export function resolveFormat(
  format: ImportFormat | undefined,
  filename: string | undefined,
): ImportFormat {
  if (format) return format;
  return /\.xlsx?$/i.test(filename ?? '') ? 'xlsx' : 'csv';
}

function readCsvSheet(text: string): Sheet {
  const { headers, rows } = parseCsv(text);
  return { headers, rows };
}

/** First worksheet → header row + string cells (formulas read as their value). */
async function readXlsx(buffer: Buffer): Promise<Sheet> {
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException(
      'That file could not be read as a spreadsheet. Save it as .xlsx or .csv and try again.',
    );
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new BadRequestException('The workbook has no sheets.');
  }
  const records: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // `row.eachCell` skips empty cells, which would shift columns — walk the
    // width instead so a blank cell stays a blank column.
    const width = Math.max(row.cellCount, worksheet.columnCount);
    for (let i = 1; i <= width; i += 1) {
      cells.push(cellText(row.getCell(i).value));
    }
    records.push(cells);
  });
  const [headers, ...rows] = records;
  if (!headers) return { headers: [], rows: [] };
  return { headers: headers.map((h) => h.trim()), rows };
}

/** Stringify an exceljs cell value (rich text / formula / date / number). */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const record = value as {
      result?: unknown;
      text?: unknown;
      richText?: { text?: string }[];
      error?: unknown;
    };
    if (record.error !== undefined) return String(record.error);
    if (record.result !== undefined) return cellText(record.result);
    if (Array.isArray(record.richText)) {
      return record.richText.map((part) => part.text ?? '').join('');
    }
    if (record.text !== undefined) return cellText(record.text);
  }
  return String(value);
}

/** Quote a CSV cell (RFC-4180) — the template is generated, so it must be valid. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
