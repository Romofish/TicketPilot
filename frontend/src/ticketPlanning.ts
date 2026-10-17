export const TARGET_SALE_AT = '2026-10-18T11:00:00+07:00';
export const TARGET_PRICES = [2500, 2000, 1500, 900] as const;
export const TARGET_URL = 'https://www.allticket.com/event/PlsLoveFanScreeningFinalEP';
export const REFERENCE_URL = 'https://www.allticket.com/event/LENAMIUGirlsNightOutBDParty';

/** The countdown uses the local clock; it cannot determine the website's sale state. */
export function saleCountdown(now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(TARGET_SALE_AT) - now) / 1000));
  return {
    seconds,
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    remainingSeconds: seconds % 60,
  };
}

export function formatSaleInZone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(TARGET_SALE_AT));
}

export type BudgetState = 'unset' | 'invalid' | 'exceeded' | 'withinKnownSubtotal';

/** Only documented ticket + service fees are included. Payment-fee bases are unverified. */
export function calculateTargetBudget(quantity: number, price: number, budget: string) {
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 4;
  const validPrice = TARGET_PRICES.some((allowed) => allowed === price);
  const validPlan = validQuantity && validPrice;
  const ticketSubtotal = validPlan ? quantity * price : null;
  const serviceFee = validPlan ? quantity * 30 : null;
  const knownSubtotal = ticketSubtotal !== null && serviceFee !== null ? ticketSubtotal + serviceFee : null;
  const input = budget.trim();
  const budgetAmount = /^(?:\d+)(?:\.\d{1,2})?$/.test(input) ? Number(input) : NaN;
  const validBudget = Number.isFinite(budgetAmount) && budgetAmount > 0 && budgetAmount <= Number.MAX_SAFE_INTEGER / 100;
  const budgetState: BudgetState = !input ? 'unset' : !validBudget ? 'invalid' : knownSubtotal !== null && knownSubtotal > budgetAmount ? 'exceeded' : 'withinKnownSubtotal';
  return { validQuantity, validPrice, ticketSubtotal, serviceFee, knownSubtotal, budgetState, budgetAmount: validBudget ? budgetAmount : null };
}
