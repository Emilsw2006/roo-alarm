import type { NavigationContainerRef } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { Platform } from 'react-native';
import { Alarm } from '../constants/data';
import { getDailyAlarm, isDailyAlarmRecord } from './dailyAlarm';

export { getDailyAlarm, isDailyAlarmRecord } from './dailyAlarm';

const ALARM_FLOW_SCREENS = new Set(['AlarmUnlock', 'AlarmMission', 'Camera', 'Success', 'Fail']);

export const mapAlarmFromSupabase = (row: any): Alarm => ({
  id: Number(row.id),
  time: row.time,
  ampm: row.ampm,
  mission: row.mission,
  label: row.label,
  on: row.enabled !== false,
  sound: row.sound || undefined,
  customMission: row.custom_mission || undefined,
  missionMode: row.mission_mode === 'roulette' ? 'roulette' : 'personalized',
  enabledMissions: Array.isArray(row.enabled_missions) ? row.enabled_missions : undefined,
  specificDate: row.specific_date || undefined,
  lastTriggeredDate: row.last_triggered_date || undefined,
  lastCompletedDate: row.last_completed_date || undefined,
});

export const getMondayDayIndex = (date: Date) => {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

const parseAlarmTime24 = (alarm: Alarm) => {
  const [hStr, mStr] = alarm.time.split(':');
  let hour = Number(hStr);
  const minute = Number(mStr);
  if (alarm.ampm === 'PM' && hour < 12) hour += 12;
  if (alarm.ampm === 'AM' && hour === 12) hour = 0;
  return {
    hour: Number.isFinite(hour) ? hour : 7,
    minute: Number.isFinite(minute) ? minute : 0,
  };
};

export const buildAlarmFireDate = (alarm: Alarm): Date | null => {
  const { hour, minute } = parseAlarmTime24(alarm);
  const base = alarm.specificDate ? new Date(alarm.specificDate) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const fire = new Date(base);
  fire.setHours(hour, minute, 0, 0);
  return fire;
};

const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

const normalizeProtectedDays = (days?: number[]) => {
  if (!Array.isArray(days)) return ALL_WEEK_DAYS;
  const normalized = [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
    (a, b) => a - b
  );
  return normalized.length > 0 ? normalized : ALL_WEEK_DAYS;
};

/** Next valid fire time for scheduling (rolls one-shot alarms forward if the slot already passed). */
export const resolveFireDateForScheduling = (alarm: Alarm): Date | null => {
  const fireAt = buildAlarmFireDate(alarm);
  if (!fireAt) return null;
  if (!alarm.specificDate) return fireAt;

  const now = new Date();
  if (fireAt > now) return fireAt;

  const next = new Date(now);
  next.setHours(fireAt.getHours(), fireAt.getMinutes(), 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

/** Next upcoming fire time for recurring or one-shot alarms. */
export const getNextAlarmFireDate = (alarm: Alarm, protectedDays?: number[]): Date | null => {
  if (!alarm.on) return null;
  if (alarm.specificDate) return resolveFireDateForScheduling(alarm);

  const { hour, minute } = parseAlarmTime24(alarm);
  const activeDays = normalizeProtectedDays(protectedDays);
  const now = new Date();

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    if (!activeDays.includes(getMondayDayIndex(candidate))) continue;
    if (candidate > now) return candidate;
  }

  return null;
};

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const isOtherAlarmScheduledForDay = (alarm: Alarm, day: Date) => {
  if (!alarm.specificDate) return false;
  const fire = buildAlarmFireDate(alarm);
  return fire ? isSameCalendarDay(fire, day) : false;
};

const getClockMatch = (alarm: Alarm, now: Date) => {
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentAmPm = currentHour >= 12 ? 'PM' : 'AM';
  let displayHour = currentHour % 12;
  if (displayHour === 0) displayHour = 12;
  const [aH, aM] = alarm.time.split(':').map(Number);
  return aH === displayHour && aM === currentMin && alarm.ampm === currentAmPm;
};

export const shouldFireAlarmNow = (
  alarm: Alarm,
  now: Date,
  dailyAlarm: Alarm | null,
  protectedDays: number[]
) => {
  if (!alarm.on) return false;

  const isDaily = dailyAlarm ? alarm.id === dailyAlarm.id : false;
  if (isDaily && !protectedDays.includes(getMondayDayIndex(now))) return false;
  if (!isDaily && alarm.specificDate && !isOtherAlarmScheduledForDay(alarm, now)) return false;

  const todayStr = now.toISOString().split('T')[0];
  if (alarm.lastCompletedDate === todayStr) return false;
  if (alarm.lastTriggeredDate === todayStr) return false;

  return getClockMatch(alarm, now);
};

export const isOnAlarmFlowScreen = (navigationRef: NavigationContainerRef<any>) => {
  if (!navigationRef.isReady()) return false;
  const routeName = navigationRef.getCurrentRoute()?.name;
  return !!routeName && ALARM_FLOW_SCREENS.has(routeName);
};

export type HomeRouteParams = {
  completedDaily?: boolean;
  failedDaily?: boolean;
  skipAlarmSync?: boolean;
};

export const resetToHome = (
  navigation: { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void },
  params?: HomeRouteParams,
) => {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'Home', params: params ?? undefined }],
    }),
  );
};

export const navigateToAlarmUnlock = (
  navigationRef: NavigationContainerRef<any>,
  params: { isDaily: boolean; alarm?: Alarm }
) => {
  if (!navigationRef.isReady()) return false;
  if (isOnAlarmFlowScreen(navigationRef)) return false;
  if (Platform.OS === 'ios') return false;
  navigationRef.navigate('AlarmUnlock', params);
  return true;
};

export const navigateToAlarmMission = (
  navigationRef: NavigationContainerRef<any>,
  params: { isDaily: boolean; alarm?: Alarm; fromAlarmKit?: boolean }
) => {
  if (!navigationRef.isReady()) return false;
  const routeName = navigationRef.getCurrentRoute()?.name;
  if (routeName === 'AlarmMission' || routeName === 'Camera') {
    console.log('[RooAlarm] navigateToAlarmMission: already on', routeName, '- skipping navigation');
    return false;
  }

  if (params.fromAlarmKit) {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'AlarmMission', params }],
      })
    );
    return true;
  }

  if (Platform.OS === 'ios') {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'AlarmMission', params }],
      })
    );
    return true;
  }

  navigationRef.navigate('AlarmMission', params);
  return true;
};
