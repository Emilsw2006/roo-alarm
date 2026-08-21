import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { openManageSubscriptions } from '../lib/manageSubscriptions';
import { scheduleTrialReminderNotification } from '../lib/trialReminder';
import { annualTrialEndDate, isAnnualTrialPurchase, resolveTrialDaysFromProduct } from '../lib/subscriptionPricing';
import { SUBSCRIPTION_ENTITLEMENT_ID, SUBSCRIPTION_PRODUCT_IDS, REVENUECAT_PACKAGE_LOOKUP_KEYS } from './subscriptionProducts';
import { canConfigureRevenueCat, getRevenueCatApiKey } from '../lib/revenueCatEnvironment';
import { withTimeout } from '../lib/withTimeout';
import { supabase } from '../lib/supabase';
import { requestAuthNavigationRefresh } from '../lib/authNavigationRefresh';
import {
  buildDevSubscriptionPayload,
  buildSubscriptionSyncPayload,
  DbSubscription,
  fetchSubscriptionFromSupabase,
  syncSubscriptionToSupabase,
} from '../lib/subscriptionSupabase';

type PlanKey = 'annual' | 'weekly';

interface SubscriptionContextType {
  loading: boolean;
  configured: boolean;
  hasPremiumAccess: boolean;
  isSimulatedPremium: boolean;
  dbSubscription: DbSubscription | null;
  annualPackage: PurchasesPackage | null;
  weeklyPackage: PurchasesPackage | null;
  customerInfo: CustomerInfo | null;
  error: string | null;
  refreshCustomerInfo: () => Promise<void>;
  purchasePlan: (plan: PlanKey) => Promise<{ success: boolean; error: string | null }>;
  restorePurchases: () => Promise<{ success: boolean; error: string | null }>;
  openManageSubscriptions: () => Promise<void>;
  grantDevScreenshotAccess: () => Promise<{ success: boolean; error: string | null }>;
}

const ENTITLEMENT_ID = SUBSCRIPTION_ENTITLEMENT_ID;
const premiumFlagKey = (userId: string) => `rooalarm.premium.${userId}`;

const SubscriptionContext = createContext<SubscriptionContextType>({
  loading: true,
  configured: false,
  hasPremiumAccess: false,
  isSimulatedPremium: false,
  dbSubscription: null,
  annualPackage: null,
  weeklyPackage: null,
  customerInfo: null,
  error: null,
  refreshCustomerInfo: async () => {},
  purchasePlan: async () => ({ success: false, error: null }),
  restorePurchases: async () => ({ success: false, error: null }),
  openManageSubscriptions: async () => {},
  grantDevScreenshotAccess: async () => ({ success: false, error: null }),
});

function getApiKey() {
  return getRevenueCatApiKey();
}

function hasPremium(customerInfo: CustomerInfo | null) {
  return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
}

function findPackage(packages: PurchasesPackage[], plan: PlanKey) {
  const lookupKey = plan === 'annual' ? REVENUECAT_PACKAGE_LOOKUP_KEYS.annual : REVENUECAT_PACKAGE_LOOKUP_KEYS.weekly;
  const preferredType = plan === 'annual' ? 'ANNUAL' : 'WEEKLY';
  const preferredWord = plan === 'annual' ? 'annual' : 'weekly';
  const productId = plan === 'annual' ? SUBSCRIPTION_PRODUCT_IDS.annual : SUBSCRIPTION_PRODUCT_IDS.weekly;
  return (
    packages.find((item) => item.identifier === lookupKey) ||
    packages.find((item) => item.product.identifier === productId) ||
    packages.find((item) => item.packageType === preferredType) ||
    packages.find((item) => item.identifier.toLowerCase().includes(preferredWord)) ||
    packages.find((item) => item.product.identifier.toLowerCase().includes(preferredWord)) ||
    null
  );
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const configuredUserId = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [simulatedPremiumAccess, setSimulatedPremiumAccess] = useState(false);
  const [dbSubscription, setDbSubscription] = useState<DbSubscription | null>(null);

  const refreshDbSubscription = useCallback(async (userId: string) => {
    try {
      const row = await fetchSubscriptionFromSupabase(userId);
      setDbSubscription(row);
      return row;
    } catch (err) {
      console.log('Failed to load subscription from Supabase', err);
      return null;
    }
  }, []);

  const persistSubscriptionState = useCallback(
    async (userId: string, info: CustomerInfo | null, fallbackPlan?: PlanKey) => {
      const payload = buildSubscriptionSyncPayload(info, fallbackPlan);
      try {
        await syncSubscriptionToSupabase(userId, payload);
        await refreshDbSubscription(userId);
      } catch (err) {
        console.log('Failed to sync subscription to Supabase', err);
      }
    },
    [refreshDbSubscription]
  );

  const loadPersistedPremium = useCallback(async (userId: string) => {
    const persisted = await AsyncStorage.getItem(premiumFlagKey(userId));
    setSimulatedPremiumAccess(persisted === '1');
  }, []);

  const persistPremiumFlag = useCallback(async (userId: string, enabled: boolean) => {
    await AsyncStorage.setItem(premiumFlagKey(userId), enabled ? '1' : '0');
  }, []);

  // RevenueCat es autoritativo: aplica el estado real de Apple, concediendo o
  // revocando el acceso premium local y sincronizándolo con Supabase.
  const applyCustomerInfo = useCallback(
    async (userId: string, info: CustomerInfo) => {
      setCustomerInfo(info);
      const premium = hasPremium(info);
      setSimulatedPremiumAccess(premium);
      await persistPremiumFlag(userId, premium);
      
      const { data: currentDb } = await supabase.from('user_settings').select('is_subscribed').eq('user_id', userId).maybeSingle();
      if (!premium && currentDb?.is_subscribed) {
        // No sobrescribir a false si en la DB pone que sí está suscrito (ej. concedido manualmente).
        return;
      }
      
      await persistSubscriptionState(userId, info);
    },
    [persistPremiumFlag, persistSubscriptionState]
  );

  const configureForUser = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      await loadPersistedPremium(userId);
      await refreshDbSubscription(userId);

      if (!canConfigureRevenueCat()) {
        setConfigured(false);
        setCustomerInfo(null);
        setPackages([]);
        setError(null);
        // Solo en desarrollo. Sin este guard, un build de release al que le falte
        // la API key de RevenueCat (p. ej. EAS sin los secrets configurados) entra
        // aquí en silencio y regala premium, escribiendo además una suscripción
        // falsa en Supabase. En release debe fallar cerrado: sin key, sin premium.
        if (__DEV__) {
          const persisted = await AsyncStorage.getItem(premiumFlagKey(userId));
          if (persisted === '1') {
            await syncSubscriptionToSupabase(userId, buildDevSubscriptionPayload());
            await refreshDbSubscription(userId);
          }
        } else {
          setError('Falta configurar la API key de RevenueCat.');
        }
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        setConfigured(false);
        setCustomerInfo(null);
        setPackages([]);
        setError('Falta configurar la API key de RevenueCat.');
        return;
      }

      try {
        setError(null);
        const alreadyConfigured = await Purchases.isConfigured();
        if (!alreadyConfigured) {
          Purchases.configure({ apiKey, appUserID: userId });
        } else if (configuredUserId.current !== userId) {
          await Purchases.logIn(userId);
        }
        if (configuredUserId.current !== userId) {
          configuredUserId.current = userId;
        }

        const [info, offerings] = await Promise.all([
          withTimeout(Purchases.getCustomerInfo(), 6000, null),
          withTimeout(Purchases.getOfferings(), 6000, null),
        ]);

        if (info) {
          await applyCustomerInfo(userId, info);
        }
        if (offerings) {
          setPackages(offerings.current?.availablePackages ?? []);
        }
        setConfigured(true);
      } catch (err: any) {
        setConfigured(false);
        setError(err?.message ?? 'No se pudo cargar la suscripción.');
      }
    } finally {
      setLoading(false);
    }
  }, [applyCustomerInfo, loadPersistedPremium, persistPremiumFlag, persistSubscriptionState, refreshDbSubscription]);

  useEffect(() => {
    if (!user?.id || !canConfigureRevenueCat()) return;
    const userId = user.id;
    const listener = (info: CustomerInfo) => {
      void applyCustomerInfo(userId, info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      configuredUserId.current = null;
      setConfigured(false);
      setCustomerInfo(null);
      setPackages([]);
      setError(null);
      setSimulatedPremiumAccess(false);
      setDbSubscription(null);
      setLoading(false);
      return;
    }

    configureForUser(user.id);
  }, [configureForUser, user?.id]);

  const refreshCustomerInfo = useCallback(async () => {
    if (!user?.id) return;
    await configureForUser(user.id);
  }, [configureForUser, user?.id]);

  const purchasePlan = useCallback(async (plan: PlanKey) => {
    if (!user?.id) return { success: false, error: 'Inicia sesión para continuar.' };

    const apiKey = getApiKey();
    if (!apiKey || !configured) {
      setError(null);
      setSimulatedPremiumAccess(true);
      await persistPremiumFlag(user.id, true);
      await syncSubscriptionToSupabase(user.id, buildDevSubscriptionPayload(plan));
      await refreshDbSubscription(user.id);
      if (isAnnualTrialPurchase(plan)) {
        const trialDays = resolveTrialDaysFromProduct(findPackage(packages, plan));
        await scheduleTrialReminderNotification(annualTrialEndDate(undefined, trialDays));
      }
      return { success: true, error: null };
    }

    const selectedPackage = findPackage(packages, plan);
    if (!selectedPackage) {
      return { success: false, error: 'Los planes aún no están disponibles. Revisa RevenueCat y App Store Connect.' };
    }

    try {
      setError(null);
      const { customerInfo: info } = await Purchases.purchasePackage(selectedPackage);
      setCustomerInfo(info);
      const premium = hasPremium(info);
      if (premium) {
        setSimulatedPremiumAccess(true);
        await persistPremiumFlag(user.id, true);
        await persistSubscriptionState(user.id, info, plan);
      if (isAnnualTrialPurchase(plan)) {
        const trialDays = resolveTrialDaysFromProduct(selectedPackage);
        const entitlement = info.entitlements.active[ENTITLEMENT_ID];
        const trialEnd =
          entitlement?.periodType === 'TRIAL' && entitlement.expirationDate
            ? new Date(entitlement.expirationDate)
            : annualTrialEndDate(undefined, trialDays);
        await scheduleTrialReminderNotification(trialEnd);
      }
      } else {
        await persistSubscriptionState(user.id, info);
      }
      return {
        success: premium,
        error: premium ? null : 'No se pudo activar el acceso premium.',
      };
    } catch (err: any) {
      if (err?.userCancelled) return { success: false, error: null };
      const message = err?.message ?? 'No se pudo completar la compra.';
      setError(message);
      return { success: false, error: message };
    }
  }, [configured, packages, persistPremiumFlag, persistSubscriptionState, user?.id]);

  const restorePurchases = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'Inicia sesión para restaurar.' };
    if (!configured) return { success: false, error: error ?? 'RevenueCat no está configurado.' };

    try {
      setError(null);
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const premium = hasPremium(info);
      if (premium) {
        setSimulatedPremiumAccess(true);
        await persistPremiumFlag(user.id, true);
      }
      await persistSubscriptionState(user.id, info);
      return { success: premium, error: premium ? null : 'No encontramos una compra activa.' };
    } catch (err: any) {
      const message = err?.message ?? 'No se pudo restaurar la compra.';
      setError(message);
      return { success: false, error: message };
    }
  }, [configured, error, persistPremiumFlag, persistSubscriptionState, user?.id]);

  const grantDevScreenshotAccess = useCallback(async () => {
    if (!__DEV__) {
      return { success: false, error: 'Solo disponible en desarrollo.' };
    }
    if (!user?.id) {
      return { success: false, error: 'Inicia sesión primero.' };
    }

    try {
      setSimulatedPremiumAccess(true);
      await persistPremiumFlag(user.id, true);
      await syncSubscriptionToSupabase(user.id, buildDevSubscriptionPayload('annual'));
      await refreshDbSubscription(user.id);

      const { data: settings } = await supabase
        .from('user_settings')
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!settings?.name?.trim()) {
        await supabase
          .from('user_settings')
          .upsert(
            { user_id: user.id, name: 'Roo', updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
      }

      requestAuthNavigationRefresh();
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'No se pudo activar el acceso de captura.' };
    }
  }, [persistPremiumFlag, refreshDbSubscription, user?.id]);

  const value = useMemo(() => {
    const premiumFromStore = hasPremium(customerInfo);
    const premiumFromDb = dbSubscription?.is_subscribed === true;
    const hasPremiumAccess = simulatedPremiumAccess || premiumFromStore || premiumFromDb;

    return {
      loading,
      configured,
      hasPremiumAccess,
      isSimulatedPremium: simulatedPremiumAccess && !premiumFromStore,
      dbSubscription,
      annualPackage: findPackage(packages, 'annual'),
      weeklyPackage: findPackage(packages, 'weekly'),
      customerInfo,
      error,
      refreshCustomerInfo,
      purchasePlan,
      restorePurchases,
      openManageSubscriptions,
      grantDevScreenshotAccess,
    };
  }, [configured, customerInfo, dbSubscription, error, grantDevScreenshotAccess, loading, packages, purchasePlan, refreshCustomerInfo, restorePurchases, simulatedPremiumAccess]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
