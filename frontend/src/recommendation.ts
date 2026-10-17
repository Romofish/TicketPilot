/** Local planning only. Availability is an explicit user report, never live inventory. */
export type TierAvailability = 'unknown' | 'available' | 'unavailable';
export type SeatPreference = 'center' | 'aisle' | 'either';

export interface TierPlan {
  price: number;
  availability: TierAvailability;
  /** Ticket face value only; excludes service fees, channel fees and insurance. */
  ticketSubtotal: number;
  withinBudget: boolean;
  statusLabel: string;
}

export interface TierRecommendation {
  tiers: TierPlan[];
  /** The next tier to inspect, not a claim that tickets can be purchased. */
  nextTier: TierPlan | null;
  status: 'check_official' | 'user_reported_available' | 'all_unavailable' | 'over_budget' | 'no_tiers';
  explanation: string;
}

const availabilityLabels: Record<TierAvailability, string> = {
  unknown: '待官网核实',
  available: '用户标记可用，提交前再核实',
  unavailable: '用户已确认当前不可用',
};

function validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4) {
    throw new RangeError('购票数量必须是 1 至 4 的整数。');
  }
}

/** Highest face value first, as requested. Equal prices represent one tier. */
export function rankTicketTiers(prices: readonly number[]): number[] {
  if (prices.some((price) => !Number.isFinite(price) || price <= 0)) {
    throw new RangeError('票价必须是大于零的有限数字。');
  }
  return [...new Set(prices)].sort((left, right) => right - left);
}

/**
 * A missing status remains unknown, even when a lower tier is marked available.
 * Only an explicit unavailable status advances to the next price tier.
 * maxTicketSubtotal is a ticket-face-value budget, not an all-inclusive budget.
 */
export function recommendTier(
  prices: readonly number[],
  availabilityByTier: Readonly<Partial<Record<number, TierAvailability>>> = {},
  quantity = 1,
  maxTicketSubtotal?: number,
): TierRecommendation {
  validateQuantity(quantity);
  if (maxTicketSubtotal !== undefined && (!Number.isFinite(maxTicketSubtotal) || maxTicketSubtotal < 0)) {
    throw new RangeError('票面总预算必须是大于或等于零的有限数字。');
  }
  const tiers = rankTicketTiers(prices).map((price): TierPlan => {
    const availability = availabilityByTier[price] ?? 'unknown';
    if (!Object.hasOwn(availabilityLabels, availability)) {
      throw new RangeError('票档状态必须是 unknown、available 或 unavailable。');
    }
    const ticketSubtotal = price * quantity;
    if (!Number.isFinite(ticketSubtotal)) {
      throw new RangeError('票面小计超出可计算范围。');
    }
    return {
      price,
      availability,
      ticketSubtotal,
      withinBudget: maxTicketSubtotal === undefined || ticketSubtotal <= maxTicketSubtotal,
      statusLabel: availabilityLabels[availability],
    };
  });

  if (!tiers.length) {
    return { tiers, nextTier: null, status: 'no_tiers', explanation: '尚未提供已核实票档，请先查看官方活动说明。' };
  }

  const nextTier = tiers.find((tier) => tier.availability !== 'unavailable') ?? null;
  if (!nextTier) {
    return {
      tiers, nextTier, status: 'all_unavailable',
      explanation: '你已将全部票档标记为当前不可用；这仅是人工记录，不代表平台实时库存或最终售罄。',
    };
  }

  const priority = '按你的要求从最高票档开始，只有明确当前不可用才考虑下一档。';
  if (!nextTier.withinBudget) {
    return {
      tiers, nextTier, status: 'over_budget',
      explanation: `${priority}当前 ${nextTier.price} THB 档的 ${quantity} 张票面小计为 ${nextTier.ticketSubtotal} THB，超过票面预算；请调整数量或预算，不会将超预算当成售罄自动降档。服务费、渠道费和保险需另核实。`,
    };
  }
  if (nextTier.availability === 'unknown') {
    return {
      tiers, nextTier, status: 'check_official',
      explanation: `${priority}下一步先核实 ${nextTier.price} THB 档是否有 ${quantity} 张满足要求的座位；未知状态不能当成售罄，也不能保证可购。票价排序不代表视野或销售热度。`,
    };
  }
  return {
    tiers, nextTier, status: 'user_reported_available',
    explanation: `${priority}你标记 ${nextTier.price} THB 档可用，请在官网核对 ${quantity} 张实际座位及最终金额；该记录不保证当前库存或预订成功。票价排序不代表视野或销售热度。`,
  };
}

/** Strategies require the actual seat map; no coordinates or seat numbers are invented. */
export function describeSeatPreference(preference: SeatPreference, quantity = 1): string {
  validateQuantity(quantity);
  const descriptions: Record<SeatPreference, string> = {
    center: '在当前票档的实际可用座位中，优先查看靠舞台中轴线的座位，再核对排数、遮挡和座位图方向；靠中不保证视野更好。',
    aisle: '在当前票档的实际可用座位中，优先查看邻接真实过道的座位，再核对排数、遮挡及通行影响；座位块边缘不一定是过道。',
    either: '在当前票档的实际可用座位中，先比较靠中与靠真实过道的候选；若两者冲突由你选择，同等条件不预设两者优先级。',
  };
  if (!Object.hasOwn(descriptions, preference)) {
    throw new RangeError('座位偏好必须是 center、aisle 或 either。');
  }
  const adjacency = quantity > 1 ? `需要 ${quantity} 张时，请额外核实是否连座。` : '';
  return `${descriptions[preference]}${adjacency}尚未核实具体座号与实时库存，因此只提供挑选策略，不生成具体座位推荐，也不判断哪些座位最抢手。`;
}
