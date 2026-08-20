import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

/**
 * The invoice as a document — the thing a family actually receives.
 *
 * Deliberately not built on `TableExportService`: that renders a data table
 * (headers, rows, landscape) which is right for exporting an audit log and
 * wrong for a bill. An invoice opens by saying who owes what to whom, itemises
 * it, and ends with one figure. The layout below mirrors the invoice route on
 * screen for the same reason the compose surface does — the bursar should
 * recognise what they are about to send.
 *
 * Money arrives in kobo and is formatted here rather than by the caller, so
 * every figure on the page is rounded and grouped the same way.
 */

/** What the page needs. Assembled by the caller so this stays a renderer. */
export interface InvoiceDocument {
  schoolName: string;
  invoiceNumber: string;
  status: string;
  issuedDate: Date | null;
  dueDate: Date | null;
  termLabel: string | null;
  billedTo: {
    name: string | null;
    studentNumber: string | null;
    householdName: string | null;
    payerName: string | null;
  };
  lines: Array<{
    name: string;
    description: string | null;
    amount: number;
    quantity: number;
  }>;
  totals: {
    gross: number;
    discounts: number;
    net: number;
    paid: number;
    balance: number;
    overpaid: number;
  };
  notes: string | null;
  /** Stamped across the page when this is not yet a real bill. */
  draft: boolean;
}

const naira = (kobo: number) =>
  `NGN ${(kobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const shortDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

@Injectable()
export class InvoiceDocumentService {
  render(doc: InvoiceDocument): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const pdf = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      pdf.on('data', (c: Buffer) => chunks.push(c));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      const left = pdf.page.margins.left;
      const right = pdf.page.width - pdf.page.margins.right;
      const usable = right - left;

      // ---- Letterhead ---------------------------------------------------
      pdf.font('Helvetica-Bold').fontSize(16).text(doc.schoolName, left, 48);
      pdf
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#666')
        .text(
          doc.draft ? 'DRAFT INVOICE — NOT YET ISSUED' : 'INVOICE',
          left,
          pdf.y + 2,
        );
      pdf
        .fontSize(9)
        .fillColor('#000')
        .text(doc.invoiceNumber, left, 48, { width: usable, align: 'right' })
        .text(`Issued  ${shortDate(doc.issuedDate)}`, {
          width: usable,
          align: 'right',
        })
        .text(`Due  ${shortDate(doc.dueDate)}`, {
          width: usable,
          align: 'right',
        });

      let y = Math.max(pdf.y, 110) + 12;
      pdf.moveTo(left, y).lineTo(right, y).strokeColor('#ddd').stroke();
      y += 14;

      // ---- Billed to ------------------------------------------------------
      pdf.font('Helvetica-Bold').fontSize(8).fillColor('#666');
      pdf.text('BILLED TO', left, y);
      pdf.font('Helvetica').fontSize(11).fillColor('#000');
      pdf.text(doc.billedTo.name ?? 'Unnamed', left, pdf.y + 2);

      const facts = [
        doc.billedTo.studentNumber
          ? `Student no. ${doc.billedTo.studentNumber}`
          : null,
        doc.billedTo.householdName
          ? `Household: ${doc.billedTo.householdName}`
          : null,
        doc.billedTo.payerName ? `Payer: ${doc.billedTo.payerName}` : null,
        doc.termLabel,
      ].filter((f): f is string => Boolean(f));
      if (facts.length > 0) {
        pdf.fontSize(9).fillColor('#444').text(facts.join('   ·   '), left);
      }

      y = pdf.y + 18;

      // ---- Lines ----------------------------------------------------------
      // Fixed columns so a long item name cannot push the money off its edge.
      const cols = [
        { key: 'item', w: usable - 260, align: 'left' as const },
        { key: 'unit', w: 90, align: 'right' as const },
        { key: 'qty', w: 50, align: 'right' as const },
        { key: 'amount', w: 120, align: 'right' as const },
      ];
      const xs: number[] = [];
      let x = left;
      for (const c of cols) {
        xs.push(x);
        x += c.w;
      }

      const row = (
        cells: string[],
        opts: { bold?: boolean; size?: number } = {},
      ) => {
        if (y + 18 > pdf.page.height - pdf.page.margins.bottom - 90) {
          pdf.addPage();
          y = pdf.page.margins.top;
        }
        pdf
          .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(opts.size ?? 9)
          .fillColor('#000');
        cells.forEach((text, i) =>
          pdf.text(text, xs[i]!, y, {
            width: cols[i]!.w - 8,
            align: cols[i]!.align,
            lineBreak: false,
            ellipsis: true,
          }),
        );
        y += 16;
      };

      pdf.fillColor('#666');
      row(['ITEM', 'UNIT', 'QTY', 'AMOUNT'], { bold: true, size: 8 });
      pdf.moveTo(left, y - 3).lineTo(right, y - 3).strokeColor('#ddd').stroke();

      for (const line of doc.lines) {
        row([
          line.name,
          naira(line.amount),
          String(line.quantity),
          naira(line.amount * line.quantity),
        ]);
        if (line.description) {
          // `row` has already advanced y past the item name, so the note sits
          // just under it — offsetting back by a whole row height printed the
          // two on the same baseline, one over the other.
          pdf.font('Helvetica').fontSize(8).fillColor('#666');
          pdf.text(line.description, xs[0]!, y - 4, {
            width: cols[0]!.w - 8,
            lineBreak: false,
            ellipsis: true,
          });
          y += 10;
        }
      }
      if (doc.lines.length === 0) {
        pdf.font('Helvetica').fontSize(9).fillColor('#666');
        pdf.text('No line items.', left, y);
        y += 16;
      }

      // ---- Totals ---------------------------------------------------------
      y += 8;
      pdf.moveTo(left, y).lineTo(right, y).strokeColor('#ddd').stroke();
      y += 10;

      const totalsX = right - 240;
      const money = (label: string, value: string, bold = false) => {
        pdf
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(9)
          .fillColor(bold ? '#000' : '#444');
        pdf.text(label, totalsX, y, { width: 120, align: 'left' });
        pdf.text(value, totalsX + 120, y, { width: 120, align: 'right' });
        y += 15;
      };

      money('Billed', naira(doc.totals.gross));
      if (doc.totals.discounts > 0) {
        money('Discounts', `- ${naira(doc.totals.discounts)}`);
      }
      money('Net', naira(doc.totals.net));
      if (doc.totals.paid > 0) money('Paid', naira(doc.totals.paid));

      y += 2;
      pdf
        .moveTo(totalsX, y)
        .lineTo(right, y)
        .strokeColor('#999')
        .stroke();
      y += 8;
      pdf.font('Helvetica-Bold').fontSize(12).fillColor('#000');
      const owed =
        doc.totals.overpaid > 0 ? doc.totals.overpaid : doc.totals.balance;
      pdf.text(doc.totals.overpaid > 0 ? 'Credit' : 'Amount due', totalsX, y, {
        width: 120,
        align: 'left',
      });
      pdf.text(naira(owed), totalsX + 120, y, { width: 120, align: 'right' });
      y += 26;

      // ---- Notes ----------------------------------------------------------
      if (doc.notes) {
        pdf.font('Helvetica-Bold').fontSize(8).fillColor('#666');
        pdf.text('NOTES', left, y);
        pdf.font('Helvetica').fontSize(9).fillColor('#000');
        pdf.text(doc.notes, left, pdf.y + 2, { width: usable - 260 });
      }

      // A draft can be shared for checking, so the page has to say what it is
      // — an unissued bill that looks issued is how a family pays the wrong
      // amount early.
      if (doc.draft) {
        pdf.save();
        pdf
          .rotate(-30, { origin: [pdf.page.width / 2, pdf.page.height / 2] })
          .font('Helvetica-Bold')
          .fontSize(72)
          .fillColor('#000')
          .opacity(0.07)
          .text('DRAFT', 0, pdf.page.height / 2 - 40, {
            width: pdf.page.width,
            align: 'center',
          });
        pdf.restore();
      }

      pdf.end();
    });
  }
}
