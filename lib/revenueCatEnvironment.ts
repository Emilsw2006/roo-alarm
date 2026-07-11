import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export function isExpoGo() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function getRevenueCatApiKey() {
  const testStoreKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY ?? '';
  if (isExpoGo()) {
    return testStoreKey;
  }
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';
  }
  return '';
}

export function canConfigureRevenueCat() {
  return (Platform.OS === 'ios' || Platform.OS === 'android') && !!getRevenueCatApiKey();
}
