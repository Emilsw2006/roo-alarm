import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../constants/AuthContext';
import { useSubscription } from '../constants/SubscriptionContext';
import { setAuthNavigationRefreshListener } from '../lib/authNavigationRefresh';
import { hasUserProfileName, isOnboardingCompleteForUser } from '../lib/onboardingStatus';
import {
  AuthEntryRoute,
  OnboardingProfileStatus,
  ProfileNameStatus,
  resolveAuthEntryForSession,
  shouldEnterMainApp,
  resolveHasPremiumAccess,
} from '../lib/onboardingNavigation';

async function loadProfileChecks(userId: string) {
  const [complete, hasName, hasPremium] = await Promise.all([
    isOnboardingCompleteForUser(userId),
    hasUserProfileName(userId),
    resolveHasPremiumAccess(userId, false),
  ]);
  return {
    profileStatus: (complete ? 'complete' : 'incomplete') as OnboardingProfileStatus,
    profileNameStatus: (hasName ? 'complete' : 'incomplete') as ProfileNameStatus,
    hasPremium,
  };
}

export function useAuthNavigationState() {
  const { session, loading: authLoading } = useAuth();
  const { hasPremiumAccess, loading: subscriptionLoading } = useSubscription();
  const [profileStatus, setProfileStatus] = useState<OnboardingProfileStatus>('loading');
  const [profileNameStatus, setProfileNameStatus] = useState<ProfileNameStatus>('loading');
  const [authHasPremium, setAuthHasPremium] = useState<boolean>(false);

  const refreshProfileChecks = useCallback(async () => {
    if (!session?.user?.id) {
      setProfileStatus('incomplete');
      setProfileNameStatus('incomplete');
      return;
    }

    setProfileStatus('loading');
    setProfileNameStatus('loading');

    const result = await loadProfileChecks(session.user.id);
    setProfileStatus(result.profileStatus);
    setProfileNameStatus(result.profileNameStatus);
    setAuthHasPremium(result.hasPremium);
  }, [session?.user?.id]);

  useEffect(() => {
    void refreshProfileChecks();
  }, [refreshProfileChecks]);

  useEffect(() => {
    setAuthNavigationRefreshListener(() => {
      void refreshProfileChecks();
    });
    return () => setAuthNavigationRefreshListener(null);
  }, [refreshProfileChecks]);

  const effectivePremium = hasPremiumAccess || authHasPremium;

  const showMain = shouldEnterMainApp(
    !!session,
    profileStatus,
    profileNameStatus,
    effectivePremium
  );
  const loading =
    authLoading ||
    (!!session?.user?.id &&
      (profileStatus === 'loading' || profileNameStatus === 'loading' || subscriptionLoading));

  const { route: authInitialRoute, step: authInitialStep } = resolveAuthEntryForSession(
    !!session,
    profileStatus,
    profileNameStatus,
    effectivePremium
  );

  return {
    loading,
    session,
    hasPremiumAccess: effectivePremium,
    profileStatus,
    profileNameStatus,
    showMain,
    showAuth: !showMain,
    authInitialRoute: authInitialRoute as AuthEntryRoute,
    authInitialStep,
    refreshProfileChecks,
  };
}
