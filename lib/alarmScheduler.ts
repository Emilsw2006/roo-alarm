import { Linking, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Alarm } from '../constants/data';
import { getNextAlarmFireDate } from './alarmNavigation';
import { isDailyAlarmRecord } from './dailyAlarm';
import { fetchUserAlarms } from './dailyAlarmSupabase';
import { getAlarmCapability } from './alarmCapability';
import { shouldSkipAlarmSyncForRetrigger } from './retriggerGuard';
import { supabase } from './supabase';

const STORAGE_KEY = 'rooalarm.scheduled_alarm_registry.v1';
const PENDING_LAUNCH_KEY = 'rooalarm.pending_alarm_launch.v1';
const RETRIGGER_DELAY_SECONDS = 10;
const CHANNEL_ID = 'rooalarm-main';
const DEFAULT_SOUND_ID = 'default';
const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

type ScheduledRegistryEntry = {
  usesAlarmKit?: boolean;
  notificationId?: string;
  notificationIds?: string[];
};
type ScheduledRegistry = Record<string, ScheduledRegistryEntry>;

export type AlarmKitStatus = {
  available: boolean;
  authorized: boolean;
  authorization: 'authorized' | 'denied' | 'notDetermined' | 'unsupported';
  reason?: string;
};

type AlarmKitNativeModule = {
  getAlarmKitStatus?: () => Promise<AlarmKitStatus>;
  requestAuthorization: () => Promise<'authorized' | 'denied' | 'notDetermined' | 'unsupported' | string>;
  scheduleAlarm: (
    alarmId: string,
    hour: number,
    minute: number,
    title: string,
    soundId: string,
    weekdays: number[]
  ) => Promise<boolean>;
  scheduleAlarmAt?: (
    alarmId: string,
    fireAtMs: number,
    title: string,
    soundId: string
  ) => Promise<boolean | { ok: boolean; error?: string }>;
  cancelAlarm: (alarmId: string) => Promise<boolean>;
  retriggerAlarm?: (alarmId: string, title: string) => Promise<boolean>;
  cancelDismissRetrigger?: (alarmId: string) => Promise<boolean>;
  clearPendingAlarmLaunch?: () => Promise<boolean>;
  consumePendingDismissRetrigger?: () => Promise<string | null>;
  triggerSimulationNow: (title: string, body: string, soundId: string, alarmId: string) => Promise<boolean>;
  consumePendingAlarmLaunch?: () => Promise<string | null>;
};

const alarmKitModule: AlarmKitNativeModule | undefined = NativeModules.AlarmKitModule;

let notificationsConfigured = false;
const alarmKitManagedIds = new Set<string>();

// AlarmKit no tolera llamadas `schedule`/`cancel` concurrentes: dos operaciones
// simultáneas sobre la misma alarma provocan un fallo transitorio
// (Error Domain=com.apple.AlarmKit.Alarm Code=0) que deja la alarma sin programar.
// Serializamos TODAS las operaciones nativas de AlarmKit en una única cola para que
// nunca se solapen (la app las lanza desde varios flujos al arrancar).
let nativeAlarmKitQueue: Promise<unknown> = Promise.resolve();
const serializeAlarmKit = <T>(op: () => Promise<T>): Promise<T> => {
  const run = nativeAlarmKitQueue.then(op, op);
  // Mantener viva la cadena aunque una operación falle.
  nativeAlarmKitQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

export type ScheduleAlarmOptions = {
  protectedDays?: number[];
  simulationSoundId?: string;
};

export type ScheduleAlarmResult =
  | { ok: true; mode: 'alarmkit' | 'notification' }
  | { ok: true; mode: 'alarmkit_mocked'; reason: 'simulator_or_unsupported' }
  | { ok: true; mode: 'alarmkit_permission_denied' }
  | { ok: false; reason: string };

export const usesAlarmKitOnPlatform = () => Platform.OS === 'ios';

export const prefersAlarmKitScheduling = async (): Promise<boolean> => {
  const capability = await getAlarmCapability();
  return capability.capability === 'alarmkit' && !!capability.alarmKitAuthorized;
};

const canUseAlarmKit = () => Platform.OS === 'ios' && !!alarmKitModule;

const resolveSoundId = (_alarm: Alarm) => DEFAULT_SOUND_ID;

const normalizeProtectedDays = (days?: number[]) => {
  if (!Array.isArray(days)) return ALL_WEEK_DAYS;
  const normalized = [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
    (a, b) => a - b
  );
  return normalized.length > 0 ? normalized : ALL_WEEK_DAYS;
};

const resolveScheduleDays = (alarm: Alarm, protectedDays: number[]) => {
  if (isDailyAlarmRecord(alarm)) {
    return normalizeProtectedDays(protectedDays);
  }
  return ALL_WEEK_DAYS;
};

const syncAlarmKitManagedIds = async () => {
  const registry = await loadRegistry();
  alarmKitManagedIds.clear();
  Object.entries(registry).forEach(([id, entry]) => {
    if (entry.usesAlarmKit) alarmKitManagedIds.add(id);
  });
};

export const isAlarmKitManaged = (alarmId: number | string) => {
  if (usesAlarmKitOnPlatform()) return alarmKitManagedIds.has(String(alarmId));
  return false;
};

export const getAlarmKitStatus = async (): Promise<AlarmKitStatus> => {
  if (!canUseAlarmKit() || !alarmKitModule?.getAlarmKitStatus) {
    return {
      available: false,
      authorized: false,
      authorization: 'unsupported',
      reason: Platform.OS !== 'ios' ? 'not_ios' : 'no_module',
    };
  }
  try {
    return await alarmKitModule.getAlarmKitStatus();
  } catch {
    return {
      available: false,
      authorized: false,
      authorization: 'unsupported',
      reason: 'status_error',
    };
  }
};

export const ensureAlarmKitAuthorized = async (): Promise<
  'authorized' | 'denied' | 'notDetermined' | 'unsupported'
> => {
  if (!canUseAlarmKit()) return 'unsupported';
  try {
    const status = await getAlarmKitStatus();
    if (!status.available) return 'unsupported';
    if (status.authorized) return 'authorized';
    const auth = await alarmKitModule!.requestAuthorization();
    if (auth === 'authorized' || auth === 'denied' || auth === 'notDetermined') return auth;
    return 'unsupported';
  } catch {
    return 'unsupported';
  }
};

export const ensureNotificationPermissions = async () => {
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return !!requested.granted;
};

export async function requestAlarmPermissions() {
  try {
    const capability = await getAlarmCapability();
    if (capability.capability === 'alarmkit') {
      if (!capability.alarmKitAuthorized) {
        await ensureAlarmKitAuthorized();
      }
      await ensureNotificationPermissions();
      return getAlarmCapability();
    }
    if (Platform.OS !== 'web') {
      await ensureNotificationPermissions();
      return getAlarmCapability();
    }
    return capability;
  } catch (err) {
    console.warn('[RooAlarm] requestAlarmPermissions failed', err);
    return getAlarmCapability();
  }
}

export const openAlarmKitSettings = () => {
  Linking.openSettings().catch(() => {});
};

const readNativePendingAlarmLaunch = async (): Promise<string | null> => {
  if (Platform.OS !== 'ios' || !alarmKitModule?.consumePendingAlarmLaunch) return null;
  const pendingId = await alarmKitModule.consumePendingAlarmLaunch();
  if (!pendingId || pendingId === 'null' || pendingId === 'undefined') return null;
  return String(pendingId);
};

export const capturePendingAlarmLaunch = async (): Promise<string | null> => {
  const cached = await AsyncStorage.getItem(PENDING_LAUNCH_KEY);
  if (cached) return cached;

  const fromNative = await readNativePendingAlarmLaunch();
  if (!fromNative) return null;

  await AsyncStorage.setItem(PENDING_LAUNCH_KEY, fromNative);
  return fromNative;
};

export const clearPendingAlarmLaunch = async () => {
  await AsyncStorage.removeItem(PENDING_LAUNCH_KEY);
  if (canUseAlarmKit()) {
    try {
      await alarmKitModule?.clearPendingAlarmLaunch?.();
    } catch (err) {
      console.warn('[RooAlarm] clearPendingAlarmLaunch native error', err);
    }
  }
};

export const consumePendingAlarmLaunch = capturePendingAlarmLaunch;

export const getAlarmRegistry = async (): Promise<ScheduledRegistry> => loadRegistry();

export const isAlarmScheduled = async (alarmId: number | string) => {
  const registry = await loadRegistry();
  return !!registry[String(alarmId)];
};

const getNotificationIdsForEntry = (entry?: ScheduledRegistryEntry) => {
  if (!entry) return [];
  if (entry.notificationIds?.length) return entry.notificationIds;
  if (entry.notificationId) return [entry.notificationId];
  return [];
};

const loadRegistry = async (): Promise<ScheduledRegistry> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ScheduledRegistry;
  } catch {
    return {};
  }
};

const saveRegistry = async (registry: ScheduledRegistry) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
};

export const getCurrentAlarmClockDisplay = () => {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return {
    time: `${hours}:${String(minutes).padStart(2, '0')}`,
    ampm,
  };
};

const cancelNotificationFallbackForAlarm = async (alarmId: number | string) => {
  const key = String(alarmId);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => String(notification.content.data?.alarmId) === key)
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier).catch(() => {})
      )
  );
};

const scheduleNotificationMode = async (
  alarm: Alarm,
  protectedDays: number[],
  registry: ScheduledRegistry,
  key: string
): Promise<ScheduleAlarmResult> => {
  const permissionGranted = await ensureNotificationPermissions();
  if (!permissionGranted) {
    return { ok: false, reason: 'notifications_denied' };
  }
  const notificationIds = await scheduleLocalNotification(alarm, protectedDays);
  if (notificationIds.length === 0) {
    return { ok: false, reason: 'notification_schedule_failed' };
  }
  registry[key] = { notificationIds, usesAlarmKit: false };
  alarmKitManagedIds.delete(key);
  await saveRegistry(registry);
  return { ok: true, mode: 'notification' };
};

export const configureAlarmNotifications = async () => {
  if (notificationsConfigured) return;
  notificationsConfigured = true;
  await syncAlarmKitManagedIds();

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      const isAlarm = !!data?.alarmId || data?.source === 'rooalarm' || data?.source === 'simulation';
      if (isAlarm) {
        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      }
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Roo Alarm',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
};

const scheduleLocalNotification = async (alarm: Alarm, protectedDays: number[]): Promise<string[]> => {
  const nextFire = getNextAlarmFireDate(alarm, protectedDays);
  if (!nextFire) return [];

  const title = alarm.label || 'Roo Alarm';
  const body = `Es la hora de tu alarma (${alarm.time} ${alarm.ampm})`;

  const content: Notifications.NotificationContentInput = {
    title,
    body,
    sound: 'default',
    data: { alarmId: alarm.id, source: 'rooalarm' },
    ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
  };

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextFire,
    },
  });
  return id ? [id] : [];
};

const scheduleWithAlarmKit = async (alarm: Alarm, protectedDays: number[]): Promise<boolean> => {
  if (!canUseAlarmKit() || !alarmKitModule) {
    console.warn('[RooAlarm] scheduleWithAlarmKit: no module or not iOS');
    return false;
  }

  const status = await getAlarmKitStatus();
  if (!status.available) {
    console.warn('[RooAlarm] scheduleWithAlarmKit: AlarmKit not available (iOS < 26 or Simulator)');
    return false;
  }
  if (!status.authorized) {
    console.warn('[RooAlarm] scheduleWithAlarmKit: AlarmKit not authorized, state=', status.authorization);
    return false;
  }

  const key = String(alarm.id);
  const title = alarm.label || 'Roo Alarm';
  const soundId = resolveSoundId(alarm);
  let nextFire = getNextAlarmFireDate(alarm, protectedDays);

  if (!nextFire) {
    console.warn('[RooAlarm] scheduleWithAlarmKit: no nextFire date for alarm', key, 'days=', protectedDays);
    return false;
  }

  // AlarmKit rejects dates that are too close to the current moment.
  // Ensure at least 30 seconds in the future.
  const minFire = new Date(Date.now() + 30_000);
  if (nextFire < minFire) {
    console.warn('[RooAlarm] scheduleWithAlarmKit: nextFire too close, bumping to +30s for alarm', key);
    nextFire = minFire;
  }

  if (typeof alarmKitModule.scheduleAlarmAt !== 'function') {
    console.warn('[RooAlarm] scheduleWithAlarmKit: scheduleAlarmAt not a function');
    return false;
  }

  const scheduleAtMs = nextFire.getTime();
  const attempt = async (): Promise<{ ok: boolean; error: string | null }> =>
    serializeAlarmKit(async () => {
      const res = await alarmKitModule!.scheduleAlarmAt!(key, scheduleAtMs, title, soundId);
      const ok = typeof res === 'boolean' ? res : !!res?.ok;
      const error = typeof res === 'object' ? res?.error ?? null : null;
      return { ok, error };
    });

  try {
    let { ok, error } = await attempt();
    // AlarmKit devuelve un Code=0 transitorio si otra operación tocó la misma alarma
    // justo antes. Como ya está serializado, un único reintento basta para superarlo.
    if (!ok) {
      console.warn(
        `[RooAlarm] scheduleWithAlarmKit: native scheduleAlarmAt FAILED for alarm ${key} (attempt 1). Error: ${
          error ?? 'unknown'
        }. Retrying…`
      );
      ({ ok, error } = await attempt());
    }

    if (!ok) {
      console.warn(
        `[RooAlarm] scheduleWithAlarmKit: native scheduleAlarmAt FAILED for alarm ${key} (after retry). Error: ${
          error ?? 'unknown'
        }`
      );
    } else {
      console.log('[RooAlarm] scheduleWithAlarmKit: SUCCESS alarm', key, 'at', nextFire.toISOString());
    }
    return ok;
  } catch (err) {
    console.warn('[RooAlarm] AlarmKit schedule error', err);
    return false;
  }
};

export const cancelAlarmSchedule = async (alarmId: number | string) => {
  const key = String(alarmId);
  const registry = await loadRegistry();
  const previous = registry[key];

  if (canUseAlarmKit()) {
    try {
      await serializeAlarmKit(() => alarmKitModule!.cancelAlarm(key));
    } catch (err) {
      console.warn('[RooAlarm] AlarmKit cancel error', err);
    }
  }

  const previousNotificationIds = getNotificationIdsForEntry(previous);
  await Promise.all(
    previousNotificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
  await cancelNotificationFallbackForAlarm(alarmId);

  delete registry[key];
  alarmKitManagedIds.delete(key);
  await saveRegistry(registry);
};

export const scheduleAlarm = async (
  alarm: Alarm,
  options?: ScheduleAlarmOptions
): Promise<ScheduleAlarmResult> => {
  await configureAlarmNotifications();
  await requestAlarmPermissions();

  try {
    await cancelAlarmSchedule(alarm.id);
  } catch (cancelError) {
    console.warn('[RooAlarm] cancel before schedule failed', alarm.id, cancelError);
  }

  if (!alarm.on) {
    return { ok: false, reason: 'alarm_disabled' };
  }

  const registry = await loadRegistry();
  const key = String(alarm.id);
  const scheduleDays = resolveScheduleDays(alarm, options?.protectedDays ?? ALL_WEEK_DAYS);
  const capability = await getAlarmCapability();

  let usesAlarmKit = false;
  let notificationIds: string[] = [];
  let alarmKitAuthResult: string = 'unsupported';

  if (Platform.OS === 'ios' && capability.capability === 'alarmkit') {
    const auth = await ensureAlarmKitAuthorized();
    alarmKitAuthResult = auth;
    if (auth === 'authorized') {
      usesAlarmKit = await scheduleWithAlarmKit(alarm, scheduleDays);
    }
    if (!usesAlarmKit) {
      console.warn('[RooAlarm] AlarmKit schedule failed for alarm', key, 'auth=', auth);
    }
  }

  const permissionGranted = await ensureNotificationPermissions();
  if (!usesAlarmKit && Platform.OS !== 'ios') {
    if (permissionGranted) {
      notificationIds = await scheduleLocalNotification(alarm, scheduleDays);
      if (notificationIds.length === 0) {
        console.warn('[RooAlarm] No local notifications scheduled for alarm', key);
      }
    } else {
      console.warn('[RooAlarm] Notification permission denied while scheduling alarm', key);
      return { ok: false, reason: 'notifications_denied' };
    }
  }

  if (Platform.OS === 'ios' && !usesAlarmKit) {
    console.warn('[RooAlarm] AlarmKit failed to schedule natively. Scheduling a local notification as a safety fallback.');
    if (permissionGranted) {
      notificationIds = await scheduleLocalNotification(alarm, scheduleDays);
      if (notificationIds.length === 0) {
        console.warn('[RooAlarm] No local notifications scheduled for fallback on iOS', key);
      }
    } else {
      console.warn('[RooAlarm] Notification permission denied for safety fallback on iOS', key);
    }

    registry[key] = { 
      usesAlarmKit: false,
      ...(notificationIds.length > 0 ? { notificationIds } : {}),
    };
    alarmKitManagedIds.delete(key);
    await saveRegistry(registry);

    if (alarmKitAuthResult === 'denied') {
      console.warn('[RooAlarm] AlarmKit permission denied by user for alarm', key);
      return { ok: true, mode: 'alarmkit_permission_denied' };
    }
    if (alarmKitAuthResult === 'authorized') {
      // Real device failure: AlarmKit was authorized but the native schedule was
      // rejected. Do NOT pretend this is a simulator — the exact native error was
      // already logged by scheduleWithAlarmKit. We fell back to a time-sensitive
      // notification, so report the honest mode.
      console.error(
        '[RooAlarm] AlarmKit was AUTHORIZED but scheduleAlarmAt failed for alarm',
        key,
        '- check the native scheduleAlarmAt error above. Using notification fallback.'
      );
      return { ok: true, mode: 'notification' };
    }
    return { ok: true, mode: 'alarmkit_mocked', reason: 'simulator_or_unsupported' };
  }

  if (Platform.OS !== 'ios' && !usesAlarmKit && notificationIds.length === 0) {
    return { ok: false, reason: 'notification_schedule_failed' };
  }

  registry[key] = {
    usesAlarmKit,
    ...(notificationIds.length > 0 ? { notificationIds } : {}),
  };
  if (usesAlarmKit) alarmKitManagedIds.add(key);
  else alarmKitManagedIds.delete(key);
  await saveRegistry(registry);

  const mode = usesAlarmKit ? 'alarmkit' : 'notification';
  const nextFire = getNextAlarmFireDate(alarm, scheduleDays);
  console.log(
    `[RooAlarm] Scheduled alarm ${key} mode=${mode} next=${nextFire?.toISOString() ?? 'none'} notifications=${notificationIds.length}`
  );
  return { ok: true, mode };
};

export async function syncAlarmSchedules(
  alarms: Alarm[],
  protectedDays: number[],
  options?: { force?: boolean }
) {
  const registry = await getAlarmRegistry();
  const results: ScheduleAlarmResult[] = [];

  for (const alarm of alarms) {
    if (!alarm.on) {
      if (registry[String(alarm.id)]) {
        await cancelAlarmSchedule(alarm.id);
      }
      continue;
    }
    if (shouldSkipAlarmSyncForRetrigger(alarm.id)) {
      continue;
    }
    if (!options?.force && registry[String(alarm.id)]) {
      continue;
    }
    const result = await scheduleAlarm(alarm, { protectedDays });
    results.push(result);
  }

  return results;
}

/** Clears local schedule registry and reprograms every enabled alarm (dev / recovery). */
export async function repairAlarmSchedules(
  alarms: Alarm[],
  protectedDays: number[],
): Promise<ScheduleAlarmResult[]> {
  const registry = await loadRegistry();
  await Promise.all(
    Object.keys(registry).map((id) => cancelAlarmSchedule(id)),
  );
  return syncAlarmSchedules(alarms, protectedDays, { force: true });
}

/** Reprograms all enabled alarms from Supabase (e.g. when app returns to foreground). */
export async function refreshUserAlarmSchedules(userId: string) {
  const [alarms, settingsResult] = await Promise.all([
    fetchUserAlarms(userId),
    supabase.from('user_settings').select('protected_days').eq('user_id', userId).maybeSingle(),
  ]);
  const protectedDays = normalizeProtectedDays(
    Array.isArray(settingsResult.data?.protected_days) ? settingsResult.data.protected_days : undefined
  );
  await requestAlarmPermissions();
  return syncAlarmSchedules(alarms, protectedDays, { force: true });
}

export type SimulationResult =
  | { mode: 'alarmkit' }
  | { mode: 'notification' }
  | { mode: 'failed'; reason: string };

export const cancelScheduledNotificationsForAlarm = async (alarmId: number | string) => {
  await cancelNotificationFallbackForAlarm(alarmId);
};

/** Cancela re-disparos pendientes y notificaciones tras completar la misión con éxito. */
export const settleAlarmAfterCompletion = async (alarmId: number | string): Promise<void> => {
  if (Platform.OS === 'ios') {
    await Notifications.dismissAllNotificationsAsync();
  } else {
    await Notifications.dismissAllNotificationsAsync();
  }
  await cancelAlarmSchedule(alarmId);
  await cancelDismissRetrigger(alarmId);
  await cancelScheduledNotificationsForAlarm(alarmId);
  await clearPendingAlarmLaunch();
};

export const cancelDismissRetrigger = async (alarmId: number | string): Promise<void> => {
  if (!canUseAlarmKit()) return;
  try {
    await alarmKitModule?.cancelDismissRetrigger?.(String(alarmId));
  } catch (err) {
    console.warn('[RooAlarm] cancelDismissRetrigger error', err);
  }
};

/** Lee (y borra) el re-disparo pendiente que dejó el deslizar nativo. Devuelve el id de alarma. */
export const consumePendingDismissRetrigger = async (): Promise<number | null> => {
  if (Platform.OS !== 'ios' || !alarmKitModule?.consumePendingDismissRetrigger) return null;
  try {
    const raw = await alarmKitModule.consumePendingDismissRetrigger();
    if (!raw || raw === 'null' || raw === 'undefined' || raw === 'simulation') return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch (err) {
    console.warn('[RooAlarm] consumePendingDismissRetrigger error', err);
    return null;
  }
};

export const retriggerManagedAlarm = async (
  alarm: Alarm,
  options?: { immediate?: boolean },
): Promise<boolean> => {
  const capability = await getAlarmCapability();
  if (!alarm?.id) return false;
  const title = alarm.label || 'Roo Alarm';
  const soundId = resolveSoundId(alarm);
  const delaySeconds = options?.immediate ? 1 : RETRIGGER_DELAY_SECONDS;

  if (capability.capability === 'alarmkit' && canUseAlarmKit()) {
    try {
      const auth = await ensureAlarmKitAuthorized();
      if (auth !== 'authorized') {
        console.warn('[RooAlarm] retrigger: AlarmKit not authorized', auth);
        return retriggerWithNotificationFallback(alarm, delaySeconds);
      }

      if (options?.immediate) {
        const simOk = await serializeAlarmKit(() =>
          alarmKitModule!.triggerSimulationNow(
            title,
            'Completa tu misión para parar la alarma',
            soundId,
            String(alarm.id),
          )
        );
        if (simOk) return true;
        console.warn('[RooAlarm] triggerSimulationNow failed for mission timeout', alarm.id);
      } else {
        const nativeRetrigger = alarmKitModule?.retriggerAlarm;
        if (typeof nativeRetrigger === 'function') {
          const ok = await serializeAlarmKit(() => nativeRetrigger(String(alarm.id), title));
          if (ok) return true;
          console.warn('[RooAlarm] retriggerAlarm returned false for alarm', alarm.id);
        }
      }

      const simOk = await serializeAlarmKit(() =>
        alarmKitModule!.triggerSimulationNow(
          title,
          'Completa tu misión para parar la alarma',
          soundId,
          String(alarm.id),
        )
      );
      if (simOk) return true;
      console.warn('[RooAlarm] triggerSimulationNow fallback failed for alarm', alarm.id);
    } catch (err) {
      console.warn('[RooAlarm] retrigger AlarmKit error', err);
    }
    return retriggerWithNotificationFallback(alarm, delaySeconds);
  }

  if (capability.capability === 'legacy_notification' && Platform.OS !== 'ios') {
    return retriggerWithNotificationFallback(alarm, delaySeconds);
  }

  return false;
};

const retriggerWithNotificationFallback = async (
  alarm: Alarm,
  delaySeconds = RETRIGGER_DELAY_SECONDS,
): Promise<boolean> => {
  try {
    const permissionGranted = await ensureNotificationPermissions();
    if (!permissionGranted) {
      console.warn('[RooAlarm] retrigger notification fallback: permission denied');
      return false;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: alarm.label || 'Roo Alarm',
        body: 'Completa tu misión para parar la alarma',
        sound: 'default',
        data: { alarmId: alarm.id, source: 'rooalarm-retrigger' },
        ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
      },
    });
    return true;
  } catch (err) {
    console.warn('[RooAlarm] retrigger notification fallback error', err);
    return false;
  }
};

export const triggerSimulationNow = async (soundId?: string): Promise<SimulationResult> => {
  await configureAlarmNotifications();
  const capability = await getAlarmCapability();

  if (capability.capability === 'alarmkit' && alarmKitModule) {
    const auth = await ensureAlarmKitAuthorized();
    if (auth === 'denied') {
      return { mode: 'failed', reason: 'denied' };
    }
    if (auth !== 'authorized') {
      return { mode: 'failed', reason: 'not_authorized' };
    }

    try {
      const resolvedSound = soundId || DEFAULT_SOUND_ID;
      const sent = await serializeAlarmKit(() =>
        alarmKitModule.triggerSimulationNow(
          'Roo Alarm',
          'Simulación de alarma',
          resolvedSound,
          '',
        )
      );
      if (sent) return { mode: 'alarmkit' };
    } catch {
      return { mode: 'failed', reason: 'schedule_error' };
    }

    return { mode: 'failed', reason: 'alarmkit_simulation_failed' };
  }
  if (capability.capability === 'legacy_notification' || Platform.OS === 'android') {
    if (Platform.OS === 'ios') {
      return { mode: 'failed', reason: 'alarmkit_simulation_failed' };
    }

    const permissionGranted = await ensureNotificationPermissions();
    if (!permissionGranted) {
      return { mode: 'failed', reason: 'notifications_denied' };
    }

    try {
      const resolvedSound = soundId || DEFAULT_SOUND_ID;
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Roo Alarm',
          body: 'Simulación de alarma',
          sound: `${resolvedSound}.wav`,
          data: {
            alarmId: 'simulation',
            isSimulation: true,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
        },
      });
      return { mode: 'notification' };
    } catch {
      return { mode: 'failed', reason: 'schedule_error' };
    }
  }

  if (!alarmKitModule && Platform.OS === 'ios') {
    return { mode: 'failed', reason: 'no_module' };
  }

  return { mode: 'failed', reason: capability.reason ?? 'unsupported' };
};
