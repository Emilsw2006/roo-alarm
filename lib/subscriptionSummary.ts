import { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { resolveTrialDaysFromProduct } from './subscriptionPricing';

export type PlanKey = 'annual' | 'weekly' | 'unknown';

export type SubscriptionSummary = {
  isActive: boolean;
  isSimulated: boolean;
  planKey: PlanKey | null;
  planLabel: string;
  statusLabel: string;
  priceLabel: string | null;
  renewalDate: Date | null;
  willRenew: boolean;
  isTrial: boolean;
  productId: string | null;
};

const ENTITLEMENT_ID = 'premium';

const inferPlanKey = (productId: string | null | undefined): PlanKey => {
  const id = (productId || '').toLowerCase();
  if (id.includes('annual') || id.includes('year')) return 'annual';
  if (id.includes('week')) return 'weekly';
  return 'unknown';
};

const findPriceForProduct = (
  productId: string | null,
  annualPackage: PurchasesPackage | null,
  weeklyPackage: PurchasesPackage | null
) => {
  if (!productId) return null;
  const match = [annualPackage, weeklyPackage].find(
    (pkg) => pkg?.product.identifier === productId
  );
  return match?.product.priceString ?? null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

const addYears = (date: Date, years: number) => {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
};

const furthestFuture = (dates: (Date | null)[]): Date | null => {
  const valid = dates.filter((d): d is Date => d != null);
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest
  );
};

// Elige la fecha de caducidad más fiable. El sandbox de Apple ACELERA las
// duraciones (un anual caduca en ~1h, la prueba de 3 días en minutos), así que
// `subscription_expires_at` de RevenueCat/BD cae casi pegado al alta. Para que
// el usuario vea la fecha real prometida, calculamos "alta + duración del plan"
// y tomamos la más futura entre todas. En producción la fecha real de RevenueCat
// suele ser la mayor y gana, así que no falsea nada.
const resolveExpiration = (
  revenueCatExpiration: Date | null,
  dbExpiresAt: string | null | undefined,
  planExpectedEnd: Date | null
): Date | null =>
  furthestFuture([revenueCatExpiration, parseDate(dbExpiresAt), planExpectedEnd]);

export function buildSubscriptionSummary(params: {
  hasPremiumAccess: boolean;
  isSimulated: boolean;
  configured: boolean;
  customerInfo: CustomerInfo | null;
  annualPackage: PurchasesPackage | null;
  weeklyPackage: PurchasesPackage | null;
  dbExpiresAt?: string | null;
  dbStatus?: string | null;
  dbSubscribedAt?: string | null;
  dbPlan?: string | null;
  labels: {
    inactive: string;
    active: string;
    trial: string;
    annual: string;
    weekly: string;
    unknownPlan: string;
    simulated: string;
    devAccess: string;
  };
}): SubscriptionSummary {
  const {
    hasPremiumAccess,
    isSimulated,
    configured,
    customerInfo,
    annualPackage,
    weeklyPackage,
    dbExpiresAt,
    dbStatus,
    dbSubscribedAt,
    dbPlan,
    labels,
  } = params;

  // Fecha de fin "real" según la duración prometida del plan, calculada desde el
  // alta. Evita mostrar la fecha acelerada del sandbox.
  const computeExpectedEnd = (plan: PlanKey | null, isTrialPeriod: boolean): Date | null => {
    const signup = parseDate(dbSubscribedAt);
    if (!signup) return null;
    if (isTrialPeriod) {
      const trialDays = resolveTrialDaysFromProduct(annualPackage);
      return addDays(signup, trialDays);
    }
    if (plan === 'annual') return addYears(signup, 1);
    if (plan === 'weekly') return addDays(signup, 7);
    return null;
  };

  if (!hasPremiumAccess) {
    return {
      isActive: false,
      isSimulated: false,
      planKey: null,
      planLabel: labels.inactive,
      statusLabel: labels.inactive,
      priceLabel: null,
      renewalDate: null,
      willRenew: false,
      isTrial: false,
      productId: null,
    };
  }

  if (isSimulated && !configured) {
    return {
      isActive: true,
      isSimulated: true,
      planKey: null,
      planLabel: labels.simulated,
      statusLabel: labels.devAccess,
      priceLabel: null,
      renewalDate: resolveExpiration(
        null,
        dbExpiresAt,
        computeExpectedEnd(inferPlanKey(dbPlan), dbStatus === 'trial')
      ),
      willRenew: false,
      isTrial: dbStatus === 'trial',
      productId: null,
    };
  }

  const entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  const productId = entitlement?.productIdentifier ?? null;
  // Si RevenueCat no tiene entitlement activo (p. ej. cancelado en sandbox) usamos
  // el plan guardado en la BD para no perder el tipo de plan.
  const planKey = productId ? inferPlanKey(productId) : inferPlanKey(dbPlan);
  const planLabel =
    planKey === 'annual' ? labels.annual : planKey === 'weekly' ? labels.weekly : labels.unknownPlan;
  const revenueCatExpiration = entitlement?.expirationDate
    ? new Date(entitlement.expirationDate)
    : null;
  const isTrial = entitlement?.periodType === 'TRIAL' || dbStatus === 'trial';
  const expiration = resolveExpiration(
    revenueCatExpiration,
    dbExpiresAt,
    computeExpectedEnd(planKey, isTrial)
  );
  const willRenew = entitlement?.willRenew ?? false;

  return {
    isActive: true,
    isSimulated: false,
    planKey,
    planLabel,
    statusLabel: isTrial ? labels.trial : labels.active,
    priceLabel: findPriceForProduct(productId, annualPackage, weeklyPackage),
    renewalDate: expiration,
    willRenew,
    isTrial,
    productId,
  };
}
