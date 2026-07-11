import type { PostgrestError } from '@supabase/supabase-js';
import { Alarm } from '../constants/data';
import { DEFAULT_PERSONALIZED_MISSION } from '../constants/missions';
import { mapAlarmFromSupabase } from './alarmNavigation';
import { getDailyAlarm } from './dailyAlarm';
import { fetchDailyAlarmRow } from './dailyAlarmSupabase';
import { supabase } from './supabase';
import { withTimeout } from './withTimeout';

const TEMP_ALARM_ID_THRESHOLD = 1_000_000_000_000;
const DEFAULT_ALARM_SOUND = 'radar_classic';
const SAVE_TIMEOUT_MS = 8000;
const SAVE_ATTEMPTS = 3;

export function isPersistedAlarmId(id: number) {
  return Number.isFinite(id) && id > 0 && id < TEMP_ALARM_ID_THRESHOLD;
}

export type AlarmSavePayload = {
  user_id: string;
  time: string;
  ampm: 'AM' | 'PM';
  mission: string;
  label: string;
  sound: string;
  custom_mission: string | null;
  mission_mode: string;
  enabled_missions: string[];
  specific_date: string | null;
  enabled: boolean;
  last_triggered_date: string | null;
  last_completed_date: string | null;
  updated_at: string;
};

export function buildAlarmSavePayload(
  alarm: Alarm,
  userId: string,
  isDaily: boolean
): AlarmSavePayload {
  return {
    user_id: userId,
    time: alarm.time,
    ampm: alarm.ampm,
    mission: alarm.mission || DEFAULT_PERSONALIZED_MISSION,
    label: alarm.label || 'Wake up',
    sound: alarm.sound || DEFAULT_ALARM_SOUND,
    custom_mission: alarm.customMission || null,
    mission_mode: alarm.missionMode || 'personalized',
    enabled_missions: alarm.enabledMissions?.length ? alarm.enabledMissions : [],
    specific_date: isDaily ? null : (alarm.specificDate || null),
    enabled: alarm.on ?? true,
    last_triggered_date: alarm.lastTriggeredDate || null,
    last_completed_date: alarm.lastCompletedDate || null,
    updated_at: new Date().toISOString(),
  };
}

export async function resolveDailyAlarmForSave(
  userId: string,
  updated: Alarm,
  localAlarms: Alarm[],
  newAlarm: boolean
): Promise<{ alarm: Alarm; createNew: boolean }> {
  const fromNetwork = await withTimeout(fetchDailyAlarmRow(userId), 4000, null);
  const fromLocal = getDailyAlarm(localAlarms);
  const existingDaily = fromNetwork ?? fromLocal;

  if (existingDaily) {
    return {
      alarm: {
        ...updated,
        id: existingDaily.id,
        on: updated.on ?? existingDaily.on,
      },
      createNew: false,
    };
  }

  if (!newAlarm && isPersistedAlarmId(updated.id)) {
    return { alarm: updated, createNew: false };
  }

  return { alarm: updated, createNew: true };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableSaveError(error: PostgrestError | Error | null | undefined) {
  if (!error) return true;
  const message = `${'message' in error ? error.message : ''} ${'details' in error ? error.details ?? '' : ''}`.toLowerCase();
  return (
    ('code' in error && error.code === 'PGRST116') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('failed') ||
    message.includes('abort')
  );
}

type SaveQueryResult = { data: unknown; error: PostgrestError | null };

async function runSaveQuery(query: Promise<SaveQueryResult>): Promise<SaveQueryResult> {
  return withTimeout(query, SAVE_TIMEOUT_MS, {
    data: null,
    error: { message: 'Network request timed out', details: 'timeout' } as PostgrestError,
  });
}

export async function persistAlarmRecord(
  userId: string,
  alarm: Alarm,
  payload: AlarmSavePayload,
  createNew: boolean,
  options?: { isDaily?: boolean }
): Promise<Alarm> {
  let shouldCreate = createNew;
  let lastError: PostgrestError | Error | null = null;

  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await delay(400 * attempt);

    if (shouldCreate) {
      const { data, error } = await runSaveQuery(
        supabase.from('alarms').insert(payload).select().single()
      );
      if (!error && data) return mapAlarmFromSupabase(data);
      lastError = error;
      if (options?.isDaily) {
        const existing = await withTimeout(fetchDailyAlarmRow(userId), 4000, null);
        if (existing) {
          shouldCreate = false;
          alarm = { ...alarm, id: existing.id };
          continue;
        }
      }
    } else {
      const { data, error } = await runSaveQuery(
        supabase
          .from('alarms')
          .update(payload)
          .eq('id', alarm.id)
          .eq('user_id', userId)
          .select()
          .single()
      );
      if (!error && data) return mapAlarmFromSupabase(data);
      lastError = error;
      if (options?.isDaily && error?.code === 'PGRST116') {
        shouldCreate = true;
        continue;
      }
    }

    if (!isRetryableSaveError(lastError)) break;
  }

  const message =
    (lastError && 'message' in lastError && lastError.message) ||
    'No se pudo guardar la alarma';
  throw new Error(message);
}

export function formatSaveError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message ?? '');
  }
  return '';
}
