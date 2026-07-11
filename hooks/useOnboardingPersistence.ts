import { useEffect, useRef } from 'react';
import { useAuth } from '../constants/AuthContext';
import { useOnboarding } from '../constants/OnboardingContext';
import { applyOnboardingSetup, hasOnboardingPlanData } from '../lib/persistOnboarding';

export function useOnboardingPersistence() {
  const { user } = useAuth();
  const { data } = useOnboarding();
  const persistedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !hasOnboardingPlanData(data)) return;
    if (persistedForUser.current === user.id) return;

    persistedForUser.current = user.id;
    applyOnboardingSetup(user.id, data, user).catch((err) => {
      console.log('Onboarding persistence failed', err);
      persistedForUser.current = null;
    });
  }, [user, data]);
}
