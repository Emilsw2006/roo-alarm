import { PurchasesIntroPrice, PurchasesPackage } from 'react-native-purchases';

export const ANNUAL_TRIAL_DAYS = 3;

export type TrialTimelineDates = {
  today: Date;
  reminder: Date;
  billing: Date;
  trialDays: number;
};

export function annualTrialEndDate(from = Date.now(), trialDays = ANNUAL_TRIAL_DAYS) {
  return new Date(from + trialDays * 24 * 60 * 60 * 1000);
}

export function defaultAnnualPriceString(currencySymbol = '€') {
  return `39,99 ${currencySymbol}`;
}

export function resolveAnnualPriceString(
  annualPackage: PurchasesPackage | null | undefined,
  currencySymbol = '€'
) {
  return annualPackage?.product.priceString || defaultAnnualPriceString(currencySymbol);
}

export function hasAnnualIntroTrial(annualPackage: PurchasesPackage | null | undefined) {
  return !!annualPackage?.product.introPrice;
}

export function resolveAnnualPlanSubtitle(
  annualPackage: PurchasesPackage | null | undefined,
  price: string,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (hasAnnualIntroTrial(annualPackage)) {
    const days = resolveTrialDaysFromProduct(annualPackage);
    return t('onboarding.annualPlanTrialSubtitle', { days, price });
  }
  return t('onboarding.annualPlanSubtitle', { price });
}

export function isAnnualTrialPurchase(plan: 'annual' | 'weekly') {
  return plan === 'annual';
}

export function formatPaywallDate(date: Date, locale = 'es-ES') {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
    .format(date)
    .replace(/\.$/, '');
}

export function resolveTrialDaysFromIntro(intro?: PurchasesIntroPrice | null) {
  if (!intro) return ANNUAL_TRIAL_DAYS;

  const isoDays = intro.period?.match(/^P(\d+)D$/i);
  if (isoDays) return Number(isoDays[1]);

  const units = intro.periodNumberOfUnits || 1;
  const cycles = intro.cycles || 1;
  const unit = (intro.periodUnit || '').toUpperCase();

  if (unit === 'DAY') return units * cycles;
  if (unit === 'WEEK') return units * 7 * cycles;
  if (unit === 'MONTH') return units * 30 * cycles;
  if (unit === 'YEAR') return units * 365 * cycles;

  return ANNUAL_TRIAL_DAYS;
}

export function resolveTrialDaysFromProduct(
  annualPackage: PurchasesPackage | null | undefined
) {
  return resolveTrialDaysFromIntro(annualPackage?.product.introPrice);
}

export function buildAnnualTrialTimelineDates(
  trialDays = ANNUAL_TRIAL_DAYS,
  from = Date.now()
): TrialTimelineDates {
  const today = new Date(from);
  today.setHours(12, 0, 0, 0);

  return {
    today,
    reminder: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
    billing: new Date(today.getTime() + trialDays * 24 * 60 * 60 * 1000),
    trialDays,
  };
}

export function buildAnnualTrialTimelineDatesFromProduct(
  annualPackage: PurchasesPackage | null | undefined,
  from = Date.now()
) {
  const trialDays = resolveTrialDaysFromProduct(annualPackage);
  return buildAnnualTrialTimelineDates(trialDays, from);
}
