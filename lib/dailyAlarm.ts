import { Alarm } from '../constants/data';

export const getTodayDateStr = (date = new Date()) => date.toISOString().split('T')[0];

export const isDailyAlarmRecord = (alarm: Alarm) => !alarm.specificDate;

export const getDailyAlarm = (alarms: Alarm[]) => {
  const dailies = alarms.filter(isDailyAlarmRecord);
  if (dailies.length === 0) return null;
  return dailies.reduce((latest, current) => (current.id > latest.id ? current : latest));
};

export const getOtherAlarms = (alarms: Alarm[]) => alarms.filter((alarm) => !!alarm.specificDate);

export const isDailyAlarmLockedToday = (alarm: Alarm | null | undefined) => {
  if (!alarm) return false;
  const today = getTodayDateStr();
  return alarm.lastTriggeredDate === today || alarm.lastCompletedDate === today;
};

export const toDateOnlyIso = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateOnlyIso = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatAlarmClockLabel = (alarm: Alarm) => `${alarm.time} ${alarm.ampm}`;
