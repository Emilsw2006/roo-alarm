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
import { getActiveRingingAlarm, startPersistentAlarm } from '../lib/alarmPersistentGuard';

const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

const normalizeProtectedDays = (days: unknown) => {
  if (!Array.isArray(days)) return ALL_WEEK_DAYS;
  const normalized = [...new Set(days
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : ALL_WEEK_DAYS;
};

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

      // Start audio immediately so user hears alarm as soon as they return to app,
      // even before AlarmMission screen mounts and calls startPersistentAlarm itself.
      void startPersistentAlarm(alarm);

      if (Platform.OS === 'ios') {
        navigateToAlarmMission(navigationRef, { isDaily, alarm });
      } else {
        navigateToAlarmUnlock(navigationRef, { isDaily, alarm });
      }

      void markAlarmTriggered(alarm, todayStr);
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

    // Eliminamos el early return en iOS. Si AlarmKit sonó y el usuario pulsó el
    // cuerpo de la notificación (sin ejecutar el Intent), o simplemente abrió la
    // app un poco después, tenemos que forzar la misión.
    // openAlarmForRecord en iOS navega directamente a AlarmMission.

    void openAlarmForRecord(due);
  }, [enabled, markAlarmTriggered, openAlarmForRecord, userId]);

  /**
   * Tras deslizar "Posponer", el intent nativo abre la app y deja un marcador. Aquí lo
   * leemos y volvemos a sonar la alarma COMPLETA (no notificación) con el camino fiable.
   */
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

    // Cancela el re-disparo nativo pendiente para no sonar dos veces.
    await cancelDismissRetrigger(pendingId);
    await markAlarmTriggered(alarm, todayStr);
    markAlarmRetriggerPending(pendingId);
    await openAlarmForRecord(alarm);
  }, [markAlarmTriggered, openAlarmForRecord, refreshAlarmData]);

  useEffect(() => {
    if (!enabled || !userId) return;

    // Arranque (incluye cold-start tras swipe-kill): si hay una alarma que estaba
    // sonando y su misión no se completó, forzamos la misión SIEMPRE. El listener
    // de AppState solo dispara al cambiar a 'active', pero en cold-start la app ya
    // está 'active', así que sin esto la restauración dependía del clock-match frágil.
    void (async () => {
      await refreshAlarmData();
      const activeRinging = await getActiveRingingAlarm();
      if (activeRinging) {
        await openAlarmForRecord(activeRinging);
        return;
      }
      await flushSlideRetrigger();
    })();

    const refreshInterval = setInterval(() => {
      void refreshAlarmData();
    }, 30000);

    const tickInterval = setInterval(checkDueAlarms, 1000);

    // Reintenta leer el marcador del deslizar por si el intent nativo lo escribe con retraso.
    const slideFlushInterval = setInterval(() => {
      void flushSlideRetrigger();
    }, 300);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void (async () => {
          const activeRinging = await getActiveRingingAlarm();
          if (activeRinging) {
            await openAlarmForRecord(activeRinging);
            return;
          }
          checkDueAlarms();
          void flushSlideRetrigger();
          void refreshAlarmData();
        })();
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

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
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
      clearInterval(refreshInterval);
      clearInterval(tickInterval);
      clearInterval(slideFlushInterval);
      appStateSub.remove();
      receivedSub.remove();
      responseSub.remove();
    };
  }, [checkDueAlarms, enabled, flushSlideRetrigger, openAlarmById, openAlarmForRecord, openSimulation, refreshAlarmData, userId]);
}
