import { useEffect, useRef } from 'react';
import { useAuth } from '../constants/AuthContext';
import { useOnboarding } from '../constants/OnboardingContext';
import { useMainAppReady } from '../constants/MainAppReadyContext';
import { applyOnboardingSetup, hasOnboardingPlanData } from '../lib/persistOnboarding';
import { isOnboardingCompleteForUser } from '../lib/onboardingStatus';

/**
 * Persiste el plan del onboarding en Supabase mientras el usuario aún no está en Home.
 * No pisa una cuenta que ya tenga plan (p. ej. login “ya tengo cuenta” tras cuestionario guest).
 */
export function useOnboardingPersistence() {
  const { user } = useAuth();
  const { data } = useOnboarding();
  const mainReady = useMainAppReady();
  const lastPersistedKey = useRef<string | null>(null);

  useEffect(() => {
    if (mainReady || !user?.id || !hasOnboardingPlanData(data)) return;

    const wakeKey = data.targetWakeTime?.getTime() ?? 0;
    const missionsKey = (data.selectedMissions ?? []).join(',');
    const modeKey = data.missionType ?? 'roulette';
    const persistKey = `${user.id}:${wakeKey}:${data.protectedDays?.join(',') ?? ''}:${modeKey}:${missionsKey}`;
    if (lastPersistedKey.current === persistKey) return;

    lastPersistedKey.current = persistKey;

    void (async () => {
      try {
        const alreadyComplete = await isOnboardingCompleteForUser(user.id);
        if (alreadyComplete) {
          // Cuenta existente con plan: no sobrescribir con estado local del guest.
          return;
        }
        await applyOnboardingSetup(user.id, data, user);
      } catch (err) {
        console.log('Onboarding persistence failed', err);
        lastPersistedKey.current = null;
      }
    })();
  }, [
    mainReady,
    user,
    data,
    data.targetWakeTime,
    data.protectedDays,
    data.selectedMissions,
    data.missionType,
  ]);
}
