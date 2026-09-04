import { AppState, AppStateStatus, Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync } from 'expo-audio';
import { createRooAudioPlayer, RooAudioPlayer, stopRooAudioPlayer } from './audioPlayer';
import { SOUND_ASSETS } from '../constants/sounds';
import { Alarm } from '../constants/data';
import { navigationRef } from '../App';
import { navigateToAlarmMission } from './alarmNavigation';
import { retriggerManagedAlarm } from './alarmScheduler';

const ACTIVE_RINGING_ALARM_KEY = 'rooalarm.active_ringing_alarm';

let activePlayer: RooAudioPlayer | null = null;
let isAlarmRinging = false;
let appStateSubscription: { remove: () => void } | null = null;
let currentAlarm: Alarm | null = null;

export async function saveActiveRingingAlarm(alarm: Alarm) {
  try {
    if (!alarm?.id) return;
    const payload = JSON.stringify({
      alarm,
      timestamp: Date.now(),
    });
    await AsyncStorage.setItem(ACTIVE_RINGING_ALARM_KEY, payload);
  } catch (err) {
    console.log('[RooAlarm] saveActiveRingingAlarm error', err);
  }
}

export async function clearActiveRingingAlarm() {
  try {
    await AsyncStorage.removeItem(ACTIVE_RINGING_ALARM_KEY);
  } catch (err) {
    console.log('[RooAlarm] clearActiveRingingAlarm error', err);
  }
}

export async function getActiveRingingAlarm(): Promise<Alarm | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_RINGING_ALARM_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.alarm?.id) return null;

    const ageMs = Date.now() - (data.timestamp || 0);
    if (ageMs > 60 * 60 * 1000) {
      await clearActiveRingingAlarm();
      return null;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (data.alarm.lastCompletedDate === todayStr) {
      await clearActiveRingingAlarm();
      return null;
    }

    return data.alarm as Alarm;
  } catch (err) {
    return null;
  }
}

function handleAppStateChange(nextState: AppStateStatus) {
  if (nextState === 'background' || nextState === 'inactive') {
    if (!isAlarmRinging) return;
    if (activePlayer) {
      try {
        activePlayer.volume = 1.0;
        activePlayer.play();
      } catch (e) {
        console.log('[RooAlarm] Audio resume error in background', e);
      }
    }
    if (currentAlarm?.id) {
      void retriggerManagedAlarm(currentAlarm, { immediate: false });
    }
  } else if (nextState === 'active') {
    void (async () => {
      let alarmToRestore = currentAlarm;
      if (!alarmToRestore) {
        alarmToRestore = await getActiveRingingAlarm();
      }

      if (alarmToRestore) {
        currentAlarm = alarmToRestore;
        isAlarmRinging = true;

        if (!activePlayer) {
          void startPersistentAlarm(alarmToRestore);
        } else {
          try {
            activePlayer.volume = 1.0;
            activePlayer.play();
          } catch (e) {
            console.log('[RooAlarm] Audio resume error in foreground', e);
          }
        }

        if (navigationRef.isReady()) {
          const routeName = navigationRef.getCurrentRoute()?.name;
          const alreadyOnMission = routeName === 'AlarmMission' || routeName === 'Camera';
          if (!alreadyOnMission) {
            try {
              navigateToAlarmMission(navigationRef, { isDaily: false, alarm: alarmToRestore });
            } catch (navErr) {
              console.log('[RooAlarm] Navigation restore error', navErr);
            }
          }
        }
      }
    })();
  }
}

export async function startPersistentAlarm(alarm?: Alarm | null) {
  if (alarm) {
    currentAlarm = alarm;
    void saveActiveRingingAlarm(alarm);
  }

  if (isAlarmRinging && activePlayer) {
    try {
      activePlayer.volume = 1.0;
      activePlayer.play();
    } catch (_) {}
    return;
  }

  isAlarmRinging = true;
  currentAlarm = alarm || null;

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    });

    const soundMatch = SOUND_ASSETS.find((s) => s.id === alarm?.sound) || SOUND_ASSETS[0];
    const soundFile = soundMatch?.file || require('../assets/sounds/radar_classic.mp3');

    activePlayer = createRooAudioPlayer(soundFile, { loop: true, volume: 1.0 });
    activePlayer.volume = 1.0;
    activePlayer.play();

    Vibration.vibrate([1000, 1000, 1000], true);

    if (appStateSubscription) {
      appStateSubscription.remove();
    }
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  } catch (error) {
    console.log('[RooAlarm] startPersistentAlarm error', error);
  }
}

/**
 * Detiene el audio/vibración de la alarma.
 *
 * Por defecto borra también la referencia de la alarma activa (memoria + disco),
 * lo que solo debe ocurrir cuando la misión se completa con éxito
 * (finalizeAlarmSuccess).
 *
 * Cuando se silencia temporalmente (al pulsar DESBLOCAR para hacer la foto, o al
 * abandonar la misión sabiendo que se va a re-disparar en 60s) hay que pasar
 * `{ preserveActiveAlarm: true }`: así, si la alarma vuelve a sonar, la app puede
 * restaurar la misión desde cero en lugar de caer al Home sin saber qué alarma era.
 */
export function stopPersistentAlarm(options?: { preserveActiveAlarm?: boolean }) {
  isAlarmRinging = false;

  try {
    Vibration.cancel();
  } catch (_) {}

  if (activePlayer) {
    stopRooAudioPlayer(activePlayer);
    activePlayer = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (options?.preserveActiveAlarm) {
    // Silencio temporal: conservamos currentAlarm y el registro en disco para
    // poder volver a la misión si la alarma se re-dispara.
    return;
  }

  currentAlarm = null;
  void clearActiveRingingAlarm();
}

export function isPersistentAlarmActive(): boolean {
  return isAlarmRinging;
}
