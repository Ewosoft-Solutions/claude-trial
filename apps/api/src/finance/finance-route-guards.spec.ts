import 'reflect-metadata';

import { PERMISSIONS_KEY } from '../auth/guards/permission.guard';
import { STEP_UP_OPERATION_KEY } from '../auth/guards/step-up.guard';
import { FinanceController } from './controllers/finance.controller';
import { FinanceLedgerController } from './controllers/finance-ledger.controller';
import { FinanceReportController } from './controllers/finance-report.controller';
import { FinanceCatalogueController } from './controllers/finance-catalogue.controller';
import { FinanceAdjustmentController } from './controllers/finance-adjustment.controller';

/**
 * Authorisation has to be enforced SERVER-SIDE, not by which buttons the UI
 * renders (AGENTS.md golden rule 5), and DoD §5 asks for unauthorized-scope
 * cover. The e2e proves the guard stack rejects anonymous callers; this pins
 * the thing a refactor actually breaks — a route quietly losing the permission
 * or step-up declaration that stands between it and someone else's money.
 */
type Handler = (...args: unknown[]) => unknown;

function handler(controller: object, method: string): Handler {
  const fn = (controller as Record<string, unknown>)[method];
  if (typeof fn !== 'function') {
    throw new Error(`${method} is not a route handler on this controller`);
  }
  return fn as Handler;
}

function permissionsOn(controller: object, method: string): string[] {
  return (
    (Reflect.getMetadata(
      PERMISSIONS_KEY,
      handler(controller, method),
    ) as string[]) ?? []
  );
}

function stepUpOn(controller: object, method: string): string | undefined {
  return Reflect.getMetadata(
    STEP_UP_OPERATION_KEY,
    handler(controller, method),
  ) as string | undefined;
}

describe('Finance routes — what stands between a caller and the money', () => {
  describe('reading is gated, and the ledger is its own authority', () => {
    it.each([
      ['listReceipts', 'finance.view'],
      ['getReceipt', 'finance.view'],
      ['listCredits', 'finance.view'],
      ['listInvoices', 'finance.view'],
    ])('%s requires %s', (method, permission) => {
      expect(permissionsOn(FinanceController.prototype, method)).toContain(
        permission,
      );
    });

    // Seeing the books is a different authority from seeing a bill: a bursar
    // with finance.view does NOT get the ledger.
    it.each(['accounts', 'trialBalance', 'entries', 'entry', 'periods'])(
      'ledger read %s requires finance.gl.view',
      (method) => {
        expect(
          permissionsOn(FinanceLedgerController.prototype, method),
        ).toEqual(['finance.gl.view']);
      },
    );

    it('reconciliation reads the ledger, so it needs the ledger permission', () => {
      expect(
        permissionsOn(FinanceReportController.prototype, 'reconciliation'),
      ).toEqual(['finance.gl.view']);
    });
  });

  describe('every route that moves money is step-up gated', () => {
    it.each([
      ['recordReceipt', 'financial.transactions'],
      ['applyCredit', 'financial.transactions'],
      ['createInvoice', 'financial.fee-structure.update'],
      ['updateInvoice', 'financial.fee-structure.update'],
    ])('%s requires step-up %s', (method, operation) => {
      expect(stepUpOn(FinanceController.prototype, method)).toBe(operation);
      expect(permissionsOn(FinanceController.prototype, method)).toContain(
        'finance.manage',
      );
    });

    it.each([
      ['reverse', 'financial.journal.reverse'],
      ['createPeriod', 'financial.period.close'],
      ['setPeriodStatus', 'financial.period.close'],
    ])('ledger %s requires step-up %s', (method, operation) => {
      expect(stepUpOn(FinanceLedgerController.prototype, method)).toBe(
        operation,
      );
      expect(permissionsOn(FinanceLedgerController.prototype, method)).toEqual([
        'finance.gl.manage',
      ]);
    });

    it('exporting the journal needs the manage authority, not just a look', () => {
      expect(
        permissionsOn(FinanceLedgerController.prototype, 'export'),
      ).toEqual(['finance.gl.manage']);
    });
  });

  describe('changing what a family owes', () => {
    it.each(['addLine', 'updateLine', 'removeLine'])(
      '%s requires finance.manage',
      (method) => {
        expect(
          permissionsOn(FinanceCatalogueController.prototype, method),
        ).toContain('finance.manage');
      },
    );

    it.each(['request', 'approve', 'reject', 'createPolicy', 'activatePolicy'])(
      'adjustment %s requires finance.manage',
      (method) => {
        expect(
          permissionsOn(FinanceAdjustmentController.prototype, method),
        ).toContain('finance.manage');
      },
    );
  });
});
