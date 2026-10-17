import { describe, expect, it } from 'vitest';
import { calculateTargetBudget, formatSaleInZone, saleCountdown, TARGET_SALE_AT } from './ticketPlanning';

describe('official target sale planning', () => {
  it('represents the same sale instant in Bangkok, Beijing and UTC', () => {
    expect(new Date(TARGET_SALE_AT).toISOString()).toBe('2026-10-18T04:00:00.000Z');
    expect(formatSaleInZone('Asia/Bangkok')).toBe('18/10/2026, 11:00');
    expect(formatSaleInZone('Asia/Shanghai')).toBe('18/10/2026, 12:00');
    expect(formatSaleInZone('UTC')).toBe('18/10/2026, 04:00');
    expect(formatSaleInZone('America/Los_Angeles')).toBe('17/10/2026, 21:00');
  });

  it('counts absolute time and does not reach zero a fraction of a second early', () => {
    const sale = Date.parse(TARGET_SALE_AT);
    expect(saleCountdown(sale - 1000 * (86400 + 3600 + 60 + 1))).toEqual({ seconds: 90061, days: 1, hours: 1, minutes: 1, remainingSeconds: 1 });
    expect(saleCountdown(sale - 1).seconds).toBe(1);
    expect(saleCountdown(sale).seconds).toBe(0);
    expect(saleCountdown(sale + 86400000).seconds).toBe(0);
  });

  it('includes documented per-ticket service fees at the quantity boundaries', () => {
    expect(calculateTargetBudget(1, 2500, '')).toMatchObject({ validQuantity: true, ticketSubtotal: 2500, serviceFee: 30, knownSubtotal: 2530, budgetState: 'unset' });
    expect(calculateTargetBudget(4, 900, '3720')).toMatchObject({ validQuantity: true, ticketSubtotal: 3600, serviceFee: 120, knownSubtotal: 3720, budgetState: 'withinKnownSubtotal' });
    expect(calculateTargetBudget(4, 2500, '10119.99').budgetState).toBe('exceeded');
    expect(calculateTargetBudget(4, 2500, '10120').budgetState).toBe('withinKnownSubtotal');
  });

  it.each([0, 5, -1, 1.5, Infinity, NaN])('rejects an unsupported quantity %s without manufacturing a subtotal', (quantity) => {
    expect(calculateTargetBudget(quantity, 2500, '')).toMatchObject({ validQuantity: false, knownSubtotal: null });
  });

  it('does not accept reference activity prices in the target calculator', () => {
    expect(calculateTargetBudget(1, 5900, '')).toMatchObject({ validPrice: false, knownSubtotal: null });
  });

  it.each(['0', '-1', 'Infinity', '1e5', 'hello', '100.123', '99999999999999999999'])('rejects invalid or unsafe budgets %s', (budget) => {
    expect(calculateTargetBudget(1, 2500, budget).budgetState).toBe('invalid');
  });
});
