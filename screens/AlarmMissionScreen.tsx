import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { FONT_FAMILY } from '../constants/theme';
import { useLanguage } from '../constants/LanguageContext';
import {
  DEFAULT_ENABLED_MISSIONS,
  DEFAULT_PERSONALIZED_MISSION,
  getMission,
  MISSION_LIST,
  Mission,
  MissionMode,
} from '../constants/missions';
import SquishyButton from '../components/SquishyButton';
import { supabase } from '../lib/supabase';
import { useAuth } from '../constants/AuthContext';
import { configurePlaybackAudio, createRooAudioPlayer, RooAudioPlayer, stopRooAudioPlayer } from '../lib/audioPlayer';

const TOTAL = 60;
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
  const { t, missionCopy } = useLanguage();
  const alarm = route.params?.alarm;
  const [permission, requestPermission] = useCameraPermissions();
  const [seconds, setSeconds] = useState(TOTAL);
  const [mission, setMission] = useState<Mission>(getMission(alarm?.mission));
  const [missionMode, setMissionMode] = useState<MissionMode>('personalized');
  const [roulettePool, setRoulettePool] = useState<Mission[]>([]);
  const [phase, setPhase] = useState<'intro' | 'roulette'>('intro');
  const [isRolling, setIsRolling] = useState(false);
  const [continuePressed, setContinuePressed] = useState(false);
  const [rollIndex, setRollIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const itemScale = useRef(new Animated.Value(1)).current;
  const expiresAtRef = useRef(Date.now() + TOTAL * 1000);
  const tickSoundRef = useRef<RooAudioPlayer | null>(null);

  const value = seconds / TOTAL;
  const size = Math.min(width - 92, 270);
  const r = size / 2 - 16;
  const c = 2 * Math.PI * r;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    resolveMission();

    intervalRef.current = setInterval(() => {
      const next = Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000));
      setSeconds(next);
    }, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopRooAudioPlayer(tickSoundRef.current);
    };
  }, []);

  useEffect(() => {
    if (seconds === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      navigation.replace('AlarmUnlock', { isDaily, alarm });
    }
  }, [seconds, navigation, isDaily, alarm]);

  const resolveMission = async () => {
    if (!user) {
      setMission(getMission(alarm?.mission || DEFAULT_PERSONALIZED_MISSION));
      return;
    }

    const { data } = await supabase
      .from('user_settings')
      .select('mission_mode, enabled_missions, personalized_mission, default_mission')
      .eq('user_id', user.id)
      .single();

    if (data?.mission_mode === 'roulette') {
      const allowed = Array.isArray(data.enabled_missions) && data.enabled_missions.length > 0
        ? data.enabled_missions
        : DEFAULT_ENABLED_MISSIONS;
      const choices = allowed
        .map(id => getMission(id))
        .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index);
      const pool = choices.length > 0 ? choices : MISSION_LIST;
      setMissionMode('roulette');
      setRoulettePool(pool);
      setMission(pool[0]);
      return;
    }

    setMissionMode('personalized');
    setMission(getMission(data?.personalized_mission || data?.default_mission || alarm?.mission || DEFAULT_PERSONALIZED_MISSION));
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

  const startRoulette = () => {
    const pool = roulettePool.length > 0 ? roulettePool : MISSION_LIST;
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
        setRollIndex(winnerIndex);
        setIsRolling(false);
        playFinishSound();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => goToCamera(winner), 520);
        return;
      }

      step += 1;
      delay = step > totalSteps - 7 ? delay + 44 : Math.min(delay + 6, 90);
      setTimeout(tick, delay);
    };

    tick();
  };

  const handleContinue = async () => {
    setContinuePressed(true);
    if (missionMode === 'roulette') {
      if (!permission?.granted) {
        await requestPermission();
      }
      if (!isRolling) startRoulette();
      return;
    }
    setTimeout(() => goToCamera(mission), 180);
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

      <Animated.View style={[styles.content, { paddingTop: insets.top + 34, paddingBottom: insets.bottom + 34, opacity: fadeAnim }]}>
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
              onPress={handleContinue}
              color={continuePressed ? '#E64235' : '#FFFFFF'}
              shadowColor={continuePressed ? 'rgba(179, 45, 35, 0.42)' : 'rgba(0,0,0,0.16)'}
              borderRadius={18}
              contentStyle={styles.primaryBtn}
            >
              <Text style={[styles.primaryText, { color: continuePressed ? '#FFFFFF' : '#2B211B' }]}>{t('alarmFlow.unlock')}</Text>
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

            <View style={styles.rouletteBottomSpacer} />
          </>
        )}
      </Animated.View>
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
});
