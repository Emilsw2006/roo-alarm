import { supabase } from './supabase';
import { hasOnboardingPlanData, OnboardingData } from './persistOnboarding';

export async function hasUserProfileName(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_settings')
    .select('name')
    .eq('user_id', userId)
    .maybeSingle();

  return !!(data?.name?.trim());
}

export async function isOnboardingCompleteForUser(userId: string): Promise<boolean> {
  const [{ data: settings }, { count }] = await Promise.all([
    supabase
      .from('user_settings')
      .select(
        'name, target_wake_time, wake_up_duration, personalized_mission, default_mission, wake_up_thought, stay_in_bed_reason, usual_wake_time, snooze_habit, alarm_count, single_alarm_confidence, wake_up_feeling'
      )
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('alarms')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  if ((count ?? 0) > 0) return true;
  if (!settings) return false;

  const hasPlan = !!(
    settings.target_wake_time ||
    settings.wake_up_duration ||
    settings.personalized_mission ||
    settings.default_mission
  );
  if (hasPlan) return true;

  const answeredQuestions = [
    settings.wake_up_thought,
    settings.stay_in_bed_reason,
    settings.usual_wake_time,
    settings.snooze_habit,
    settings.alarm_count,
    settings.single_alarm_confidence,
    settings.wake_up_feeling,
  ].filter(Boolean).length;

  if (answeredQuestions >= 3) return true;

  return !!(settings.name?.trim() && answeredQuestions >= 1);
}

export function isOnboardingCompleteInMemory(data: OnboardingData) {
  return hasOnboardingPlanData(data);
}

export function isInvalidLoginError(message: string) {
  return /invalid login credentials/i.test(message);
}
