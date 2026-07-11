import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { supabase } from './supabase';
import {
  cancelAlarmSchedule,
  clearPendingAlarmLaunch,
  getAlarmRegistry,
} from './alarmScheduler';
import { requestAuthNavigationRefresh } from './authNavigationRefresh';
import { canConfigureRevenueCat } from './revenueCatEnvironment';
import { cancelTrialReminderNotification } from './trialReminder';

const premiumFlagKey = (userId: string) => `rooalarm.premium.${userId}`;
const SCHEDULED_ALARMS_KEY = 'rooalarm.scheduled_alarm_registry.v1';

async function detachRevenueCatUser() {
  if (!canConfigureRevenueCat()) return;
  try {
    const configured = await Purchases.isConfigured();
    if (configured) {
      await Purchases.logOut();
    }
  } catch (err) {
    console.warn('[RooAlarm] RevenueCat logOut on account delete failed', err);
  }
}

async function clearUserLocalState(userId: string) {
  const registry = await getAlarmRegistry();
  await Promise.all(
    Object.keys(registry).map((alarmId) => cancelAlarmSchedule(alarmId).catch(() => {}))
  );
  await clearPendingAlarmLaunch();
  await cancelTrialReminderNotification();
  await AsyncStorage.multiRemove([premiumFlagKey(userId), SCHEDULED_ALARMS_KEY]);
}

/** Elimina la cuenta en Supabase (auth + todos los datos) y limpia estado local. */
export async function deleteOwnAccount(userId: string) {
  await detachRevenueCatUser();
  await clearUserLocalState(userId);

  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;

  await supabase.auth.signOut();
  requestAuthNavigationRefresh();
}
