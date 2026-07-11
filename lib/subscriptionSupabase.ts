import { CustomerInfo } from 'react-native-purchases';
import { SUBSCRIPTION_ENTITLEMENT_ID } from '../constants/subscriptionProducts';
import { annualTrialEndDate } from './subscriptionPricing';
import { supabase } from './supabase';

export type DbSubscription = {
  is_subscribed: boolean;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  subscribed_at: string | null;
};

export type SubscriptionSyncPayload = {
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
  subscribedAt?: string | null;
};

const ENTITLEMENT_ID = SUBSCRIPTION_ENTITLEMENT_ID;

function inferPlanKey(productId: string | null | undefined): string {
  const id = (productId || '').toLowerCase();
  if (id.includes('annual') || id.includes('year')) return 'annual';
  if (id.includes('week')) return 'weekly';
  return 'unknown';
}

export function buildDevSubscriptionPayload(plan: 'annual' | 'weekly' | 'unknown' = 'unknown'): SubscriptionSyncPayload {
  const isAnnualTrial = plan === 'annual';
  return {
    isSubscribed: true,
    subscriptionPlan: plan,
    subscriptionStatus: isAnnualTrial ? 'trial' : 'active',
    subscriptionExpiresAt: isAnnualTrial ? annualTrialEndDate().toISOString() : null,
    subscribedAt: new Date().toISOString(),
  };
}

export function buildSubscriptionSyncPayload(
  customerInfo: CustomerInfo | null,
  fallbackPlan?: 'annual' | 'weekly'
): SubscriptionSyncPayload {
  const entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  if (!entitlement) {
    return {
      isSubscribed: false,
      subscriptionPlan: null,
      subscriptionStatus: 'expired',
      subscriptionExpiresAt: null,
    };
  }

  const productId = entitlement.productIdentifier ?? null;
  const plan = productId ? inferPlanKey(productId) : fallbackPlan ?? 'unknown';
  const isTrial = entitlement.periodType === 'TRIAL';
  const willRenew = entitlement.willRenew ?? false;
  let status = 'active';
  if (isTrial) status = 'trial';
  else if (!willRenew) status = 'cancelled';

  return {
    isSubscribed: true,
    subscriptionPlan: plan,
    subscriptionStatus: status,
    subscriptionExpiresAt: entitlement.expirationDate ?? null,
    subscribedAt: new Date().toISOString(),
  };
}

export async function fetchSubscriptionFromSupabase(userId: string): Promise<DbSubscription | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('is_subscribed, subscription_plan, subscription_status, subscription_expires_at, subscribed_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function syncSubscriptionToSupabase(
  userId: string,
  payload: SubscriptionSyncPayload
): Promise<void> {
  const update: Record<string, unknown> = {
    is_subscribed: payload.isSubscribed,
    subscription_plan: payload.subscriptionPlan,
    subscription_status: payload.subscriptionStatus,
    subscription_expires_at: payload.subscriptionExpiresAt,
  };

  if (payload.isSubscribed && payload.subscribedAt) {
    const { data: existing } = await supabase
      .from('user_settings')
      .select('subscribed_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing?.subscribed_at) {
      update.subscribed_at = payload.subscribedAt;
    }
  }

  if (!payload.isSubscribed) {
    update.subscribed_at = null;
  }

  const { error } = await supabase
    .from('user_settings')
    .update(update)
    .eq('user_id', userId);

  if (error) throw error;
}
