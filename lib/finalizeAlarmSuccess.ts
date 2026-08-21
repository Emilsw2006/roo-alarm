import { Alarm } from '../constants/data';
import { settleAlarmAfterCompletion } from './alarmScheduler';
import { getTodayDateStr } from './dailyAlarm';
import { clearAlarmRetriggerPending } from './retriggerGuard';
import { supabase } from './supabase';

const completedTodayIds = new Set<number>();

export function wasAlarmCompletedToday(alarmId: number) {
  return completedTodayIds.has(alarmId);
}

export function unmarkAlarmCompletedToday(alarmId: number) {
  completedTodayIds.delete(alarmId);
}

/** Cancela re-disparos y marca la alarma como completada hoy (no debe volver a sonar). */
export async function finalizeAlarmSuccess(alarm: Alarm | undefined, userId?: string | null) {
  if (!alarm?.id) return;

  completedTodayIds.add(alarm.id);
  clearAlarmRetriggerPending(alarm.id);
  await settleAlarmAfterCompletion(alarm.id);

  if (!userId) return;

  const todayStr = getTodayDateStr();
  await supabase
    .from('alarms')
    .update({
      last_completed_date: todayStr,
      last_triggered_date: todayStr,
    })
    .eq('id', alarm.id)
    .eq('user_id', userId);
}
