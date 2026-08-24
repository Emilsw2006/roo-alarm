import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { FONT_FAMILY } from '../constants/theme';
import { useLanguage } from '../constants/LanguageContext';
import {
  DEFAULT_PERSONALIZED_MISSION,
  getMission,
  MISSION_LIST,
  Mission,
  MissionMode,
  resolveRoulettePool,
} from '../constants/missions';
import SquishyButton from '../components/SquishyButton';
import MissionRescuePrompt from '../components/MissionRescuePrompt';
import { supabase } from '../lib/supabase';
import { useAuth } from '../constants/AuthContext';
import { useColors } from '../constants/ThemeContext';
import { configurePlaybackAudio, createRooAudioPlayer, RooAudioPlayer, stopRooAudioPlayer } from '../lib/audioPlayer';
import { finishMissionTimeout, onMissionTimerExpired } from '../lib/missionTimeout';
import { finalizeAlarmSuccess } from '../lib/finalizeAlarmSuccess';
import { cancelDismissRetrigger, scheduleMissionWatchdog } from '../lib/alarmScheduler';

const TOTAL = 60;
const MAX_ROULETTE_REROLLS = 2;
const { width } = Dimensions.get('window');
const ROO_IMAGE = require('../assets/entrevistador.png');
const ROULETTE_TICK = require('../assets/sounds/roulette_tick.wav');
const ROULETTE_FINISH = require('../assets/sounds/roulette_finish.wav');

interface AlarmMissionScreenProps {
  navigation: any;
  route: any;
}

export default function AlarmMissionScreen({ navigation, route }: AlarmMissionScreenProps) {
  const isDaily = route.params?.isDaily ?? false;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { rescueTokens, setRescueTokens } = useColors();
  const { t, missionCopy } = useLanguage();
  const alarm = route.params?.alarm;
  const fromAlarmKit = route.params?.fromAlarmKit ?? false;
  const [permission, requestPermission] = useCameraPermissions();
  const [seconds, setSeconds] = useState(TOTAL);
  const [mission, setMission] = useState<Mission>(getMission(alarm?.mission));
  const [missionMode, setMissionMode] = useState<MissionMode>('personalized');
  const [roulettePool, setRoulettePool] = useState<Mission[]>([]);
  const [phase, setPhase] = useState<'intro' | 'roulette'>('intro');
  const [isRolling, setIsRolling] = useState(false);
  const [continuePressed, setContinuePressed] = useState(false);
  const [rerollsLeft, setRerollsLeft] = useState(MAX_ROULETTE_REROLLS);
  const [lockedMission, setLockedMission] = useState<Mission | null>(null);
  const [rollIndex, setRollIndex] = useState(0);
  const [missionResolved, setMissionResolved] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rouletteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const itemScale = useRef(new Animated.Value(1)).current;
  const expiresAtRef = useRef(Date.now() + TOTAL * 1000);
  const tickSoundRef = useRef<RooAudioPlayer | null>(null);
  const timeoutHandledRef = useRef(false);
  const [showRescuePrompt, setShowRescuePrompt] = useState(false);

  const value = seconds / TOTAL;
  const size = Math.min(width - 92, 270);
  const r = size / 2 - 16;
  const c = 2 * Math.PI * r;

  useEffect(() => {
    if (fromAlarmKit && alarm?.id && Platform.OS === 'ios') {
      void cancelDismissRetrigger(alarm.id);
    }
    if (Platform.OS === 'ios' && alarm?.id) {
      void scheduleMissionWatchdog(alarm);
    }
  }, [fromAlarmKit, alarm?.id]);

  useEffect(() => {
    const safety = setTimeout(() => setMissionResolved(true), 3000);
    return () => clearTimeout(safety);
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    resolveMission();

    intervalRef.current = setInterval(() => {
      const next = Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000));
      setSeconds(next);
    }, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (rouletteTimeoutRef.current) clearTimeout(rouletteTimeoutRef.current);
      stopRooAudioPlayer(tickSoundRef.current);
    };
  }, []);

  useEffect(() => {
    if (seconds !== 0 || timeoutHandledRef.current) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    void (async () => {
      const outcome = await onMissionTimerExpired({ isDaily, alarm }, user?.id, rescueTokens);
      if (outcome === 'rescue') {
        setShowRescuePrompt(true);
        return;
      }
      timeoutHandledRef.current = true;
      await finishMissionTimeout(navigation, { isDaily, alarm }, user?.id, { skipRetrigger: true });
    })();
  }, [seconds, navigation, isDaily, alarm, user?.id, rescueTokens]);

  const handleUseToken = async () => {
    if (rescueTokens <= 0) return;
    timeoutHandledRef.current = true;
    setRescueTokens(rescueTokens - 1);
    if (user) {
      // El decremento lo hace el servidor: atómico y con guarda de saldo.
      const { data: remaining, error } = await supabase.rpc('spend_rescue_token');
      if (error) {
        console.log('spend_rescue_token failed', error);
        setRescueTokens(rescueTokens);
      } else if (typeof remaining === 'number') {
        setRescueTokens(remaining);
      }
    }
    setShowRescuePrompt(false);
    void finalizeAlarmSuccess(alarm, user?.id);
    navigation.replace('Success', { isDaily, alarm });
  };

  const handleRepeatAlarm = () => {
    setShowRescuePrompt(false);
    timeoutHandledRef.current = true;
    void finishMissionTimeout(navigation, { isDaily, alarm }, user?.id, { skipRetrigger: true });
  };

  const startRoulettePool = (enabled?: string[] | null) => {
    const pool = resolveRoulettePool(enabled);
    setMissionMode('roulette');
    setRoulettePool(pool);
    setMission(pool[0]);
  };

  const resolveMission = async () => {
    try {
      // Alarmas one-off: respetan su propio missionMode. No heredar roulette global.
      if (!isDaily) {
        if (alarm?.missionMode === 'roulette') {
          startRoulettePool(alarm.enabledMissions);
          return;
        }
        setMissionMode('personalized');
        setMission(getMission(alarm?.mission || DEFAULT_PERSONALIZED_MISSION));
        return;
      }

      if (!user) {
        setMission(getMission(alarm?.mission || DEFAULT_PERSONALIZED_MISSION));
        return;
      }

      // Si Supabase no responde no podemos dejar la misión sin resolver: el usuario
      // ya está despierto y el temporizador corre. Caemos al modo por defecto.
      let data: { mission_mode?: string; enabled_missions?: unknown; personalized_mission?: string; default_mission?: string } | null = null;
      try {
        const result = await supabase
          .from('user_settings')
          .select('mission_mode, enabled_missions, personalized_mission, default_mission')
          .eq('user_id', user.id)
          .single();
        data = result.data;
      } catch (error) {
        console.log('resolveMission settings error', error);
      }

      if (data?.mission_mode === 'roulette') {
        startRoulettePool(Array.isArray(data.enabled_missions) ? data.enabled_missions : null);
        return;
      }

      setMissionMode('personalized');
      setMission(getMission(data?.personalized_mission || data?.default_mission || alarm?.mission || DEFAULT_PERSONALIZED_MISSION));
    } finally {
      setMissionResolved(true);
    }
  };

  const playFinishSound = async () => {
    try {
      await configurePlaybackAudio(false);
      const sound = createRooAudioPlayer(ROULETTE_FINISH, { volume: 0.55 });
      sound.play();
      setTimeout(() => stopRooAudioPlayer(sound), 1400);
    } catch (e) {
      console.log('Roulette sound error', e);
    }
  };

  const playTick = async () => {
    try {
      if (!tickSoundRef.current) {
        await configurePlaybackAudio(false);
        tickSoundRef.current = createRooAudioPlayer(ROULETTE_TICK, { volume: 0.62 });
      }
      await tickSoundRef.current.seekTo(0);
      tickSoundRef.current.play();
    } catch (e) {
      console.log('Roulette tick error', e);
    }
  };

  const goToCamera = (pickedMission: Mission) => {
    navigation.navigate('Camera', {
      isDaily,
      alarm: { ...alarm, mission: pickedMission.id, label: alarm?.label || missionCopy(pickedMission.id).label },
      missionExpiresAt: expiresAtRef.current,
    });
  };

  const startRoulette = (options?: { isReroll?: boolean }) => {
    const pool = roulettePool.length > 0 ? roulettePool : MISSION_LIST;
    if (pool.length === 0) return;
    const winner = pool[Math.floor(Math.random() * pool.length)];
    const winnerIndex = pool.findIndex(item => item.id === winner.id);
    const totalSteps = 25 + Math.max(0, winnerIndex);
    let step = 0;
    let delay = 58;

    setContinuePressed(false);
    setPhase('roulette');
    setIsRolling(true);
    Haptics.selectionAsync();

    const tick = () => {
      const nextIndex = step % pool.length;
      const current = pool[nextIndex];
      setRollIndex(nextIndex);
      setMission(current);
      playTick();
      Haptics.impactAsync(step > totalSteps - 7 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
      itemScale.setValue(0.9);
      Animated.spring(itemScale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }).start();

      if (step >= totalSteps) {
        setMission(winner);
        setLockedMission(winner);
        setRollIndex(winnerIndex);
        setIsRolling(false);
        playFinishSound();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      step += 1;
      delay = step > totalSteps - 7 ? delay + 44 : Math.min(delay + 6, 90);
      rouletteTimeoutRef.current = setTimeout(tick, delay);
    };

    tick();
  };

  const handleContinue = async () => {
    if (!missionResolved) return;
    setContinuePressed(true);
    if (missionMode === 'roulette') {
      if (!permission?.granted) {
        await requestPermission();
      }
      if (lockedMission && !isRolling) {
        goToCamera(lockedMission);
        return;
      }
      if (!isRolling) startRoulette();
      return;
    }
    setTimeout(() => goToCamera(mission), 180);
  };

  const handleReroll = () => {
    if (isRolling || rerollsLeft <= 0 || !lockedMission) return;
    setRerollsLeft((prev) => prev - 1);
    setLockedMission(null);
    startRoulette({ isReroll: true });
  };

  const pool = roulettePool.length > 0 ? roulettePool : MISSION_LIST;
  const previous = pool[(rollIndex - 1 + pool.length) % pool.length];
  const next = pool[(rollIndex + 1) % pool.length];

  return (
    <View style={phase === 'intro' ? styles.whiteScreen : styles.rouletteScreen}>
      <StatusBar style={phase === 'intro' ? 'dark' : 'light'} hidden />
      {phase === 'roulette' && (
        <View style={StyleSheet.absoluteFill}>
          {permission?.granted !== false ? (
            <CameraView style={StyleSheet.absoluteFill} facing="back" active />
          ) : (
            <View style={StyleSheet.absoluteFill} />
          )}
          <View style={[styles.rouletteTint, permission?.granted === false && styles.rouletteFallbackTint]} />
        </View>
      )}

      <Animated.View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28, opacity: fadeAnim }]}>
        {phase === 'intro' ? (
          <>
            <View style={styles.introSpacer} />

            <View style={styles.introCenter}>
              <View style={styles.brandHeader}>
                <View style={styles.rooMark}>
                  <Image source={ROO_IMAGE} style={styles.rooMini} />
                </View>
                <Text style={styles.brandTitle}>Roo Alarm</Text>
              </View>
              <View style={[styles.timerWrap, { width: size, height: size }]}>
                <Svg width={size} height={size} style={styles.timerSvg}>
                  <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E9E3DA" strokeWidth={11} />
                  <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="#E64235"
                    strokeWidth={11}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - value)}
                    rotation="-90"
                    origin={`${size / 2}, ${size / 2}`}
                  />
                </Svg>
                <Text style={styles.introCount}>{String(seconds).padStart(2, '0')}</Text>
              </View>
            </View>

            <SquishyButton
              onPress={missionResolved && !continuePressed ? handleContinue : undefined}
              color={continuePressed || !missionResolved ? '#E64235' : '#FFFFFF'}
              shadowColor={continuePressed || !missionResolved ? 'rgba(179, 45, 35, 0.42)' : 'rgba(0,0,0,0.16)'}
              borderRadius={18}
              contentStyle={styles.primaryBtn}
            >
              <Text style={[styles.primaryText, { color: continuePressed || !missionResolved ? '#FFFFFF' : '#2B211B' }]}>{t('alarmFlow.unlock')}</Text>
            </SquishyButton>
          </>
        ) : (
          <>
            <View style={styles.rouletteTopRow}>
              <View style={styles.rouletteMissionPill}>
                <Text style={styles.rouletteMissionEmoji}>{mission.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rouletteEyebrow}>{t('mission').toUpperCase()}</Text>
                  <Text style={styles.rouletteMissionName}>{isRolling ? t('alarmFlow.choosingMission') : missionCopy(mission.id).label}</Text>
                </View>
              </View>
              <View style={styles.rouletteTimerPill}>
                <Text style={styles.rouletteTimerText}>{seconds}s</Text>
              </View>
            </View>

            <View style={styles.carouselFrame}>
              <View style={[styles.sideObject, styles.leftObject]}>
                <Text style={styles.sideEmoji}>{previous.emoji}</Text>
              </View>
              <Animated.View style={[styles.mainObject, { transform: [{ scale: itemScale }] }]}>
                <Text style={styles.mainEmoji}>{mission.emoji}</Text>
              </Animated.View>
              <View style={[styles.sideObject, styles.rightObject]}>
                <Text style={styles.sideEmoji}>{next.emoji}</Text>
              </View>

              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>

            <View style={styles.rouletteBrand}>
              <Image source={ROO_IMAGE} style={styles.rouletteRoo} />
              <Text style={styles.rouletteBrandText}>Roo Alarm</Text>
            </View>

            {lockedMission && !isRolling ? (
              <View style={styles.rouletteActions}>
                <SquishyButton
                  onPress={handleContinue}
                  color="#FFFFFF"
                  shadowColor="rgba(0,0,0,0.18)"
                  borderRadius={18}
                  contentStyle={styles.primaryBtn}
                >
                  <Text style={[styles.primaryText, { color: '#2B211B' }]}>{t('alarmFlow.acceptMission')}</Text>
                </SquishyButton>
                {rerollsLeft > 0 ? (
                  <TouchableOpacity onPress={handleReroll} activeOpacity={0.8} style={styles.rerollBtn}>
                    <Text style={styles.rerollText}>
                      {t('alarmFlow.spinAgain')} ({rerollsLeft}/2)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.rerollLimit}>{t('alarmFlow.noMoreSpins')}</Text>
                )}
              </View>
            ) : (
              <View style={styles.rouletteBottomSpacer} />
            )}
          </>
        )}
      </Animated.View>

      <MissionRescuePrompt
        visible={showRescuePrompt}
        tokens={rescueTokens}
        variant="timeout"
        onUseToken={handleUseToken}
        onDecline={handleRepeatAlarm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  whiteScreen: { flex: 1, backgroundColor: '#F7F4EE' },
  rouletteScreen: { flex: 1, backgroundColor: '#221211' },
  rouletteTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(34, 18, 17, 0.72)' },
  rouletteFallbackTint: { backgroundColor: 'rgba(34, 18, 17, 0.88)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  introSpacer: { height: 28 },
  introCenter: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingBottom: 46, gap: 30 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  rooMark: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7F4EE', alignItems: 'center', justifyContent: 'center' },
  rooMini: { width: 38, height: 38, resizeMode: 'contain' },
  brandTitle: { color: '#2B211B', fontSize: 25, fontFamily: FONT_FAMILY.black },
  timerWrap: { alignItems: 'center', justifyContent: 'center' },
  timerSvg: { position: 'absolute' },
  introCount: { color: '#E64235', fontSize: 82, fontFamily: FONT_FAMILY.black, letterSpacing: -1, lineHeight: 88, textAlign: 'center' },
  primaryBtn: { width: '100%', height: 68, alignItems: 'center', justifyContent: 'center', paddingVertical: 0 },
  primaryText: { fontSize: 19, lineHeight: 25, fontFamily: FONT_FAMILY.black },
  rouletteTopRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  rouletteMissionPill: { flex: 1, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.50)' },
  rouletteMissionEmoji: { fontSize: 31, width: 48, height: 48, lineHeight: 48, textAlign: 'center', borderRadius: 15, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' },
  rouletteEyebrow: { color: 'rgba(255,255,255,0.58)', fontSize: 10, fontFamily: FONT_FAMILY.black, letterSpacing: 1.3 },
  rouletteMissionName: { color: '#FFFFFF', fontSize: 19, fontFamily: FONT_FAMILY.black, lineHeight: 23 },
  rouletteTimerPill: { width: 74, height: 62, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center' },
  rouletteTimerText: { color: '#FFFFFF', fontSize: 24, fontFamily: FONT_FAMILY.black },
  carouselFrame: { width: 288, height: 430, alignItems: 'center', justifyContent: 'center', position: 'relative', marginTop: 20 },
  mainObject: { width: 142, height: 142, alignItems: 'center', justifyContent: 'center', zIndex: 2, shadowColor: '#fff', shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  mainEmoji: { fontSize: 92, lineHeight: 112, textShadowColor: 'rgba(255,255,255,0.26)', textShadowRadius: 18 },
  sideObject: { position: 'absolute', width: 90, height: 90, alignItems: 'center', justifyContent: 'center', opacity: 0.28 },
  leftObject: { left: 20, transform: [{ rotate: '-18deg' }, { scale: 0.94 }] },
  rightObject: { right: 20, transform: [{ rotate: '18deg' }, { scale: 0.94 }] },
  sideEmoji: { fontSize: 52, lineHeight: 66 },
  corner: { position: 'absolute', width: 48, height: 48, borderColor: 'rgba(241,235,255,0.92)' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  rouletteBrand: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: -52 },
  rouletteRoo: { width: 32, height: 32, resizeMode: 'contain' },
  rouletteBrandText: { color: 'rgba(255,255,255,0.92)', fontSize: 18, fontFamily: FONT_FAMILY.black },
  rouletteBottomSpacer: { height: 86 },
  rouletteActions: { width: '100%', gap: 12, paddingBottom: 8 },
  rerollBtn: { alignItems: 'center', paddingVertical: 10 },
  rerollText: { color: 'rgba(255,255,255,0.88)', fontSize: 15, fontFamily: FONT_FAMILY.bold },
  rerollLimit: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: FONT_FAMILY.semiBold, textAlign: 'center' },
});
