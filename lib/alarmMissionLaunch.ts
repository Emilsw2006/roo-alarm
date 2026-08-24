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
  if (!navigationRef.isReady()) {
    console.log('[RooAlarm] openAlarmFlow: navigationRef not ready, pendingId=', pendingId);
    return false;
  }
  if (shouldBlockAlarmKitRelaunch(navigationRef)) {
    console.log(
      '[RooAlarm] openAlarmFlow: BLOCKED, currently on route',
      navigationRef.getCurrentRoute()?.name,
      'pendingId=',
      pendingId
    );
    void clearPendingAlarmLaunch();
    return false;
  }

  if (pendingId === 'simulation') {
    const opened = navigateToAlarmMission(navigationRef, { isDaily: false, fromAlarmKit: true });
    console.log('[RooAlarm] openAlarmFlow: simulation navigate result=', opened);
    if (opened) await clearPendingAlarmLaunch();
    return opened;
  }

  if (!userId) {
    console.log('[RooAlarm] openAlarmFlow: no userId, aborting for pendingId=', pendingId);
    return false;
  }

  const alarmId = Number(pendingId);
  if (!Number.isFinite(alarmId)) {
    console.log('[RooAlarm] openAlarmFlow: pendingId not a valid alarm id', pendingId);
    return false;
  }
  if (wasAlarmCompletedToday(alarmId)) {
    console.log('[RooAlarm] openAlarmFlow: alarm already completed today (in-memory), skipping', alarmId);
    await clearPendingAlarmLaunch();
    return false;
  }

  const { data: alarmRow, error: fetchError } = await supabase
    .from('alarms')
    .select('*')
    .eq('id', alarmId)
    .single();

  if (fetchError || !alarmRow) {
    console.log('[RooAlarm] openAlarmFlow: fetch alarm error or NOT FOUND', fetchError?.message, 'alarmId=', alarmId);
    return false;
  }

  const alarm = mapAlarmFromSupabase(alarmRow);
  const todayStr = new Date().toISOString().split('T')[0];
  if (alarm.lastCompletedDate === todayStr) {
    console.log('[RooAlarm] openAlarmFlow: alarm already completed today (db), skipping', alarmId);
    await clearPendingAlarmLaunch();
    return false;
  }
  const isDaily = !alarm.specificDate;

  void markAlarmTriggeredToday(alarm.id, userId);

  const opened = navigateToAlarmMission(navigationRef, { isDaily, alarm, fromAlarmKit: true });
  console.log('[RooAlarm] openAlarmFlow: navigateToAlarmMission result=', opened, 'alarmId=', alarmId, 'isDaily=', isDaily);
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
