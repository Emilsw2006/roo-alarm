import { NativeModules, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export type AlarmCapability = 'alarmkit' | 'legacy_notification' | 'unsupported';

export type AlarmCapabilityInfo = {
  capability: AlarmCapability;
  reason?: string;
  alarmKitAvailable?: boolean;
  alarmKitAuthorized?: boolean;
  notificationsGranted?: boolean;
};

type AlarmKitStatusLite = {
  available: boolean;
  authorized: boolean;
  authorization: string;
};

const alarmKitModule = NativeModules.AlarmKitModule as {
  getAlarmKitStatus?: () => Promise<AlarmKitStatusLite>;
} | undefined;

const hasAlarmKitModule = () => Platform.OS === 'ios' && !!alarmKitModule;

async function readAlarmKitStatus(): Promise<AlarmKitStatusLite> {
  if (!hasAlarmKitModule() || !alarmKitModule?.getAlarmKitStatus) {
    return { available: false, authorized: false, authorization: 'unsupported' };
  }
  try {
    return await alarmKitModule.getAlarmKitStatus();
  } catch {
    return { available: false, authorized: false, authorization: 'unsupported' };
  }
}

export async function getAlarmCapability(): Promise<AlarmCapabilityInfo> {
  if (Platform.OS === 'android') {
    const permissions = await Notifications.getPermissionsAsync();
    const granted = permissions.granted;
    return {
      capability: granted ? 'legacy_notification' : 'unsupported',
      reason: granted ? undefined : 'notifications_denied',
      notificationsGranted: granted,
    };
  }

  if (Platform.OS !== 'ios') {
    return { capability: 'unsupported', reason: 'not_mobile' };
  }

  if (!hasAlarmKitModule()) {
    return { capability: 'unsupported', reason: 'no_native_module' };
  }

  const status = await readAlarmKitStatus();
  if (status.available) {
    return {
      capability: 'alarmkit',
      alarmKitAvailable: true,
      alarmKitAuthorized: status.authorized,
      reason: status.authorized ? undefined : `alarmkit_${status.authorization}`,
    };
  }

  const permissions = await Notifications.getPermissionsAsync();
  const granted = permissions.granted;
  return {
    capability: 'legacy_notification',
    reason: granted ? 'ios_legacy' : 'notifications_denied',
    alarmKitAvailable: false,
    notificationsGranted: granted,
  };
}

export function usesLegacyNotificationCapability(info: AlarmCapabilityInfo) {
  return info.capability === 'legacy_notification';
}

export function usesAlarmKitCapability(info: AlarmCapabilityInfo) {
  return info.capability === 'alarmkit';
}
