/**
 * Dispara alarmas en Android y como respaldo por notificación.
 * iOS 26+ AlarmKit: useAlarmKitLaunchNavigation abre la misión tras Desbloquear;
 * las notificaciones locales siguen activas como respaldo si AlarmKit falla.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRef } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Alarm } from '../constants/data';
import {
  getDailyAlarm,
  mapAlarmFromSupabase,
  navigateToAlarmUnlock,
  navigateToAlarmMission,
  shouldFireAlarmNow,
} from '../lib/alarmNavigation';
import { getAlarmCapability, usesAlarmKitCapability } from '../lib/alarmCapability';
import {
  cancelDismissRetrigger,
  consumePendingDismissRetrigger,
  retriggerManagedAlarm,
} from '../lib/alarmScheduler';
import { wasAlarmCompletedToday } from '../lib/finalizeAlarmSuccess';
import { markAlarmRetriggerPending } from '../lib/retriggerGuard';

const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

const normalizeProtectedDays = (days: unknown) => {
  if (!Array.isArray(days)) return ALL_WEEK_DAYS;
  const normalized = [...new Set(days
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : ALL_WEEK_DAYS;
};

let globalPendingAlarmId: number | null = null;
let globalPendingSimulation = false;

// Listener de notificaciones registrado UNA SOLA VEZ a nivel de módulo, fuera
// del hook, para que NUNCA se pierda un tap aunque React no haya montado nada.
let _globalListenerInstalled = false;
const _ensureGlobalListener = () => {
  if (_globalListenerInstalled) return;
  _globalListenerInstalled = true;
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    console.log('[RooAlarm] GLOBAL tap captured:', JSON.stringify(data));
    if (data?.source === 'simulation') {
      globalPendingSimulation = true;
      globalPendingAlarmId = null;
      return;
    }
    const alarmId = Number(data?.alarmId);
    if (Number.isFinite(alarmId) && alarmId > 0) {
      globalPendingAlarmId = alarmId;
      globalPendingSimulation = false;
    }
  });
};
_ensureGlobalListener();

export function useGlobalAlarmTrigger(
  navigationRef: NavigationContainerRef<any>,
  userId: string | null | undefined,
  enabled: boolean
) {
  const alarmsRef = useRef<Alarm[]>([]);
  const protectedDaysRef = useRef<number[]>(ALL_WEEK_DAYS);
  const firingRef = useRef(false);
  const lastMinuteKeyRef = useRef<string | null>(null);
  const alarmKitActiveRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      alarmKitActiveRef.current = false;
      return;
    }
    getAlarmCapability().then((info) => {
      alarmKitActiveRef.current = usesAlarmKitCapability(info);
    });
  }, [userId]);

  const refreshAlarmData = useCallback(async () => {
    if (!userId) {
      alarmsRef.current = [];
      return;
    }

    const [{ data: alarmRows }, { data: settings }] = await Promise.all([
      supabase.from('alarms').select('*').eq('user_id', userId).order('id', { ascending: true }),
      supabase.from('user_settings').select('protected_days').eq('user_id', userId).maybeSingle(),
    ]);

    alarmsRef.current = (alarmRows ?? []).map(mapAlarmFromSupabase);
    protectedDaysRef.current = normalizeProtectedDays(settings?.protected_days);
  }, [userId]);

  const markAlarmTriggered = useCallback(async (alarm: Alarm, todayStr: string) => {
    alarmsRef.current = alarmsRef.current.map((item) =>
      item.id === alarm.id ? { ...item, lastTriggeredDate: todayStr } : item
    );
    if (!userId) return;
    await supabase.from('alarms').update({ last_triggered_date: todayStr }).eq('id', alarm.id);
  }, [userId]);

  const openAlarmForRecord = useCallback(async (alarm: Alarm) => {
    if (firingRef.current) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (alarm.lastCompletedDate === todayStr || wasAlarmCompletedToday(alarm.id)) return;

    firingRef.current = true;
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const dailyAlarm = getDailyAlarm(alarmsRef.current);
      const isDaily = dailyAlarm ? alarm.id === dailyAlarm.id : false;

      await markAlarmTriggered(alarm, todayStr);

      if (Platform.OS === 'ios') {
        navigateToAlarmMission(navigationRef, { isDaily, alarm });
      } else {
        navigateToAlarmUnlock(navigationRef, { isDaily, alarm });
      }
    } finally {
      setTimeout(() => {
        firingRef.current = false;
      }, 1500);
    }
  }, [markAlarmTriggered, navigationRef]);

  const openAlarmById = useCallback(async (alarmId: number) => {
    if (!Number.isFinite(alarmId)) return;
    if (wasAlarmCompletedToday(alarmId)) return;
    let alarm = alarmsRef.current.find((item) => item.id === alarmId);
    if (!alarm && userId) {
      await refreshAlarmData();
      alarm = alarmsRef.current.find((item) => item.id === alarmId);
    }
    if (!alarm) return;
    const todayStr = new Date().toISOString().split('T')[0];
    if (alarm.lastCompletedDate === todayStr) return;
    await openAlarmForRecord(alarm);
  }, [openAlarmForRecord, refreshAlarmData, userId]);

  const openSimulation = useCallback(async () => {
    if (firingRef.current) return;
    firingRef.current = true;
    try {
      navigateToAlarmMission(navigationRef, { isDaily: false, fromAlarmKit: false });
    } finally {
      setTimeout(() => {
        firingRef.current = false;
      }, 1500);
    }
  }, [navigationRef]);

  const checkDueAlarms = useCallback(() => {
    if (!enabled || !userId) return;

    const now = new Date();
    const minuteKey = `${now.toISOString().slice(0, 16)}`;
    if (lastMinuteKeyRef.current !== minuteKey) {
      lastMinuteKeyRef.current = minuteKey;
    }

    const dailyAlarm = getDailyAlarm(alarmsRef.current);
    const due = alarmsRef.current.find((alarm) =>
      shouldFireAlarmNow(alarm, now, dailyAlarm, protectedDaysRef.current)
    );

    if (!due || firingRef.current) return;

    const todayStr = now.toISOString().split('T')[0];
    if (due.lastCompletedDate === todayStr || wasAlarmCompletedToday(due.id)) return;

    void openAlarmForRecord(due);
  }, [enabled, markAlarmTriggered, openAlarmForRecord, userId]);

  const flushSlideRetrigger = useCallback(async () => {
    if (Platform.OS !== 'ios' || !alarmKitActiveRef.current) return;
    const pendingId = await consumePendingDismissRetrigger();
    if (pendingId === null) return;
    if (wasAlarmCompletedToday(pendingId)) return;

    let alarm = alarmsRef.current.find((item) => item.id === pendingId);
    if (!alarm) {
      await refreshAlarmData();
      alarm = alarmsRef.current.find((item) => item.id === pendingId);
    }
    if (!alarm) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (alarm.lastCompletedDate === todayStr || wasAlarmCompletedToday(pendingId)) return;

    await cancelDismissRetrigger(pendingId);
    await markAlarmTriggered(alarm, todayStr);
    markAlarmRetriggerPending(pendingId);
    await retriggerManagedAlarm(alarm, { immediate: true });
  }, [markAlarmTriggered, refreshAlarmData]);


  useEffect(() => {
    if (!enabled || !userId) return;

    void (async () => {
      // 1. Primero intentamos obtener el tap de lanzamiento mediante la API
      //    oficial de Expo para cold-start (más fiable que el listener de módulo).
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const data = lastResponse.notification.request.content.data;
          const isRecent = Date.now() - lastResponse.notification.date < 60_000; // solo si es reciente (< 1 min)
          if (isRecent) {
            if (data?.source === 'simulation') {
              globalPendingSimulation = true;
              globalPendingAlarmId = null;
            } else {
              const alarmId = Number(data?.alarmId);
              if (Number.isFinite(alarmId) && alarmId > 0) {
                globalPendingAlarmId = alarmId;
                globalPendingSimulation = false;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[RooAlarm] getLastNotificationResponseAsync error', e);
      }

      await refreshAlarmData();
      await flushSlideRetrigger();

      // 2. Consumir tap pendiente (del listener global o del getLastNotificationResponseAsync)
      if (globalPendingSimulation) {
        globalPendingSimulation = false;
        console.log('[RooAlarm] Consuming pending simulation tap on mount');
        void openSimulation();
      } else if (globalPendingAlarmId !== null) {
        const pendingId = globalPendingAlarmId;
        globalPendingAlarmId = null;
        console.log('[RooAlarm] Consuming pending alarm tap on mount:', pendingId);
        void openAlarmById(pendingId);
      }
    })();

    const { subscribeToAlarmChanges } = require('../lib/alarmScheduler');
    const unsubscribeAlarms = subscribeToAlarmChanges(() => {
      console.log('[RooAlarm] Local alarm change detected in hook, refreshing data');
      void refreshAlarmData();
    });

    const refreshInterval = setInterval(() => {
      void refreshAlarmData();
    }, 30000);

    const tickInterval = setInterval(checkDueAlarms, 1000);

    const slideFlushInterval = setInterval(() => {
      void flushSlideRetrigger();
    }, 800);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshAlarmData().then(() => {
          checkDueAlarms();
          void flushSlideRetrigger();
        });
      }
    });

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.source === 'simulation') {
        void openSimulation();
        return;
      }
      const alarmId = Number(data?.alarmId);
      if (Number.isFinite(alarmId) && alarmId > 0) {
        void openAlarmById(alarmId);
      }
    });

    return () => {
      unsubscribeAlarms();
      clearInterval(refreshInterval);
      clearInterval(tickInterval);
      clearInterval(slideFlushInterval);
      appStateSub.remove();
      receivedSub.remove();
    };
  }, [checkDueAlarms, enabled, flushSlideRetrigger, openAlarmById, openSimulation, refreshAlarmData, userId]);
}
