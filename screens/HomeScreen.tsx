import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, useWindowDimensions, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { useAuth } from '../constants/AuthContext';
import { supabase } from '../lib/supabase';
import { Alarm } from '../constants/data';
import { DEFAULT_ENABLED_MISSIONS, DEFAULT_PERSONALIZED_MISSION, getMission, MissionMode, normalizeMissionId } from '../constants/missions';
import { FONT_FAMILY } from '../constants/theme';
import { cancelAlarmSchedule, scheduleAlarm, syncAlarmSchedules, requestAlarmPermissions } from '../lib/alarmScheduler';
import { MISSION_RETRIGGER_GUARD_MS } from '../lib/retriggerGuard';
import { ensureInitialDailyAlarm, clockToTargetWakeTime } from '../lib/persistOnboarding';
import { markDailyCompletedToday, fetchDailyAlarmRow, purgeDuplicateDailyAlarms } from '../lib/dailyAlarmSupabase';
import { tryOpenPendingAlarmFlow } from '../lib/alarmMissionLaunch';
import { navigationRef } from '../App';
import {
  getDailyAlarm,
  getOtherAlarms,
  isDailyAlarmLockedToday,
  toDateOnlyIso,
  formatAlarmClockLabel,
} from '../lib/dailyAlarm';
import { getHomeLayoutMetrics } from '../lib/homeLayout';
import {
  buildAlarmSavePayload,
  formatSaveError,
  persistAlarmRecord,
  resolveDailyAlarmForSave,
} from '../lib/saveAlarm';

import WeeklyStreak from '../components/WeeklyStreak';
import EvolutionCharacter from '../components/EvolutionCharacter';
import AlarmWidgets from '../components/AlarmWidgets';
import StreakModal from '../components/StreakModal';
import EditSheet from '../components/EditSheet';
import OtherAlarmsSheet from '../components/OtherAlarmsSheet';
import EvolutionTimelineSheet from '../components/EvolutionTimelineSheet';
import RescueModal from '../components/RescueModal';
import Icon from '../components/Icon';
import ParticleExplosion from '../components/ParticleExplosion';
import * as Haptics from 'expo-haptics';
import { AnimationState } from '../constants/RooAssets';

interface HomeScreenProps {
  navigation: any;
  route: any;
}

const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];
const getMondayDayIndex = (date: Date) => {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

const colorWithOpacity = (color: string, opacity: number) => {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }

  const rgbaMatch = color.match(/^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${opacity})`;
  }

  const rgbMatch = color.match(/^rgb\(([^,]+),([^,]+),([^,]+)\)$/);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${opacity})`;
  }

  return color;
};

const mapAlarmFromSupabase = (row: any): Alarm => ({
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

const USER_SETTINGS_SELECT = 'name, protected_days, mission_mode, enabled_missions, personalized_mission, default_mission, target_wake_time, default_sound';
const DEFAULT_ALARM_SOUND = 'radar_classic';

const normalizeProtectedDays = (days: unknown, fallback: number[]) => {
  if (!Array.isArray(days)) return fallback;
  const normalized = [...new Set(days
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : fallback;
};

export default function HomeScreen({ navigation, route }: HomeScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const layout = getHomeLayoutMetrics(screenWidth, screenHeight);
  const insets = useSafeAreaInsets();
  const { colors, streak, setStreak, weeklyHistory, currentDayIndex, rescueTokens, showRescueModal, setShowRescueModal, useRescueToken, acceptPunishment } = useColors();
  const { t, fullWeekdays, missionCopy } = useLanguage();
  const { user } = useAuth();
  
  const [profileName, setProfileName] = useState('');
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [streakVisible, setStreakVisible] = useState(false);
  const [editAlarm, setEditAlarm] = useState<Alarm | null>(null);
  const [newAlarm, setNewAlarm] = useState(false);
  const [isDailyEdit, setIsDailyEdit] = useState(false);
  const [otherAlarmsVisible, setOtherAlarmsVisible] = useState(false);
  const [evolutionSheetVisible, setEvolutionSheetVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [animateDayIndex, setAnimateDayIndex] = useState<number | null>(null);
  const [animateToStreak, setAnimateToStreak] = useState<number | null>(null);
  const [isSuccessSequence, setIsSuccessSequence] = useState(false);
  const [visualStreak, setVisualStreak] = useState(streak);
  const [nextVisualStreak, setNextVisualStreak] = useState<number | null>(null);
  const [frozenWeeklyHistory, setFrozenWeeklyHistory] = useState<boolean[] | null>(null);
  const [showParticles, setShowParticles] = useState(false);
  const [rooState, setRooState] = useState<AnimationState>('idle');
  const [protectedDays, setProtectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [missionMode, setMissionMode] = useState<MissionMode>('roulette');
  const [enabledMissions, setEnabledMissions] = useState<string[]>(DEFAULT_ENABLED_MISSIONS);
  const [personalizedMission, setPersonalizedMission] = useState(DEFAULT_PERSONALIZED_MISSION);
  const protectedDaysRef = useRef(protectedDays);

  useEffect(() => {
    protectedDaysRef.current = protectedDays;
  }, [protectedDays]);

  const ensureDailyAlarmScheduled = useCallback(async (alarmList: Alarm[]) => {
    const daily = getDailyAlarm(alarmList);
    if (!daily?.on) return;

    await requestAlarmPermissions();

    try {
      const result = await scheduleAlarm(daily, { protectedDays: protectedDaysRef.current });
      if (!result.ok) {
        console.warn('[RooAlarm] ensureDailyAlarmScheduled failed', daily.id, result.reason);
      }
    } catch (scheduleError) {
      console.warn('[RooAlarm] ensureDailyAlarmScheduled error', scheduleError);
    }
  }, []);

  const fetchAlarms = useCallback(async (): Promise<Alarm[]> => {
    const { data, error } = await supabase
      .from('alarms')
      .select('*')
      .eq('user_id', user!.id)
      .order('id', { ascending: true });

    if (data && data.length > 0) {
      const mappedAlarms = data.map(mapAlarmFromSupabase);
      setAlarms(mappedAlarms);
      return mappedAlarms;
    }

    if (error) {
      console.log('Load alarms failed', error);
      return [];
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('target_wake_time, mission_mode, personalized_mission, default_mission, protected_days, enabled_missions')
      .eq('user_id', user!.id)
      .single();

    if (!settings?.target_wake_time) return [];

    const bootstrapData = {
      targetWakeTime: new Date(settings.target_wake_time),
      missionType: settings.mission_mode === 'roulette' ? 'roulette' : 'personalized',
      selectedMissions: Array.isArray(settings.enabled_missions) ? settings.enabled_missions : undefined,
      protectedDays: Array.isArray(settings.protected_days) ? settings.protected_days : undefined,
    };

    try {
      const created = await ensureInitialDailyAlarm(user!.id, bootstrapData);
      if (created) {
        setAlarms([created]);
        return [created];
      }
      const { data: retry } = await supabase
        .from('alarms')
        .select('*')
        .eq('user_id', user!.id)
        .order('id', { ascending: true });
      if (retry?.length) {
        const mappedAlarms = retry.map(mapAlarmFromSupabase);
        setAlarms(mappedAlarms);
        return mappedAlarms;
      }
    } catch (bootstrapErr) {
      console.log('Bootstrap daily alarm failed', bootstrapErr);
    }
    return [];
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const skipSync = route.params?.skipAlarmSync === true;
    if (skipSync) {
      navigation.setParams({ skipAlarmSync: undefined });
    }

    const loadHomeData = async () => {
      try {
        const alarmList = await fetchAlarms();
        await loadProfile();
        if (cancelled) return;

        const syncSchedules = async (alarms: Alarm[]) => {
          if (cancelled || alarms.length === 0) return;
          await requestAlarmPermissions();
          await syncAlarmSchedules(alarms, protectedDaysRef.current, { force: true });
        };

        if (skipSync) {
          setTimeout(() => {
            if (!cancelled) {
              void syncSchedules(alarmList).catch((syncError) => {
                console.warn('[RooAlarm] Delayed alarm sync failed', syncError);
              });
            }
          }, MISSION_RETRIGGER_GUARD_MS);
        } else {
          await syncSchedules(alarmList);
        }
      } catch (loadError) {
        console.warn('[RooAlarm] Home data load failed', loadError);
      }
    };

    loadHomeData();
    return () => {
      cancelled = true;
    };
  }, [user, route.params?.skipAlarmSync]);

  useEffect(() => {
    if (!isSuccessSequence && nextVisualStreak === null) {
      setVisualStreak(streak);
    }
  }, [streak, isSuccessSequence, nextVisualStreak]);

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from('user_settings')
      .select(USER_SETTINGS_SELECT)
      .eq('user_id', user!.id)
      .single();
    if (error) {
      console.log('Load profile failed', error);
      return;
    }
    if (!data) return;
    if (data.name) setProfileName(data.name);
    const normalizedDays = normalizeProtectedDays(data.protected_days, protectedDays);
    setProtectedDays(normalizedDays);
    protectedDaysRef.current = normalizedDays;
    if (data.mission_mode === 'roulette' || data.mission_mode === 'personalized') setMissionMode(data.mission_mode);
    if (Array.isArray(data.enabled_missions) && data.enabled_missions.length > 0) setEnabledMissions(data.enabled_missions);
    if (data.personalized_mission || data.default_mission) setPersonalizedMission(normalizeMissionId(data.personalized_mission || data.default_mission));
  };

  const saveUserSettings = async (values: Record<string, any>) => {
    if (!user) return null;
    const payload = { ...values, updated_at: new Date().toISOString() };
    const updateResult = await supabase
      .from('user_settings')
      .update(payload)
      .eq('user_id', user.id)
      .select(USER_SETTINGS_SELECT)
      .single();

    if (!updateResult.error && updateResult.data) return updateResult.data;

    const upsertResult = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, ...payload }, { onConflict: 'user_id' })
      .select(USER_SETTINGS_SELECT)
      .single();

    if (upsertResult.error) {
      console.log('Save user settings failed', upsertResult.error);
      return null;
    }

    return upsertResult.data;
  };

  const loadAlarms = async () => {
    const alarmList = await fetchAlarms();
    await ensureDailyAlarmScheduled(alarmList);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) {
        loadAlarms().catch(() => {});
        loadProfile().catch(() => {});
      }
    });
    return unsubscribe;
  }, [navigation, user]);

  const oldScale = useRef(new Animated.Value(1)).current;
  const newScale = useRef(new Animated.Value(0.5)).current;
  const oldOpacity = useRef(new Animated.Value(1)).current;
  const newOpacity = useRef(new Animated.Value(0)).current;
  const iconGlow = useRef(new Animated.Value(0)).current;

  const dailyAlarm = getDailyAlarm(alarms);
  const otherAlarms = getOtherAlarms(alarms);

  const openDailyAlarmEditor = async () => {
    const alarmList = user ? await fetchAlarms() : alarms;
    const daily = getDailyAlarm(alarmList);

    if (daily && isDailyAlarmLockedToday(daily)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Selection);
      // Removed early return to allow editing tomorrow's time
    }

    if (daily) {
      setNewAlarm(false);
      setIsDailyEdit(true);
      setEditAlarm(daily);
      return;
    }

    const dailyFromDb = user ? await fetchDailyAlarmRow(user.id).catch(() => null) : null;
    if (dailyFromDb) {
      setNewAlarm(false);
      setIsDailyEdit(true);
      setEditAlarm(dailyFromDb);
      setAlarms((prev) => {
        const rest = prev.filter((a) => !!a.specificDate);
        return [dailyFromDb, ...rest];
      });
      return;
    }

    setNewAlarm(true);
    setIsDailyEdit(true);
    setEditAlarm({
      id: Date.now(),
      time: '7:00',
      ampm: 'AM',
      mission: personalizedMission,
      on: true,
      label: 'Wake up',
    });
  };

  const isOnAlarmFlowScreen = () => {
    const routeName = navigation.getState?.()?.routes?.slice(-1)[0]?.name;
    return ['AlarmUnlock', 'AlarmMission', 'Camera', 'Success', 'Fail'].includes(routeName || '');
  };

  const markAlarmTriggered = async (alarm: Alarm, todayStr: string) => {
    const updatedAlarm = { ...alarm, lastTriggeredDate: todayStr };
    setAlarms((prev) => prev.map((a) => (a.id === alarm.id ? updatedAlarm : a)));
    if (user) {
      await supabase.from('alarms').update({ last_triggered_date: todayStr }).eq('id', alarm.id);
    }
  };

  const openPendingAlarmKitMission = () => {
    if (isOnAlarmFlowScreen()) return;
    void tryOpenPendingAlarmFlow(navigationRef, user?.id);
  };

  const getNextDailyOccurrence = (al: Alarm) => {
    const activeDays = protectedDays.length > 0 ? protectedDays : ALL_WEEK_DAYS;
    const now = new Date(currentTime);
    const [hStr, mStr] = al.time.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (al.ampm === 'PM' && h < 12) h += 12;
    if (al.ampm === 'AM' && h === 12) h = 0;

    for (let offset = 0; offset < 8; offset += 1) {
      const candidate = new Date(currentTime);
      candidate.setDate(now.getDate() + offset);
      candidate.setHours(h, m, 0, 0);
      if (!activeDays.includes(getMondayDayIndex(candidate))) continue;
      if (candidate > now) {
        return {
          date: candidate,
          daysAway: offset,
          dayIndex: getMondayDayIndex(candidate),
        };
      }
    }

    const fallback = new Date(currentTime);
    fallback.setDate(now.getDate() + 1);
    fallback.setHours(h, m, 0, 0);
    return { date: fallback, daysAway: 1, dayIndex: getMondayDayIndex(fallback) };
  };

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        openPendingAlarmKitMission();
      }
    });
    return () => subscription.remove();
  }, [alarms, navigation]);

  useEffect(() => {
    if (route.params?.completedDaily) {
      navigation.setParams({ completedDaily: undefined });
      setIsSuccessSequence(true);
      setRooState('victory');
      setFrozenWeeklyHistory([...weeklyHistory]);
      setAnimateDayIndex(null);
      
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Update local daily alarm
      if (dailyAlarm) {
        const updatedAlarm = {
          ...dailyAlarm,
          lastCompletedDate: todayStr,
          lastTriggeredDate: todayStr,
        };
        setAlarms(prev => prev.map(a => a.id === dailyAlarm.id ? updatedAlarm : a));
      }

      // Record in Supabase
      if (user && dailyAlarm) {
        markDailyCompletedToday(user.id, dailyAlarm.id).catch(() => {});
        supabase.from('mission_history').insert({
          user_id: user.id,
          alarm_id: dailyAlarm.id,
          mission_type: dailyAlarm.mission,
          custom_mission_text: dailyAlarm.customMission || null
        }).then();
      }

      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAnimateToStreak(streak + 1);
        setShowParticles(true);
      }, 500);

      setTimeout(() => {
        oldScale.setValue(1);
        oldOpacity.setValue(1);
        newScale.setValue(0.92);
        newOpacity.setValue(0);
        setNextVisualStreak(streak + 1);
        
        Animated.parallel([
          Animated.timing(oldScale, { toValue: 0.92, duration: 900, useNativeDriver: true }),
          Animated.timing(oldOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(180),
            Animated.parallel([
              Animated.spring(newScale, { toValue: 1, friction: 5, tension: 95, useNativeDriver: true }),
              Animated.timing(newOpacity, { toValue: 1, duration: 720, useNativeDriver: true }),
              Animated.sequence([
                Animated.timing(iconGlow, { toValue: 1, duration: 260, useNativeDriver: false }),
                Animated.timing(iconGlow, { toValue: 0, duration: 520, useNativeDriver: false })
              ])
            ])
          ])
        ]).start();
      }, 1700);

      setTimeout(() => {
        setAnimateDayIndex(currentDayIndex);
      }, 4300);

      setTimeout(() => {
        const nextStreak = streak + 1;
        
        // Update streak
        setStreak(nextStreak);
        setVisualStreak(nextStreak);
        setNextVisualStreak(null);
        setStreakVisible(true);
        
        // Reset scales
        oldScale.setValue(1);
        oldOpacity.setValue(1);
        newScale.setValue(0.92);
        newOpacity.setValue(0);
        iconGlow.setValue(0);
        
        setAnimateToStreak(null);
        setRooState('idle');
        setTimeout(() => {
          setFrozenWeeklyHistory(null);
          setAnimateDayIndex(null);
        }, 900);
      }, 5200);
    } else if (route.params?.failedDaily) {
      navigation.setParams({ failedDaily: undefined });
      setRooState('defeat');
      
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAnimateToStreak(0); // Vaciar anillo
      }, 500);

      setTimeout(() => {
        setStreak(0); // Resetear contador principal
        setAnimateToStreak(null);
        setFrozenWeeklyHistory(null);
      }, 2000);
    }
  }, [route.params?.completedDaily, route.params?.failedDaily, streak]);

  const getTimeRemainingText = (al?: Alarm) => {
    if (!al) return '--:--';
    // La Daily Alarm NUNCA dice "Off", siempre muestra cuánto falta para la próxima (forzado)
    if (!al.on && al.id !== dailyAlarm?.id) return t('off');
    const now = new Date(currentTime);
    let alarmTime: Date;

    if (al.id === dailyAlarm?.id) {
      alarmTime = getNextDailyOccurrence(al).date;
    } else {
      const [hStr, mStr] = al.time.split(':');
      let h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (al.ampm === 'PM' && h < 12) h += 12;
      if (al.ampm === 'AM' && h === 12) h = 0;

      alarmTime = new Date(currentTime);
      alarmTime.setHours(h, m, 0, 0);

      if (alarmTime <= now) {
        alarmTime.setDate(alarmTime.getDate() + 1);
      }
    }

    const diffMs = alarmTime.getTime() - now.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffS = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (diffH === 0 && diffM === 0) return `${diffS}s`;
    if (diffH === 0) return `${diffM}m ${diffS}s`;
    return `${diffH}h ${diffM}m ${diffS}s`;
  };

  const getDailyTitle = () => {
    if (!dailyAlarm) return t('dailyAlarm');
    const nextDaily = getNextDailyOccurrence(dailyAlarm);
    if (nextDaily.daysAway <= 1) return t('dailyAlarm');
    return `${t('next')} ${fullWeekdays[nextDaily.dayIndex]}`;
  };

  const getDisplayedMissionName = (al?: Alarm) => {
    if (!al) return t('morningMission');
    if (al.specificDate && al.missionMode === 'roulette') return t('rooRoulette');
    if (!al.specificDate && missionMode === 'roulette') return t('rooRoulette');
    if (al.mission === 'custom') return al.customMission || t('customMission');
    return missionCopy(al.mission).label || getMission(al.mission)?.label || t('morningMission');
  };

  const getAlarmLabel = (al: Alarm) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (al.lastCompletedDate === todayStr) return t('tomorrow').toUpperCase();
    
    const now = new Date(currentTime);
    const [hStr, mStr] = al.time.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (al.ampm === 'PM' && h < 12) h += 12;
    if (al.ampm === 'AM' && h === 12) h = 0;
    
    const alarmTime = new Date(currentTime);
    alarmTime.setHours(h, m, 0, 0);
    
    if (now > alarmTime) return t('tomorrow').toUpperCase();
    return t('today').toUpperCase();
  };

  const handleEditSave = async (updated: Alarm) => {
    if (!user) throw new Error('Not authenticated');

    let alarmToSave = updated;
    let createNew = newAlarm;

    if (isDailyEdit) {
      const resolved = await resolveDailyAlarmForSave(user.id, updated, alarms, newAlarm);
      alarmToSave = resolved.alarm;
      createNew = resolved.createNew;
    }

    const alarmData = buildAlarmSavePayload(alarmToSave, user.id, isDailyEdit);

    const persistDailySideEffects = async (savedAlarm: Alarm) => {
      try {
        await purgeDuplicateDailyAlarms(user.id, savedAlarm.id);
      } catch (purgeError) {
        console.log('Purge duplicate daily alarms failed', purgeError);
      }
      try {
        await saveUserSettings({
          target_wake_time: clockToTargetWakeTime(savedAlarm.time, savedAlarm.ampm).toISOString(),
        });
      } catch (settingsError) {
        console.log('Save target_wake_time failed', settingsError);
      }
    };

    const scheduleFailureMessage = (reason: string) => {
      if (reason === 'notifications_denied' || reason === 'notification_schedule_failed') {
        return t('alarmNotScheduled');
      }
      return t('alarmNotScheduled');
    };

    const syncNativeSchedule = async (savedAlarm: Alarm) => {
      await requestAlarmPermissions();
      const days = protectedDaysRef.current;
      if (savedAlarm.on) {
        const result = await scheduleAlarm(savedAlarm, { protectedDays: days });
        if (!result.ok) {
          throw new Error(scheduleFailureMessage(result.reason));
        }
        console.log('[RooAlarm] Scheduled alarm', savedAlarm.id, result.mode);
      } else {
        await cancelAlarmSchedule(savedAlarm.id);
      }
    };

    const runPostSaveSideEffects = async (savedAlarm: Alarm) => {
      await syncNativeSchedule(savedAlarm);
      if (isDailyEdit) {
        try {
          await persistDailySideEffects(savedAlarm);
        } catch (sideError) {
          console.warn('[RooAlarm] Daily side effects failed', sideError);
        }
      }
    };

    let savedAlarm: Alarm;
    try {
      savedAlarm = await persistAlarmRecord(user.id, alarmToSave, alarmData, createNew, {
        isDaily: isDailyEdit,
      });
    } catch (saveError) {
      console.log('Persist alarm failed', saveError);
      throw new Error(formatSaveError(saveError) || 'No se pudo guardar la alarma');
    }

    if (createNew) {
      setAlarms((prev) => {
        if (isDailyEdit) {
          const rest = prev.filter((a) => !!a.specificDate);
          return [savedAlarm, ...rest];
        }
        return [...prev, savedAlarm];
      });
      setNewAlarm(false);
    } else {
      setAlarms((prev) => prev.map((a) => (a.id === alarmToSave.id ? savedAlarm : a)));
    }

    await runPostSaveSideEffects(savedAlarm);
    setEditAlarm(null);
  };

  const handleProtectedDaysSave = async (days: number[]) => {
    const nextDays = days.length > 0 ? [...days].sort((a, b) => a - b) : protectedDays;
    if (!user) {
      setProtectedDays(nextDays);
      protectedDaysRef.current = nextDays;
      return;
    }
    const saved = await saveUserSettings({ protected_days: nextDays });
    const normalized = normalizeProtectedDays(saved?.protected_days, nextDays);
    setProtectedDays(normalized);
    protectedDaysRef.current = normalized;
    try {
      const currentAlarms = await fetchAlarms();
      await syncAlarmSchedules(currentAlarms, normalized, { force: true });
      await ensureDailyAlarmScheduled(currentAlarms);
    } catch (syncError) {
      console.warn('[RooAlarm] Protected days sync failed', syncError);
    }
  };

  const handleMissionSettingsSave = async (next: {
    missionMode: MissionMode;
    enabledMissions: string[];
    personalizedMission: string;
  }) => {
    const safeEnabled = next.enabledMissions.length > 0 ? next.enabledMissions : enabledMissions;
    const safePersonalized = normalizeMissionId(next.personalizedMission);
    if (!user) {
      setMissionMode(next.missionMode);
      setEnabledMissions(safeEnabled);
      setPersonalizedMission(safePersonalized);
      return;
    }
    const saved = await saveUserSettings({
      mission_mode: next.missionMode,
      enabled_missions: safeEnabled,
      personalized_mission: safePersonalized,
      default_mission: safePersonalized,
    });
    if (saved?.mission_mode === 'roulette' || saved?.mission_mode === 'personalized') setMissionMode(saved.mission_mode);
    setEnabledMissions(Array.isArray(saved?.enabled_missions) && saved.enabled_missions.length > 0 ? saved.enabled_missions : safeEnabled);
    setPersonalizedMission(normalizeMissionId(saved?.personalized_mission || saved?.default_mission || safePersonalized));
  };

  const handleToggle = async (id: number) => {
    if (!user) return;
    const alarm = alarms.find(a => a.id === id);
    if (!alarm) return;
    const newOn = !alarm.on;
    const { data, error } = await supabase
      .from('alarms')
      .update({ enabled: newOn })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (data) {
      const savedAlarm = mapAlarmFromSupabase(data);
      setAlarms((prev) => prev.map((a) => (a.id === id ? savedAlarm : a)));
      try {
        await requestAlarmPermissions();
        if (savedAlarm.on) {
          const result = await scheduleAlarm(savedAlarm, { protectedDays });
          if (!result.ok) {
            console.warn('[RooAlarm] Toggle schedule failed', result.reason);
          }
        } else {
          await cancelAlarmSchedule(savedAlarm.id);
        }
      } catch (scheduleError) {
        console.warn('[RooAlarm] Toggle schedule error', scheduleError);
      }
    } else {
      if (error) console.log('Toggle alarm failed', error);
    }
  };

  const getEvolutionProgressValue = (value: number) => {
    let base = 0;
    let target = 4;
    if (value >= 21) {
      base = 21; target = 21;
    } else if (value >= 18) {
      base = 18; target = 21;
    } else if (value >= 13) {
      base = 13; target = 18;
    } else if (value >= 8) {
      base = 8; target = 13;
    } else if (value >= 4) {
      base = 4; target = 8;
    }
    if (target === base) return 1;
    return Math.max(0.08, Math.min(1, (value - base) / (target - base)));
  };

  const displayStreak = nextVisualStreak ?? visualStreak;
  const progressWidth = `${Math.round(getEvolutionProgressValue(displayStreak) * 100)}%` as any;
  const progressTrackColor = colorWithOpacity(colors.textDim, 0.28);
  const rawDisplayName =
    profileName ||
    (typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : '') ||
    (user?.email ? user.email.split('@')[0] : '');
  const displayName = rawDisplayName
    ? rawDisplayName.charAt(0).toUpperCase() + rawDisplayName.slice(1).toLowerCase()
    : 'Emil';
  const dailyLockedToday = isDailyAlarmLockedToday(dailyAlarm);

  const getDailyWidgetTime = () => {
    if (!dailyAlarm) return getTimeRemainingText();
    return dailyAlarm.time;
  };

  const getDailyWidgetAmpm = () => {
    return undefined;
  };

  const getDailyLockedSubtitle = () => {
    if (!dailyAlarm || !dailyLockedToday) return undefined;
    return t('tomorrowAtTime', { time: formatAlarmClockLabel(dailyAlarm) });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} hidden />

      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topSection, { backgroundColor: colors.surface, minHeight: layout.topSectionMinHeight }]}>
          <View
            style={[
              styles.contentWrap,
              {
                maxWidth: layout.contentMaxWidth,
                paddingHorizontal: layout.horizontalPadding,
              },
            ]}
          >
          <View style={[styles.topBar, { paddingTop: insets.top + 15 }]}>
            <Text
              style={[styles.greet, { color: colors.textDim, fontSize: layout.greetFontSize, lineHeight: layout.greetFontSize + 4 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {t('greeting')}, {displayName}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
              <Icon name="gear" size={24} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <WeeklyStreak 
            streak={streak} 
            animateDayIndex={animateDayIndex}
            visualHistory={frozenWeeklyHistory || undefined}
            rings
            ringSize={layout.streakRingSize}
            ringRadius={layout.streakRingRadius}
            flameSize={layout.streakFlameSize}
            labelSize={layout.streakLabelSize}
            onPress={() => { setIsSuccessSequence(false); setStreakVisible(true); }} 
          />

          <View style={[styles.characterArea, { marginTop: layout.characterAreaMarginTop }]}>
            <EvolutionCharacter 
              streak={displayStreak} 
              animateToStreak={animateToStreak}
              showRing={false}
              useVideo={false}
              characterSize={layout.characterSize}
              characterImageSize={layout.characterImageSize}
              animationState={rooState}
              onAnimationEnd={() => {
                if (rooState === 'levelup') {
                  setRooState('idle');
                  setStreakVisible(true);
                } else {
                  setRooState('idle');
                }
              }}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setEvolutionSheetVisible(true);
              }}
            />

            <TouchableOpacity
              style={[styles.progressBlock, { width: layout.progressBlockWidth as `${number}%` }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEvolutionSheetVisible(true);
              }}
              activeOpacity={0.82}
            >
              <View style={[styles.progressNumberSlot, { height: layout.progressNumberSize + 6, minWidth: layout.progressNumberSize + 40 }]}>
                {nextVisualStreak !== null ? (
                  <>
                    <Animated.Text style={[styles.progressNumber, styles.progressNumberLayer, { color: colors.textDim, opacity: oldOpacity, transform: [{ scale: oldScale }], fontSize: layout.progressNumberSize, lineHeight: layout.progressNumberSize + 4 }]}>
                      {visualStreak}
                    </Animated.Text>
                    <Animated.Text style={[styles.progressNumber, { color: colors.textDim, opacity: newOpacity, transform: [{ scale: newScale }], fontSize: layout.progressNumberSize, lineHeight: layout.progressNumberSize + 4 }]}>
                      {nextVisualStreak}
                    </Animated.Text>
                  </>
                ) : (
                  <Text style={[styles.progressNumber, { color: colors.textDim, fontSize: layout.progressNumberSize, lineHeight: layout.progressNumberSize + 4 }]}>
                    {visualStreak}
                  </Text>
                )}
              </View>
              <View style={[styles.progressTrack, { backgroundColor: progressTrackColor, height: layout.progressTrackHeight }]}>
                <View style={[styles.progressFill, { width: progressWidth, backgroundColor: colors.brandOrange || '#FFA000' }]} />
              </View>
              <ParticleExplosion visible={showParticles} onComplete={() => setShowParticles(false)} />
            </TouchableOpacity>
          </View>
          </View>
        </View>

        <View
          style={[
            styles.bottomSection,
            {
              paddingTop: layout.widgetSectionTopSpacing,
              paddingBottom: insets.bottom + (layout.isCompactHeight ? 18 : 28),
              paddingHorizontal: layout.horizontalPadding,
            },
          ]}
        >
          <View style={[styles.contentWrap, { maxWidth: layout.contentMaxWidth }]}>
          <AlarmWidgets 
            dailyTitle={getDailyTitle()}
            timeRemaining={getTimeRemainingText(dailyAlarm ?? undefined)}
            missionName={getDisplayedMissionName(dailyAlarm ?? undefined)}
            dailyAlarmTime={getDailyWidgetTime()}
            dailyAlarmAmpm={getDailyWidgetAmpm()}
            dailyLocked={dailyLockedToday}
            dailyLockedSubtitle={getDailyLockedSubtitle()}
            onPressLeft={openDailyAlarmEditor}
            onPressRight={() => setOtherAlarmsVisible(true)}
            otherAlarms={otherAlarms}
            layout={layout}
          />
          </View>
        </View>
      </ScrollView>

      {/* Modals & Overlays */}
      <EvolutionTimelineSheet 
        visible={evolutionSheetVisible} 
        streak={streak} 
        onClose={() => setEvolutionSheetVisible(false)} 
      />

      <StreakModal 
        visible={streakVisible} 
        streak={visualStreak} 
        isSuccessSequence={isSuccessSequence}
        hasCompletedToday={dailyAlarm?.lastCompletedDate === new Date().toISOString().split('T')[0]}
        onClose={() => {
          setStreakVisible(false);
          setTimeout(() => setIsSuccessSequence(false), 300);
        }} 
      />
      
      <RescueModal
        visible={showRescueModal}
        tokensAvailable={rescueTokens}
        onUseToken={useRescueToken}
        onAcceptPunishment={acceptPunishment}
      />
      
      <OtherAlarmsSheet
        visible={otherAlarmsVisible}
        alarms={otherAlarms}
        onClose={() => setOtherAlarmsVisible(false)}
        onToggle={handleToggle}
        onEdit={(al) => {
          setOtherAlarmsVisible(false);
          setNewAlarm(false);
          setIsDailyEdit(false);
          setEditAlarm(al);
        }}
        onAdd={() => {
          setOtherAlarmsVisible(false);
          setNewAlarm(true);
          setIsDailyEdit(false);
          setEditAlarm({
            id: Date.now(),
            time: '12:00',
            ampm: 'PM',
            mission: personalizedMission,
            missionMode,
            enabledMissions,
            sound: DEFAULT_ALARM_SOUND,
            on: true,
            label: t('sheets.newAlarm'),
            specificDate: toDateOnlyIso(new Date()),
          });
        }}
      />
      
      {editAlarm && (
        <EditSheet
          visible={!!editAlarm}
          alarm={editAlarm}
          onClose={() => {
            setEditAlarm(null);
            setNewAlarm(false);
            setIsDailyEdit(false);
          }}
          onSave={handleEditSave}
          protectedDays={protectedDays}
          onProtectedDaysSave={handleProtectedDaysSave}
          missionMode={missionMode}
          enabledMissions={enabledMissions}
          personalizedMission={personalizedMission}
          onMissionSettingsSave={handleMissionSettingsSave}
          onDelete={(id) => {
            setAlarms((prev) => prev.filter(a => a.id !== id));
            cancelAlarmSchedule(id).catch(() => {});
            supabase.from('alarms').delete().eq('id', id);
          }}
          isNew={newAlarm}
          isDaily={isDailyEdit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  contentWrap: {
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  greet: {
    flex: 1,
    flexShrink: 1,
    fontFamily: FONT_FAMILY.extraBold,
    fontWeight: '800',
    letterSpacing: 0,
  },
  settingsBtn: {
    padding: 8,
    marginRight: -8,
    flexShrink: 0,
  },
  bottomSection: {
    width: '100%',
    flexGrow: 1,
    justifyContent: 'center',
  },
  topSection: {
    paddingBottom: 28,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    marginBottom: 0,
  },
  characterArea: {
    alignItems: 'center',
    marginBottom: 0,
  },
  progressBlock: {
    alignSelf: 'center',
    maxWidth: 280,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 0,
  },
  progressNumber: {
    fontFamily: FONT_FAMILY.extraBold,
    fontWeight: '800',
    letterSpacing: 0,
  },
  progressNumberSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumberLayer: {
    position: 'absolute',
  },
  progressTrack: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 3,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
