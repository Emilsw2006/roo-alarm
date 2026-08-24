import type { NavigationContainerRef } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { Alarm } from '../constants/data';
import { retriggerManagedAlarm } from './alarmScheduler';
import { resetToHome } from './alarmNavigation';
import { markAlarmRetriggerPending } from './retriggerGuard';
import { supabase } from './supabase';
import { trackEvent } from './analytics';

const MISSION_ACTIVE_ROUTES = new Set(['AlarmMission', 'Camera', 'Success', 'Fail']);

let missionTimeoutInFlight = false;

export async function clearAlarmTriggeredToday(alarmId: number, userId?: string | null) {
  if (!userId) return;
  await supabase.from('alarms').update({ last_triggered_date: null }).eq('id', alarmId);
}

export function shouldOfferRescueOnTimeout(isDaily: boolean, rescueTokens: number) {
  return isDaily && rescueTokens > 0;
}

/** Programa de inmediato otra alarma completa (timeout de 60s o repetir tras rescate). */
export async function scheduleMissionTimeoutRetrigger(
  alarm: Alarm | undefined,
  userId?: string | null,
): Promise<boolean> {
  if (!alarm?.id) return false;
  await clearAlarmTriggeredToday(alarm.id, userId);
  markAlarmRetriggerPending(alarm.id);
  return retriggerManagedAlarm(alarm, { immediate: true });
}

/**
 * Al llegar a 0s: vuelve a sonar la alarma. Si hay token de rescate, devuelve 'rescue'
 * para mostrar el prompt sin ir a Home (la alarma ya está programada).
 */
export async function onMissionTimerExpired(
  params: { isDaily: boolean; alarm?: Alarm },
  userId?: string | null,
  rescueTokens = 0,
): Promise<'rescue' | 'done'> {
  if (params.alarm?.id) {
    trackEvent('alarm_mission_timeout', {
      alarmId: params.alarm.id,
      missionType: params.alarm.mission,
      isDaily: params.isDaily,
      hasRescueTokens: rescueTokens > 0,
      rescueTokensAvailable: rescueTokens,
    });
  }

  // Si hay tokens de rescate, NO retriggerar todavía: el usuario decide primero.
  // Si rechaza el token, finishMissionTimeout se encarga de retriggerar.
  if (shouldOfferRescueOnTimeout(params.isDaily, rescueTokens)) {
    return 'rescue';
  }

  await scheduleMissionTimeoutRetrigger(params.alarm, userId);
  return 'done';
}

export async function finishMissionTimeout(
  navigation: {
    replace: (name: string, params?: object) => void;
    dispatch?: (action: ReturnType<typeof CommonActions.reset>) => void;
  },
  params: { isDaily: boolean; alarm?: Alarm },
  userId?: string | null,
  options?: { skipRetrigger?: boolean },
) {
  if (missionTimeoutInFlight) return;
  missionTimeoutInFlight = true;

  try {
    const { alarm } = params;
    if (alarm?.id && !options?.skipRetrigger) {
      await scheduleMissionTimeoutRetrigger(alarm, userId);
    }

    if (typeof navigation.dispatch === 'function') {
      resetToHome(navigation as { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void }, {
        skipAlarmSync: true,
      });
    } else {
      navigation.replace('Home', { skipAlarmSync: true });
    }
  } finally {
    setTimeout(() => {
      missionTimeoutInFlight = false;
    }, 2000);
  }
}

/** @deprecated usa finishMissionTimeout o el flujo con token */
export async function handleMissionTimeout(
  navigation: {
    replace: (name: string, params?: object) => void;
    dispatch?: (action: ReturnType<typeof CommonActions.reset>) => void;
  },
  params: { isDaily: boolean; alarm?: Alarm },
  userId?: string | null,
) {
  await finishMissionTimeout(navigation, params, userId);
}

export function shouldBlockAlarmKitRelaunch(navigationRef: NavigationContainerRef<any>) {
  if (!navigationRef.isReady()) return true;
  const routeName = navigationRef.getCurrentRoute()?.name;
  return !!routeName && MISSION_ACTIVE_ROUTES.has(routeName);
}
