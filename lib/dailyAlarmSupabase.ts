import { supabase } from './supabase';
import { Alarm } from '../constants/data';
import { mapAlarmFromSupabase } from './alarmNavigation';
import { scheduleAlarm, cancelAlarmSchedule } from './alarmScheduler';
import { getDailyAlarm, isDailyAlarmRecord } from './dailyAlarm';

export async function fetchDailyAlarmRow(userId: string): Promise<Alarm | null> {
  const { data, error } = await supabase
    .from('alarms')
    .select('*')
    .eq('user_id', userId)
    .is('specific_date', null)
    .order('id', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('[RooAlarm] fetchDailyAlarmRow failed', error);
    return null;
  }
  const row = data?.[0];
  return row ? mapAlarmFromSupabase(row) : null;
}

export async function purgeDuplicateDailyAlarms(userId: string, keepId: number) {
  const { data, error } = await supabase
    .from('alarms')
    .select('id')
    .eq('user_id', userId)
    .is('specific_date', null)
    .neq('id', keepId);

  if (error) throw error;
  if (!data?.length) return;

  for (const row of data) {
    await cancelAlarmSchedule(row.id);
  }

  const { error: deleteError } = await supabase
    .from('alarms')
    .delete()
    .eq('user_id', userId)
    .is('specific_date', null)
    .neq('id', keepId);

  if (deleteError) throw deleteError;
}

export async function fetchUserAlarms(userId: string): Promise<Alarm[]> {
  const { data, error } = await supabase
    .from('alarms')
    .select('*')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapAlarmFromSupabase);
}

export async function resetDailyCompletionToday(
  userId: string,
  protectedDays?: number[]
): Promise<Alarm | null> {
  const alarms = await fetchUserAlarms(userId);
  const daily = getDailyAlarm(alarms);
  if (!daily) return null;

  const { data, error } = await supabase
    .from('alarms')
    .update({
      last_triggered_date: null,
      last_completed_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', daily.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  if (!data) return null;

  const updated = mapAlarmFromSupabase(data);
  if (updated.on) {
    await scheduleAlarm(updated, { protectedDays });
  }
  return updated;
}

export async function markDailyCompletedToday(userId: string, alarmId: number) {
  const todayStr = new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('alarms')
    .update({
      last_completed_date: todayStr,
      last_triggered_date: todayStr,
      updated_at: new Date().toISOString(),
    })
    .eq('id', alarmId)
    .eq('user_id', userId)
    .is('specific_date', null);

  if (error) throw error;
}

export { isDailyAlarmRecord };
