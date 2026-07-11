import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { capturePendingAlarmLaunch } from '../lib/alarmScheduler';

export function usePendingAlarmRoute() {
  const [pendingAlarm, setPendingAlarm] = useState(false);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    const pendingId = await capturePendingAlarmLaunch();
    setPendingAlarm(!!pendingId);
    setChecked(true);
    return !!pendingId;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await refresh();
      if (cancelled) return;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 120));
        const hasPending = await refresh();
        if (hasPending) return;
      }
    };

    void run();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [refresh]);

  return { pendingAlarm, pendingChecked: checked, refreshPendingAlarm: refresh };
}
