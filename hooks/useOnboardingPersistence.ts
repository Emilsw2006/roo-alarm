import { useEffect, useRef } from 'react';
import { useAuth } from '../constants/AuthContext';
import { useOnboarding } from '../constants/OnboardingContext';
import { useMainAppReady } from '../constants/MainAppReadyContext';
import { applyOnboardingSetup, hasOnboardingPlanData } from '../lib/persistOnboarding';

export function useOnboardingPersistence() {
  const { user } = useAuth();
  const { data } = useOnboarding();
  const mainReady = useMainAppReady();
  const lastPersistedKey = useRef<string | null>(null);

  useEffect(() => {
    if (mainReady || !user?.id || !hasOnboardingPlanData(data)) return;

    const wakeKey = data.targetWakeTime?.getTime() ?? 0;
    const persistKey = `${user.id}:${wakeKey}:${data.protectedDays?.join(',') ?? ''}`;
    if (lastPersistedKey.current === persistKey) return;

    lastPersistedKey.current = persistKey;
    applyOnboardingSetup(user.id, data, user).catch((err) => {
      console.log('Onboarding persistence failed', err);
      lastPersistedKey.current = null;
    });
  }, [mainReady, user, data, data.targetWakeTime, data.protectedDays]);
}
