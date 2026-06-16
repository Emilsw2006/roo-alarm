import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { useAuth } from '../constants/AuthContext';
import { supabase } from '../lib/supabase';
import { Alarm, MOCK_ALARMS } from '../constants/data';
import { DEFAULT_ENABLED_MISSIONS, DEFAULT_PERSONALIZED_MISSION, getMission, MissionMode, normalizeMissionId } from '../constants/missions';
import { FONT_FAMILY } from '../constants/theme';

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
import AppLoadingScreen from '../components/AppLoadingScreen';
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
  on: row.enabled,
  sound: row.sound || undefined,
  customMission: row.custom_mission || undefined,
  specificDate: row.specific_date || undefined,
  lastTriggeredDate: row.last_triggered_date || undefined,
  lastCompletedDate: row.last_completed_date || undefined,
});

const USER_SETTINGS_SELECT = 'name, protected_days, mission_mode, enabled_missions, personalized_mission, default_mission';

const normalizeProtectedDays = (days: unknown, fallback: number[]) => {
  if (!Array.isArray(days)) return fallback;
  const normalized = [...new Set(days
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : fallback;
};

export default function HomeScreen({ navigation, route }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, streak, setStreak, weeklyHistory, currentDayIndex, rescueTokens, showRescueModal, setShowRescueModal, useRescueToken, acceptPunishment } = useColors();
  const { t, fullWeekdays, missionCopy } = useLanguage();
  const { user } = useAuth();
  
  const [profileName, setProfileName] = useState('');
  const [alarms, setAlarms] = useState<Alarm[]>(MOCK_ALARMS);
  const [streakVisible, setStreakVisible] = useState(false);
  const [editAlarm, setEditAlarm] = useState<Alarm | null>(null);
  const [newAlarm, setNewAlarm] = useState(false);
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
  const [missionMode, setMissionMode] = useState<MissionMode>('personalized');
  const [enabledMissions, setEnabledMissions] = useState<string[]>(DEFAULT_ENABLED_MISSIONS);
  const [personalizedMission, setPersonalizedMission] = useState(DEFAULT_PERSONALIZED_MISSION);
  const [homeLoading, setHomeLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadHomeData = async () => {
      setHomeLoading(true);
      await Promise.all([loadProfile(), loadAlarms()]);
      if (!cancelled) setHomeLoading(false);
    };

    loadHomeData();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
    setProtectedDays(normalizeProtectedDays(data.protected_days, protectedDays));
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
      throw upsertResult.error;
    }

    return upsertResult.data;
  };

  const loadAlarms = async () => {
    const { data, error } = await supabase
      .from('alarms')
      .select('*')
      .eq('user_id', user!.id)
      .order('id', { ascending: true });
    if (data && data.length > 0) {
      setAlarms(data.map(mapAlarmFromSupabase));
    } else if (error) {
      console.log('Load alarms failed', error);
    }
  };

  const oldScale = useRef(new Animated.Value(1)).current;
  const newScale = useRef(new Animated.Value(0.5)).current;
  const oldOpacity = useRef(new Animated.Value(1)).current;
  const newOpacity = useRef(new Animated.Value(0)).current;
  const iconGlow = useRef(new Animated.Value(0)).current;

  // We consider the first alarm as the "Daily Alarm" (Next Alarm)
  const dailyAlarm = alarms[0];

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
    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      if (!alarms || alarms.length === 0) return;
      
      const d = new Date(now);
      const currentHour = d.getHours();
      const currentMin = d.getMinutes();
      const currentAmPm = currentHour >= 12 ? 'PM' : 'AM';
      
      let displayHour = currentHour % 12;
      if (displayHour === 0) displayHour = 12;
      const todayStr = d.toISOString().split('T')[0];

      alarms.forEach(async (alarm) => {
        if (!alarm.on) return;
        const isDailyAlarm = alarm.id === alarms[0].id;
        if (isDailyAlarm && !protectedDays.includes(getMondayDayIndex(d))) return;
        
        const [aH, aM] = alarm.time.split(':').map(Number);
        if (aH === displayHour && aM === currentMin && alarm.ampm === currentAmPm) {
          // Si ya se completó hoy, no vuelve a sonar
          if (alarm.lastCompletedDate === todayStr) return;
          
          if (alarm.lastTriggeredDate !== todayStr) {
            const updatedAlarm = { ...alarm, lastTriggeredDate: todayStr };
            setAlarms(prev => prev.map(a => a.id === alarm.id ? updatedAlarm : a));
            
            if (user) {
              await supabase.from('alarms').update({ last_triggered_date: todayStr }).eq('id', alarm.id);
            }
            
            navigation.navigate('AlarmUnlock', { isDaily: isDailyAlarm, alarm });
          }
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [alarms, navigation, user, protectedDays]);

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
        const updatedAlarm = { ...dailyAlarm, lastCompletedDate: todayStr };
        setAlarms(prev => prev.map(a => a.id === dailyAlarm.id ? updatedAlarm : a));
      }

      // Record in Supabase
      if (user && dailyAlarm) {
        supabase.from('alarms').update({ last_completed_date: todayStr }).eq('id', dailyAlarm.id).then();
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

  const getTimeRemainingText = (al: Alarm) => {
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
    if (missionMode === 'roulette') return t('rooRoulette');
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
    if (!user) return;
    const alarmData = {
      user_id: user.id,
      time: updated.time,
      ampm: updated.ampm,
      mission: updated.mission,
      label: updated.label,
      sound: updated.sound || null,
      custom_mission: updated.customMission || null,
      specific_date: updated.specificDate || null,
      enabled: updated.on,
      last_triggered_date: updated.lastTriggeredDate || null,
      last_completed_date: updated.lastCompletedDate || null,
    };

    if (newAlarm) {
      const { data, error } = await supabase
        .from('alarms')
        .insert(alarmData)
        .select()
        .single();
      if (data) {
        setAlarms((prev) => [...prev, mapAlarmFromSupabase(data)]);
      } else if (error) {
        console.log('Create alarm failed', error);
        return;
      }
      setNewAlarm(false);
    } else {
      const { data, error } = await supabase
        .from('alarms')
        .update(alarmData)
        .eq('id', updated.id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (data) {
        const savedAlarm = mapAlarmFromSupabase(data);
        setAlarms((prev) => prev.map((a) => (a.id === updated.id ? savedAlarm : a)));
      } else {
        if (error) console.log('Update alarm failed', error);
        return;
      }
    }
    setEditAlarm(null);
  };

  const handleProtectedDaysSave = async (days: number[]) => {
    const nextDays = days.length > 0 ? [...days].sort((a, b) => a - b) : protectedDays;
    if (!user) {
      setProtectedDays(nextDays);
      return;
    }
    const saved = await saveUserSettings({ protected_days: nextDays });
    setProtectedDays(normalizeProtectedDays(saved?.protected_days, nextDays));
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

  if (homeLoading) {
    return <AppLoadingScreen backgroundColor={colors.bg} indicatorColor={colors.accSolid} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} hidden />

      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topSection, { backgroundColor: colors.surface }]}>
          <View style={[styles.topBar, { paddingTop: insets.top + 15 }]}>
            <Text style={[styles.greet, { color: colors.textDim }]}>{t('greeting')}, {displayName}</Text>
            <View style={styles.topRight}>
              <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
                <Icon name="gear" size={24} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          </View>

          <WeeklyStreak 
            streak={streak} 
            animateDayIndex={animateDayIndex}
            visualHistory={frozenWeeklyHistory || undefined}
            rings
            onPress={() => { setIsSuccessSequence(false); setStreakVisible(true); }} 
          />

          <View style={styles.characterArea}>
            <EvolutionCharacter 
              streak={displayStreak} 
              animateToStreak={animateToStreak}
              showRing={false}
              useVideo={false}
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
              style={styles.progressBlock}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEvolutionSheetVisible(true);
              }}
              activeOpacity={0.82}
            >
              <View style={styles.progressNumberSlot}>
                {nextVisualStreak !== null ? (
                  <>
                    <Animated.Text style={[styles.progressNumber, styles.progressNumberLayer, { color: colors.textDim, opacity: oldOpacity, transform: [{ scale: oldScale }] }]}>
                      {visualStreak}
                    </Animated.Text>
                    <Animated.Text style={[styles.progressNumber, { color: colors.textDim, opacity: newOpacity, transform: [{ scale: newScale }] }]}>
                      {nextVisualStreak}
                    </Animated.Text>
                  </>
                ) : (
                  <Text style={[styles.progressNumber, { color: colors.textDim }]}>
                    {visualStreak}
                  </Text>
                )}
              </View>
              <View style={[styles.progressTrack, { backgroundColor: progressTrackColor }]}>
                <View style={[styles.progressFill, { width: progressWidth, backgroundColor: colors.brandOrange || '#FFA000' }]} />
              </View>
              <ParticleExplosion visible={showParticles} onComplete={() => setShowParticles(false)} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 28 }]}>
          <AlarmWidgets 
            dailyTitle={getDailyTitle()}
            timeRemaining={getTimeRemainingText(dailyAlarm)}
            missionName={getDisplayedMissionName(dailyAlarm)}
            dailyAlarmTime={dailyAlarm?.time}
            dailyAlarmAmpm={dailyAlarm?.ampm}
            onPressLeft={() => setEditAlarm(dailyAlarm)}
            onPressRight={() => setOtherAlarmsVisible(true)}
            otherAlarms={alarms.slice(1)}
          />
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
        alarms={alarms.slice(1)}
        onClose={() => setOtherAlarmsVisible(false)}
        onToggle={handleToggle}
        onEdit={(al) => {
          setOtherAlarmsVisible(false);
          setEditAlarm(al);
        }}
        onAdd={() => {
          setOtherAlarmsVisible(false);
          setNewAlarm(true);
          setEditAlarm({
            id: Date.now(),
            time: '12:00',
            ampm: 'PM',
            mission: 'water',
            sound: 'ocean',
            on: true,
            label: t('sheets.newAlarm')
          });
        }}
      />
      
      {editAlarm && (
        <EditSheet
          visible={!!editAlarm}
          alarm={editAlarm}
          onClose={() => { setEditAlarm(null); setNewAlarm(false); }}
          onSave={handleEditSave}
          protectedDays={protectedDays}
          onProtectedDaysSave={handleProtectedDaysSave}
          missionMode={missionMode}
          enabledMissions={enabledMissions}
          personalizedMission={personalizedMission}
          onMissionSettingsSave={handleMissionSettingsSave}
          onDelete={(id) => {
            setAlarms((prev) => prev.filter(a => a.id !== id));
            supabase.from('alarms').delete().eq('id', id);
          }}
          isNew={newAlarm}
          isDaily={editAlarm.id === dailyAlarm.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  greet: {
    fontSize: 32,
    fontFamily: FONT_FAMILY.extraBold,
    fontWeight: '800',
    letterSpacing: 0,
  },
  settingsBtn: {
    padding: 8,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  bottomSection: {
    paddingHorizontal: 18,
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    paddingTop: 18,
    paddingBottom: 28,
  },
  topSection: {
    paddingBottom: 36,
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
    marginTop: 12,
    marginBottom: 0,
  },
  progressBlock: {
    alignSelf: 'center',
    width: '64%',
    maxWidth: 280,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 0,
  },
  progressNumber: {
    fontSize: 46,
    lineHeight: 50,
    fontFamily: FONT_FAMILY.extraBold,
    fontWeight: '800',
    letterSpacing: 0,
  },
  progressNumberSlot: {
    height: 52,
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumberLayer: {
    position: 'absolute',
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 3,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
