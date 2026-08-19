import { Prisma } from '@workspace/database';
import { NotFoundException } from '@nestjs/common';

/**
 * Everything the derived balance needs. Kept in one place because four services
 * now ask the same question — what is actually still owed on this invoice? —
 * and the answer must not drift between them.
 */
export const INVOICE_FINANCIALS_INCLUDE = {
  lines: { select: { amount: true, quantity: true } },
  adjustments: { where: { status: 'applied' }, select: { amount: true } },
  allocations: { select: { amount: true } },
  creditApplications: { select: { amount: true } },
} satisfies Prisma.FeeInvoiceInclude;

export interface InvoiceFinancialsInput {
  lines: { amount: number; quantity: number }[];
  adjustments: { amount: number }[];
  allocations: { amount: number }[];
  creditApplications: { amount: number }[];
}

export interface InvoiceFinancials {
  gross: number; // Σ line.amount × quantity
  discounts: number; // Σ applied adjustments
  net: number; // gross − discounts (never < 0)
  allocated: number; // Σ payment allocations
  credited: number; // Σ credit drawn down onto this invoice
  paid: number; // allocated + credited
  balance: number; // net − paid, floored at 0 (outstanding)
  overpaid: number; // paid − net, floored at 0
}

/**
 * The balance is DERIVED, never stored-and-edited: what was billed, less what
 * was forgiven, less what has been settled — by cash or by credit. This is what
 * lets part-payments, installments and waivers reconcile without any running
 * total being overwritten.
 */
export function computeFinancials(
  invoice: InvoiceFinancialsInput,
): InvoiceFinancials {
  const gross = invoice.lines.reduce((s, l) => s + l.amount * l.quantity, 0);
  const discounts = invoice.adjustments.reduce((s, a) => s + a.amount, 0);
  const net = Math.max(0, gross - discounts);
  const allocated = invoice.allocations.reduce((s, a) => s + a.amount, 0);
  const credited = invoice.creditApplications.reduce((s, c) => s + c.amount, 0);
  const paid = allocated + credited;
  return {
    gross,
    discounts,
    net,
    allocated,
    credited,
    paid,
    balance: Math.max(0, net - paid),
    overpaid: Math.max(0, paid - net),
  };
}

/**
 * The status that follows from the money. `draft` and `cancelled` are decisions
 * a person made, so they are left alone; everything else is a consequence of
 * what has been settled and whether the due date has passed.
 */
export function deriveInvoiceStatus(
  current: string,
  financials: InvoiceFinancials,
  dueDate: Date | null,
  now: Date = new Date(),
): string {
  if (current === 'draft' || current === 'cancelled') return current;
  // Settled by ANY mix of payment, credit and approved waiver (the design's
  // rule) — so a fully-waived invoice reads `paid` too.
  if (financials.balance === 0) return 'paid';
  // Past due outranks part-paid: what a bursar needs to see about a bill 90
  // days late is that it is late, not that something was once paid against it.
  if (dueDate && dueDate < now) return 'overdue';
  if (financials.paid > 0) return 'partial';
  return current === 'overdue' || current === 'partial' ? 'issued' : current;
}

/**
 * Re-derive an invoice's cached `amountPaid` + status from its own rows, inside
 * the caller's transaction. The cache exists so the list can sort on what has
 * been paid; this is the ONE writer that maintains it, immediately after any
 * allocation or credit application, so it can never drift from the rows it
 * summarises.
 */
export async function refreshInvoiceTotals(
  client: Prisma.TransactionClient,
  tenantId: string,
  invoiceId: string,
) {
  const invoice = await client.feeInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: INVOICE_FINANCIALS_INCLUDE,
  });
  if (!invoice) throw new NotFoundException('Invoice not found');
  const financials = computeFinancials(invoice);
  const updated = await client.feeInvoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: financials.paid,
      status: deriveInvoiceStatus(invoice.status, financials, invoice.dueDate),
    },
  });
  return { invoice: updated, financials };
}
