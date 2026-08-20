import { describe, expect, it } from 'vitest';

import { deriveFinancials, parseQuantity, stepQuantity } from './invoice-lines';

const lines = [
  { id: 'a', amount: 150_000_00, quantity: 2 },
  { id: 'b', amount: 45_000_00, quantity: 1 },
];

describe('stepQuantity', () => {
  it('moves only the line asked for', () => {
    const next = stepQuantity(lines, 'a', 1);
    expect(next[0]).toMatchObject({ id: 'a', quantity: 3 });
    expect(next[1]).toEqual(lines[1]);
  });

  /**
   * The regression this module exists for. The stepper first computed its
   * target from the row's PROP, which does not change between two clicks in
   * the same frame — so four rapid taps all aimed at the same number and the
   * count moved by one. Applying against the current list is what makes a
   * burst accumulate, and this is the cheapest place to prove it.
   */
  it('accumulates across a burst, because each step reads the current list', () => {
    let current = lines;
    for (let i = 0; i < 4; i += 1) current = stepQuantity(current, 'a', 1);
    expect(current[0]?.quantity).toBe(6);
  });

  it('will not go below one — a line billing zero of something is not a line', () => {
    const next = stepQuantity(lines, 'b', -5);
    expect(next[1]?.quantity).toBe(1);
  });

  it('leaves the list alone when the id is unknown', () => {
    expect(stepQuantity(lines, 'nope', 1)).toEqual(lines);
  });
});

describe('parseQuantity', () => {
  it('accepts a whole positive count', () => {
    expect(parseQuantity('3')).toBe(3);
    expect(parseQuantity('  12 ')).toBe(12);
  });

  it.each([
    ['', 'blank'],
    ['0', 'zero'],
    ['-2', 'negative'],
    ['1.5', 'fractional'],
    ['1e3', 'exponential'],
    ['3 bags', 'trailing words — parseInt would have read this as 3'],
    ['abc', 'nonsense'],
    ['First term1', 'text typed into the quantity box'],
  ])('rejects %s (%s)', (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});

describe('deriveFinancials', () => {
  it('bills the sum of amount × quantity', () => {
    const fin = deriveFinancials(lines, { discounts: 0, paid: 0 });
    expect(fin.gross).toBe(345_000_00);
    expect(fin.net).toBe(345_000_00);
    expect(fin.balance).toBe(345_000_00);
  });

  it('takes discounts off the billed side and payments off the balance', () => {
    const fin = deriveFinancials(lines, {
      discounts: 45_000_00,
      paid: 100_000_00,
    });
    expect(fin.net).toBe(300_000_00);
    expect(fin.balance).toBe(200_000_00);
    expect(fin.overpaid).toBe(0);
  });

  it('reports overpayment as credit rather than a negative balance', () => {
    const fin = deriveFinancials(lines, { discounts: 0, paid: 400_000_00 });
    expect(fin.balance).toBe(0);
    expect(fin.overpaid).toBe(55_000_00);
  });

  it('never lets discounts push what is owed below zero', () => {
    const fin = deriveFinancials(lines, { discounts: 999_999_00, paid: 0 });
    expect(fin.net).toBe(0);
    expect(fin.balance).toBe(0);
  });
});
