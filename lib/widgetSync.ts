import { NativeModules, Platform } from 'react-native';
import { Alarm } from './types';

const { AlarmKitModule } = NativeModules;

export const syncWidgetStreak = async (streak: number) => {
  if (Platform.OS !== 'ios' || !AlarmKitModule?.syncWidgetStreak) {
    return;
  }
  try {
    await AlarmKitModule.syncWidgetStreak(streak);
  } catch (err) {
    console.warn('Failed to sync widget streak:', err);
  }
};

export const syncWidgetNextAlarm = async (alarms: Alarm[]) => {
  if (Platform.OS !== 'ios' || !AlarmKitModule?.syncWidgetNextAlarm) {
    return;
  }
  try {
    const activeAlarms = alarms.filter(a => a.on);
    let nextAlarm: Alarm | null = null;
    
    for (const al of activeAlarms) {
      if (al.isDaily) {
        nextAlarm = al;
        break;
      }
    }
    if (!nextAlarm && activeAlarms.length > 0) {
      nextAlarm = activeAlarms[0];
    }
    
    if (nextAlarm) {
      await AlarmKitModule.syncWidgetNextAlarm(nextAlarm.time, nextAlarm.label || nextAlarm.mission, nextAlarm.isDaily || false);
    } else {
      await AlarmKitModule.syncWidgetNextAlarm(null, null, false);
    }
  } catch (e) {
    console.log('Failed to refresh widget next alarm:', e);
  }
};
