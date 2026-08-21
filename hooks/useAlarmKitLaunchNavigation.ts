import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { tryOpenPendingAlarmFlow } from '../lib/alarmMissionLaunch';
import { capturePendingAlarmLaunch } from '../lib/alarmScheduler';

export function useAlarmKitLaunchNavigation(
  navigationRef: React.RefObject<NavigationContainerRef<any> | null>,
  enabled: boolean,
  userId?: string | null,
  mainReady = false
) {
  const handlingRef = useRef(false);

  const handleLaunch = useCallback(async () => {
    if (!enabled || Platform.OS !== 'ios' || handlingRef.current) return;

    const pendingId = await capturePendingAlarmLaunch();
    if (pendingId) console.log('[RooAlarm] launchNav: pending id captured', pendingId, 'mainReady=', mainReady);

    if (!mainReady) return;

    const navigation = navigationRef.current;
    if (!navigation?.isReady()) {
      if (pendingId) console.log('[RooAlarm] launchNav: navigation not ready yet, will retry');
      return;
    }

    handlingRef.current = true;
    try {
      const opened = await tryOpenPendingAlarmFlow(navigation, userId);
      if (pendingId) console.log('[RooAlarm] launchNav: tryOpenPendingAlarmFlow result=', opened);
    } finally {
      handlingRef.current = false;
    }
  }, [enabled, mainReady, navigationRef, userId]);

  useEffect(() => {
    void handleLaunch();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void handleLaunch();
      }
    });

    const retryInterval = setInterval(() => {
      void handleLaunch();
    }, 500);

    return () => {
      subscription.remove();
      clearInterval(retryInterval);
    };
  }, [handleLaunch]);
}
