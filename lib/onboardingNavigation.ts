import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHART_STEP,
  FIRST_ONBOARDING_STEP,
  PAYWALL_START_STEP,
  POST_PAY_PROFILE_STEP,
} from '../screens/onboarding/OnboardingSteps';
import { hasUserProfileName, isOnboardingCompleteForUser } from './onboardingStatus';
import { fetchSubscriptionFromSupabase } from './subscriptionSupabase';

const premiumFlagKey = (userId: string) => `rooalarm.premium.${userId}`;

export async function resolveHasPremiumAccess(userId: string, cached: boolean): Promise<boolean> {
  if (cached) return true;

  try {
    const local = await AsyncStorage.getItem(premiumFlagKey(userId));
    if (local === '1') return true;

    const db = await fetchSubscriptionFromSupabase(userId);
    return !!db?.is_subscribed;
  } catch {
    return false;
  }
}

export type AuthEntryRoute = 'Login' | 'Onboarding';

export type OnboardingProfileStatus = 'loading' | 'complete' | 'incomplete';
export type ProfileNameStatus = 'loading' | 'complete' | 'incomplete';

export function shouldEnterMainApp(
  hasSession: boolean,
  profileStatus: OnboardingProfileStatus,
  profileNameStatus: ProfileNameStatus,
  hasPremiumAccess: boolean
): boolean {
  return hasSession;
}

export type PostAuthOptions = {
  hasPremium: boolean;
  resumePaywall?: boolean;
  fromOnboarding?: boolean;
  existingAccount?: boolean;
};

export async function resolvePostAuthDestination(
  userId: string,
  options: PostAuthOptions
): Promise<number | 'main'> {
  const { hasPremium } = options;
  const hasPremiumAccess = await resolveHasPremiumAccess(userId, hasPremium);

  if (hasPremiumAccess) {
    return 'main';
  }

  return FIRST_ONBOARDING_STEP;
}

export function resolveAuthEntryForSession(
  hasSession: boolean,
  profileStatus: OnboardingProfileStatus,
  profileNameStatus: ProfileNameStatus,
  hasPremiumAccess: boolean
): { route: AuthEntryRoute; step: number } {
  if (!hasSession) {
    return { route: 'Login', step: 1 };
  }

  if (hasPremiumAccess) {
    return { route: 'Onboarding', step: FIRST_ONBOARDING_STEP };
  }

  return { route: 'Onboarding', step: FIRST_ONBOARDING_STEP };
}

export { PAYWALL_START_STEP };
