import { describe, expect, it } from 'vitest';
import { describeSeatPreference, rankTicketTiers, recommendTier } from './recommendation';
import type { TierAvailability } from './recommendation';

describe('ticket tier priority', () => {
  it('sorts descending, merges equal-price tiers and leaves inputs untouched', () => {
    const prices = Object.freeze([900, 2500, 1500, 2500, 2000]);
    expect(rankTicketTiers(prices)).toEqual([2500, 2000, 1500, 900]);
    expect(prices).toEqual([900, 2500, 1500, 2500, 2000]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid price %s', (price) => {
    expect(() => rankTicketTiers([900, price])).toThrow(RangeError);
  });

  it('starts at the highest tier with an explicit unknown state', () => {
    const result = recommendTier([900, 1500, 2500, 2000]);
    expect(result.nextTier).toMatchObject({ price: 2500, availability: 'unknown', statusLabel: '待官网核实' });
    expect(result.status).toBe('check_official');
    expect(result.tiers.every((tier) => tier.availability === 'unknown')).toBe(true);
  });

  it('falls back only after the user explicitly marks higher tiers unavailable', () => {
    const availability = Object.freeze({ 2500: 'unavailable', 2000: 'unavailable', 1500: 'available' } as const);
    const result = recommendTier([900, 2500, 1500, 2000], availability, 2);
    expect(result.nextTier).toMatchObject({ price: 1500, availability: 'available', ticketSubtotal: 3000 });
    expect(result.status).toBe('user_reported_available');
    expect(availability).toEqual({ 2500: 'unavailable', 2000: 'unavailable', 1500: 'available' });
  });

  it('does not skip an unknown tier in favour of a lower available tier', () => {
    const result = recommendTier([2500, 2000, 1500], { 2500: 'unavailable', 1500: 'available' });
    expect(result.nextTier?.price).toBe(2000);
    expect(result.status).toBe('check_official');
    expect(result.explanation).toContain('未知状态不能当成售罄');
  });

  it('returns no next tier when all tiers were marked unavailable', () => {
    const result = recommendTier([2500, 2000], { 2500: 'unavailable', 2000: 'unavailable' });
    expect(result.nextTier).toBeNull();
    expect(result.status).toBe('all_unavailable');
    expect(result.explanation).toContain('不代表平台实时库存');
  });

  it('does not invent prices when no official tiers were supplied', () => {
    expect(recommendTier([])).toMatchObject({ tiers: [], nextTier: null, status: 'no_tiers' });
  });

  it('reports a budget conflict without silently changing the requested priority', () => {
    const result = recommendTier([2500, 2000, 1500], {}, 2, 4000);
    expect(result.nextTier?.price).toBe(2500);
    expect(result.status).toBe('over_budget');
    expect(result.tiers.map((tier) => tier.withinBudget)).toEqual([false, true, true]);
    expect(result.explanation).toContain('服务费、渠道费和保险需另核实');
  });

  it('accepts a budget exactly equal to the ticket subtotal without claiming final payable cost', () => {
    expect(recommendTier([2500], { 2500: 'available' }, 4, 10000)).toMatchObject({
      status: 'user_reported_available', nextTier: { ticketSubtotal: 10000, withinBudget: true },
    });
  });

  it.each([0, 5, 1.5, Number.NaN])('rejects invalid quantity %s', (quantity) => {
    expect(() => recommendTier([2500], {}, quantity)).toThrow(RangeError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid budget %s', (budget) => {
    expect(() => recommendTier([2500], {}, 1, budget)).toThrow(RangeError);
  });

  it('rejects unsupported status values rather than interpreting them as availability', () => {
    expect(() => recommendTier([2500], { 2500: 'sold_out' as TierAvailability })).toThrow(RangeError);
  });

  it('cannot overflow ticket subtotals', () => {
    expect(() => recommendTier([Number.MAX_VALUE], {}, 4)).toThrow(RangeError);
  });
});

describe('seat preference guidance', () => {
  it('describes center and aisle preferences without inventing live seats or popularity', () => {
    expect(describeSeatPreference('center')).toContain('靠中不保证视野更好');
    expect(describeSeatPreference('aisle')).toContain('座位块边缘不一定是过道');
    expect(describeSeatPreference('either')).toContain('同等条件不预设两者优先级');
    expect(describeSeatPreference('either')).toContain('不判断哪些座位最抢手');
  });

  it('asks for an actual adjacent group when multiple tickets are requested', () => {
    expect(describeSeatPreference('center', 3)).toContain('需要 3 张时，请额外核实是否连座');
    expect(describeSeatPreference('center', 3)).toContain('尚未核实具体座号与实时库存');
    expect(describeSeatPreference('center', 3)).toContain('不生成具体座位推荐');
  });
});
