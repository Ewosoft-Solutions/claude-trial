/**
 * TableExportService — render a tabular dataset to CSV / XLSX / PDF.
 *
 * Reusable across any table export (audit log first). Callers pass a column
 * spec + already-projected rows; the service owns file generation + the
 * content-type/filename. Values are stringified defensively (Date → ISO,
 * object → JSON) so a caller never has to pre-format for a specific format.
 */
import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import PDFDocument from 'pdfkit';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export const EXPORT_FORMATS: readonly ExportFormat[] = ['csv', 'xlsx', 'pdf'];

export function isExportFormat(value: unknown): value is ExportFormat {
  return (
    typeof value === 'string' &&
    (EXPORT_FORMATS as readonly string[]).includes(value)
  );
}

export interface ExportColumn {
  key: string;
  header: string;
  /** Relative weight for column width (xlsx chars / pdf proportion). */
  width?: number;
}

export interface ExportRequest {
  /** Document/sheet title. */
  title: string;
  /** Base filename WITHOUT extension. */
  filename: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
}

export interface ExportResult {
  buffer: Buffer;
  mime: string;
  /** Filename WITH extension. */
  filename: string;
}

@Injectable()
export class TableExportService {
  async export(
    req: ExportRequest,
    format: ExportFormat,
  ): Promise<ExportResult> {
    switch (format) {
      case 'xlsx':
        return this.xlsx(req);
      case 'pdf':
        return this.pdf(req);
      case 'csv':
      default:
        return this.csv(req);
    }
  }

  private cell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private csv(req: ExportRequest): ExportResult {
    const esc = (s: string) =>
      /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const lines = [
      req.columns.map((c) => esc(c.header)).join(','),
      ...req.rows.map((row) =>
        req.columns.map((c) => esc(this.cell(row[c.key]))).join(','),
      ),
    ];
    // Prepend a BOM (\uFEFF) so Excel opens UTF-8 correctly.
    return {
      buffer: Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8'),
      mime: 'text/csv; charset=utf-8',
      filename: `${req.filename}.csv`,
    };
  }

  private async xlsx(req: ExportRequest): Promise<ExportResult> {
    const wb = new Workbook();
    const ws = wb.addWorksheet(req.title.slice(0, 31) || 'Export');
    ws.columns = req.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 24,
    }));
    ws.getRow(1).font = { bold: true };
    for (const row of req.rows) {
      const record: Record<string, string> = {};
      for (const c of req.columns) record[c.key] = this.cell(row[c.key]);
      ws.addRow(record);
    }
    const arrayBuffer = await wb.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${req.filename}.xlsx`,
    };
  }

  private pdf(req: ExportRequest): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 36,
        size: 'A4',
        layout: 'landscape',
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          mime: 'application/pdf',
          filename: `${req.filename}.pdf`,
        }),
      );
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const usable = doc.page.width - left - doc.page.margins.right;
      const totalWeight = req.columns.reduce((s, c) => s + (c.width ?? 1), 0);
      const widths = req.columns.map(
        (c) => (usable * (c.width ?? 1)) / totalWeight,
      );
      const xs: number[] = [];
      let x = left;
      for (const w of widths) {
        xs.push(x);
        x += w;
      }
      const rowH = 14;
      const bottom = doc.page.height - doc.page.margins.bottom;

      doc.fontSize(15).text(req.title, left, doc.page.margins.top);
      let y = doc.y + 6;

      const drawRow = (cells: string[], bold: boolean) => {
        if (y + rowH > bottom) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
        cells.forEach((text, i) =>
          doc.text(text, xs[i]! + 2, y, {
            width: widths[i]! - 4,
            height: rowH,
            ellipsis: true,
            lineBreak: false,
          }),
        );
        y += rowH;
      };

      drawRow(
        req.columns.map((c) => c.header),
        true,
      );
      doc
        .moveTo(left, y - 2)
        .lineTo(left + usable, y - 2)
        .stroke();
      for (const row of req.rows) {
        drawRow(
          req.columns.map((c) => this.cell(row[c.key])),
          false,
        );
      }
      doc.end();
    });
  }
}
