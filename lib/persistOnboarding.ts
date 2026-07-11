import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { scheduleAlarm, requestAlarmPermissions } from './alarmScheduler';
import { Alarm } from '../constants/data';
import {
  DEFAULT_ENABLED_MISSIONS,
  DEFAULT_PERSONALIZED_MISSION,
} from '../constants/missions';

export type OnboardingData = {
  wakeUpThought?: string;
  stayInBedReason?: string;
  usualWakeTime?: Date;
  snoozeHabit?: string;
  alarmCount?: string;
  singleAlarmConfidence?: string;
  wakeUpFeeling?: string;
  missionType?: string;
  selectedMissions?: string[];
  wakeUpDuration?: string;
  targetWakeTime?: Date;
  protectedDays?: number[];
  userName?: string;
  gender?: string;
};

const parseAlarmCount = (value?: string) => {
  if (!value) return null;
  const match = value.match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
};

const resolveDisplayName = (data: OnboardingData, user?: User | null) => {
  if (data.userName?.trim()) return data.userName.trim();
  const meta = user?.user_metadata;
  const fromMeta =
    (typeof meta?.name === 'string' && meta.name) ||
    (typeof meta?.full_name === 'string' && meta.full_name) ||
    (typeof meta?.given_name === 'string' && meta.given_name);
  return fromMeta || null;
};

export const targetWakeTimeToClock = (date: Date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return {
    time: `${hours}:${String(minutes).padStart(2, '0')}`,
    ampm,
  };
};

export const clockToTargetWakeTime = (time: string, ampm: 'AM' | 'PM') => {
  const [hStr, mStr] = time.split(':');
  let hour = Number(hStr);
  const minute = Number(mStr);
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  const date = new Date();
  date.setHours(Number.isFinite(hour) ? hour : 7, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date;
};

export const buildUserSettingsPayload = (data: OnboardingData, user?: User | null) => {
  const selectedMissions =
    data.selectedMissions && data.selectedMissions.length > 0
      ? data.selectedMissions
      : [DEFAULT_PERSONALIZED_MISSION];
  const missionMode = data.missionType === 'personalized' ? 'personalized' : 'roulette';
  const personalizedMission =
    missionMode === 'roulette'
      ? selectedMissions[0]
      : selectedMissions[0] || DEFAULT_PERSONALIZED_MISSION;

  return {
    name: resolveDisplayName(data, user),
    mission_mode: missionMode,
    enabled_missions:
      missionMode === 'roulette' ? selectedMissions : DEFAULT_ENABLED_MISSIONS,
    personalized_mission: personalizedMission,
    default_mission: personalizedMission,
    wake_up_thought: data.wakeUpThought ?? null,
    stay_in_bed_reason: data.stayInBedReason ?? null,
    usual_wake_time: data.usualWakeTime?.toISOString() ?? null,
    snooze_habit: data.snoozeHabit ?? null,
    alarm_count: parseAlarmCount(data.alarmCount),
    single_alarm_confidence: data.singleAlarmConfidence ?? null,
    wake_up_feeling: data.wakeUpFeeling ?? null,
    wake_up_duration: data.wakeUpDuration ?? null,
    target_wake_time: data.targetWakeTime?.toISOString() ?? null,
    protected_days: data.protectedDays ?? [0, 1, 2, 3, 4],
    updated_at: new Date().toISOString(),
  };
};

export const persistUserSettings = async (
  userId: string,
  data: OnboardingData,
  user?: User | null
) => {
  const payload = buildUserSettingsPayload(data, user);
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' });
  if (error) throw error;
};

const mapAlarmFromRow = (row: any): Alarm => ({
  id: Number(row.id),
  time: row.time,
  ampm: row.ampm,
  mission: row.mission,
  label: row.label,
  on: row.enabled,
  sound: row.sound || undefined,
  customMission: row.custom_mission || undefined,
  specificDate: row.specific_date || undefined,
  lastTriggeredDate: row.last_triggered_date || undefined,
  lastCompletedDate: row.last_completed_date || undefined,
});

export const ensureInitialDailyAlarm = async (
  userId: string,
  data: OnboardingData
): Promise<Alarm | null> => {
  const { data: existing, error: listError } = await supabase
    .from('alarms')
    .select('id')
    .eq('user_id', userId)
    .is('specific_date', null)
    .limit(1);

  if (listError) throw listError;
  if (existing && existing.length > 0) return null;

  const targetTime = data.targetWakeTime;
  if (!targetTime) return null;

  const selectedMissions =
    data.selectedMissions && data.selectedMissions.length > 0
      ? data.selectedMissions
      : [DEFAULT_PERSONALIZED_MISSION];
  const missionMode = data.missionType === 'personalized' ? 'personalized' : 'roulette';
  const mission =
    missionMode === 'roulette'
      ? selectedMissions[0]
      : selectedMissions[0] || DEFAULT_PERSONALIZED_MISSION;
  const { time, ampm } = targetWakeTimeToClock(targetTime);

  const { data: inserted, error } = await supabase
    .from('alarms')
    .insert({
      user_id: userId,
      time,
      ampm,
      mission,
      label: 'Wake up',
      enabled: true,
    })
    .select()
    .single();

  if (error) throw error;
  if (!inserted) return null;

  const alarm = mapAlarmFromRow(inserted);
  if (alarm.on) {
    await scheduleAlarm(alarm, { protectedDays: data.protectedDays });
  }
  return alarm;
};

export const applyOnboardingSetup = async (
  userId: string,
  data: OnboardingData,
  user?: User | null
) => {
  await persistUserSettings(userId, data, user);
  await requestAlarmPermissions();
  await ensureInitialDailyAlarm(userId, data);
};

export const hasOnboardingPlanData = (data: OnboardingData) => !!data.targetWakeTime;
