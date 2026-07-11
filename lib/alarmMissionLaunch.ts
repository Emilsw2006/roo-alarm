import type { NavigationContainerRef } from '@react-navigation/native';
import { supabase } from './supabase';
import { mapAlarmFromSupabase, navigateToAlarmMission } from './alarmNavigation';
import { capturePendingAlarmLaunch, clearPendingAlarmLaunch } from './alarmScheduler';
import { wasAlarmCompletedToday } from './finalizeAlarmSuccess';
import { shouldBlockAlarmKitRelaunch } from './missionTimeout';

async function markAlarmTriggeredToday(alarmId: number, userId: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  await supabase.from('alarms').update({ last_triggered_date: todayStr }).eq('id', alarmId);
}

export async function openAlarmFlowFromPendingId(
  navigationRef: NavigationContainerRef<any>,
  pendingId: string,
  userId?: string | null
): Promise<boolean> {
  if (!navigationRef.isReady()) return false;
  if (shouldBlockAlarmKitRelaunch(navigationRef)) return false;

  if (pendingId === 'simulation') {
    const opened = navigateToAlarmMission(navigationRef, { isDaily: false, fromAlarmKit: true });
    if (opened) await clearPendingAlarmLaunch();
    return opened;
  }

  if (!userId) return false;

  const alarmId = Number(pendingId);
  if (!Number.isFinite(alarmId)) return false;
  if (wasAlarmCompletedToday(alarmId)) {
    await clearPendingAlarmLaunch();
    return false;
  }

  const { data: alarms } = await supabase
    .from('alarms')
    .select('*')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  const alarmRow = alarms?.find((row) => Number(row.id) === alarmId);
  if (!alarmRow) return false;

  const alarm = mapAlarmFromSupabase(alarmRow);
  const todayStr = new Date().toISOString().split('T')[0];
  if (alarm.lastCompletedDate === todayStr) {
    await clearPendingAlarmLaunch();
    return false;
  }
  const isDaily = !alarm.specificDate;

  await markAlarmTriggeredToday(alarm.id, userId);

  const opened = navigateToAlarmMission(navigationRef, { isDaily, alarm, fromAlarmKit: true });
  if (opened) await clearPendingAlarmLaunch();
  return opened;
}

/** @deprecated usa openAlarmFlowFromPendingId */
export const openAlarmMissionFromPendingId = openAlarmFlowFromPendingId;

export async function tryOpenPendingAlarmFlow(
  navigationRef: NavigationContainerRef<any>,
  userId?: string | null
): Promise<boolean> {
  const pendingId = await capturePendingAlarmLaunch();
  if (!pendingId) return false;
  return openAlarmFlowFromPendingId(navigationRef, pendingId, userId);
}

/** @deprecated usa tryOpenPendingAlarmFlow */
export const tryOpenPendingAlarmMission = tryOpenPendingAlarmFlow;
