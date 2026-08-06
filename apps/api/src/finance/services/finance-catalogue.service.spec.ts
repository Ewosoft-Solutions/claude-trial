import { FinanceCatalogueService } from './finance-catalogue.service';

/**
 * The fee-item catalogue + invoice line items. The behaviours that matter:
 * codes are unique per tenant, tenant ownership is asserted before any mutation,
 * and every line change re-syncs the flat `amountDue` to Σ(amount × quantity).
 */
describe('FinanceCatalogueService', () => {
  const feeItem = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const feeInvoice = { findFirst: jest.fn(), update: jest.fn() };
  const feeInvoiceLine = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const client = { feeItem, feeInvoice, feeInvoiceLine };
  const service = new FinanceCatalogueService(
    { client } as never,
    { isScoped: false } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    feeItem.create.mockImplementation(async ({ data }: any) => ({
      id: 'fi-1',
      ...data,
    }));
    feeItem.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }));
    feeInvoiceLine.create.mockImplementation(async ({ data }: any) => ({
      id: 'line-1',
      ...data,
    }));
    feeInvoiceLine.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }));
  });

  describe('createFeeItem', () => {
    it('rejects a duplicate code within the tenant', async () => {
      feeItem.findFirst.mockResolvedValue({ id: 'fi-existing' });
      await expect(
        service.createFeeItem('t1', { code: 'boarding', name: 'Boarding' }),
      ).rejects.toThrow(/already exists/);
      expect(feeItem.create).not.toHaveBeenCalled();
    });

    it('creates an active item when the code is free', async () => {
      feeItem.findFirst.mockResolvedValue(null);
      const item = await service.createFeeItem('t1', {
        code: 'pta_levy',
        name: 'PTA levy',
        defaultAmount: 500000,
      });
      expect(item).toMatchObject({
        tenantId: 't1',
        code: 'pta_levy',
        active: true,
        defaultAmount: 500000,
      });
    });
  });

  describe('addLine', () => {
    it('validates invoice + fee item, then re-syncs amountDue', async () => {
      feeInvoice.findFirst.mockResolvedValue({ id: 'inv-1' });
      feeItem.findFirst.mockResolvedValue({ id: 'fi-1' });
      feeInvoiceLine.findMany.mockResolvedValue([
        { amount: 1_000_000, quantity: 1 },
        { amount: 200_000, quantity: 3 },
      ]);

      await service.addLine('t1', 'inv-1', {
        feeItemId: 'fi-1',
        amount: 200_000,
        quantity: 3,
      });

      expect(feeInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { amountDue: 1_600_000 },
      });
    });

    it('rejects a fee item from another tenant', async () => {
      feeInvoice.findFirst.mockResolvedValue({ id: 'inv-1' });
      feeItem.findFirst.mockResolvedValue(null);
      await expect(
        service.addLine('t1', 'inv-1', { feeItemId: 'other', amount: 100 }),
      ).rejects.toThrow(/Fee item not found/);
      expect(feeInvoiceLine.create).not.toHaveBeenCalled();
    });
  });

  describe('removeLine', () => {
    it('deletes the line and re-syncs the invoice total', async () => {
      feeInvoiceLine.findFirst.mockResolvedValue({
        id: 'line-1',
        invoiceId: 'inv-1',
      });
      feeInvoiceLine.findMany.mockResolvedValue([
        { amount: 1_000_000, quantity: 1 },
      ]);

      const result = await service.removeLine('t1', 'line-1');

      expect(feeInvoiceLine.delete).toHaveBeenCalledWith({
        where: { id: 'line-1' },
      });
      expect(feeInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { amountDue: 1_000_000 },
      });
      expect(result).toEqual({ deleted: true });
    });
  });
});
