import { Linking, Platform } from 'react-native';
import Purchases from 'react-native-purchases';

export async function openManageSubscriptions() {
  if (Platform.OS === 'ios') {
    try {
      const showManage = (Purchases as any).showManageSubscriptions;
      if (typeof showManage === 'function') {
        await showManage.call(Purchases);
        return;
      }
    } catch {
      // fallback below
    }
    await Linking.openURL('https://apps.apple.com/account/subscriptions');
    return;
  }

  if (Platform.OS === 'android') {
    await Linking.openURL('https://play.google.com/store/account/subscriptions');
  }
}
