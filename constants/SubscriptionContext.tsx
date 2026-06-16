import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from './AuthContext';

type PlanKey = 'annual' | 'monthly';

interface SubscriptionContextType {
  loading: boolean;
  configured: boolean;
  hasPremiumAccess: boolean;
  annualPackage: PurchasesPackage | null;
  monthlyPackage: PurchasesPackage | null;
  error: string | null;
  refreshCustomerInfo: () => Promise<void>;
  purchasePlan: (plan: PlanKey) => Promise<{ success: boolean; error: string | null }>;
  restorePurchases: () => Promise<{ success: boolean; error: string | null }>;
}

const ENTITLEMENT_ID = 'premium';
const REVENUECAT_IOS_API_KEY = '';
const REVENUECAT_ANDROID_API_KEY = '';

const SubscriptionContext = createContext<SubscriptionContextType>({
  loading: true,
  configured: false,
  hasPremiumAccess: false,
  annualPackage: null,
  monthlyPackage: null,
  error: null,
  refreshCustomerInfo: async () => {},
  purchasePlan: async () => ({ success: false, error: null }),
  restorePurchases: async () => ({ success: false, error: null }),
});

function getApiKey() {
  if (Platform.OS === 'ios') return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === 'android') return REVENUECAT_ANDROID_API_KEY;
  return '';
}

function hasPremium(customerInfo: CustomerInfo | null) {
  return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
}

function findPackage(packages: PurchasesPackage[], plan: PlanKey) {
  const preferredType = plan === 'annual' ? 'ANNUAL' : 'MONTHLY';
  const preferredWord = plan === 'annual' ? 'annual' : 'monthly';
  return (
    packages.find(item => item.packageType === preferredType) ||
    packages.find(item => item.identifier.toLowerCase().includes(preferredWord)) ||
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

  const configureForUser = useCallback(async (userId: string) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setConfigured(false);
      setCustomerInfo(null);
      setPackages([]);
      setError('Falta configurar la API key de RevenueCat.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
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
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);

      setCustomerInfo(info);
      setPackages(offerings.current?.availablePackages ?? []);
      setConfigured(true);
    } catch (err: any) {
      setConfigured(false);
      setError(err?.message ?? 'No se pudo cargar la suscripción.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      configuredUserId.current = null;
      setConfigured(false);
      setCustomerInfo(null);
      setPackages([]);
      setError(null);
      setSimulatedPremiumAccess(false);
      setLoading(false);
      return;
    }

    configureForUser(user.id);
  }, [configureForUser, user?.id]);

  const refreshCustomerInfo = useCallback(async () => {
    if (!user?.id) return;
    await configureForUser(user.id);
  }, [configureForUser, user?.id]);

  const purchasePlan = useCallback(async (_plan: PlanKey) => {
    if (!user?.id) return { success: false, error: 'Inicia sesión para continuar.' };
    setError(null);
    setSimulatedPremiumAccess(true);
    return { success: true, error: null };
  }, [user?.id]);

  const restorePurchases = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'Inicia sesión para restaurar.' };
    if (!configured) return { success: false, error: error ?? 'RevenueCat no está configurado.' };

    try {
      setError(null);
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return { success: hasPremium(info), error: hasPremium(info) ? null : 'No encontramos una compra activa.' };
    } catch (err: any) {
      const message = err?.message ?? 'No se pudo restaurar la compra.';
      setError(message);
      return { success: false, error: message };
    }
  }, [configured, error, user?.id]);

  const value = useMemo(() => ({
    loading,
    configured,
    hasPremiumAccess: simulatedPremiumAccess || hasPremium(customerInfo),
    annualPackage: findPackage(packages, 'annual'),
    monthlyPackage: findPackage(packages, 'monthly'),
    error,
    refreshCustomerInfo,
    purchasePlan,
    restorePurchases,
  }), [configured, customerInfo, error, loading, packages, purchasePlan, refreshCustomerInfo, restorePurchases, simulatedPremiumAccess]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
