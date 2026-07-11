/** IDs de App Store Connect — deben coincidir en RevenueCat y StoreKit (simulador). */
export const SUBSCRIPTION_PRODUCT_IDS = {
  annual: 'rooalarm_annual',
  weekly: 'rooalarm_weekly',
} as const;

/** Paquetes del offering `default` en RevenueCat (Annual 3-day trial + Weekly). */
export const REVENUECAT_PACKAGE_LOOKUP_KEYS = {
  annual: '$rc_annual',
  weekly: '$rc_weekly',
} as const;

export const SUBSCRIPTION_ENTITLEMENT_ID = 'premium';
