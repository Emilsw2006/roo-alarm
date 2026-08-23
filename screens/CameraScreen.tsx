import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image, Dimensions, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT } from '../constants/theme';
import { getMission } from '../constants/missions';
import Icon from '../components/Icon';
import MissionRescuePrompt from '../components/MissionRescuePrompt';
import { supabase } from '../lib/supabase';
import { finishMissionTimeout, onMissionTimerExpired } from '../lib/missionTimeout';
import { finalizeAlarmSuccess } from '../lib/finalizeAlarmSuccess';
import { useAuth } from '../constants/AuthContext';
import { isAiMissionVerifyEnabled } from '../lib/geminiConfig';
import { verifyMissionPhoto } from '../lib/verifyMissionPhoto';

interface CameraScreenProps {
  navigation: any;
  route: any;
}

function Corner({ position }: { position: string }) {
  const base: any = { position: 'absolute', width: 40, height: 40, borderColor: 'rgba(255,255,255,0.88)', borderStyle: 'solid' };
  const map: Record<string, any> = {
    tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
    tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
    bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
    br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  };
  return <View style={[base, map[position]]} />;
}

export default function CameraScreen({ navigation, route }: CameraScreenProps) {
  const { width, height } = Dimensions.get('window');
  const isDaily = route.params?.isDaily ?? false;
  const alarm = route.params?.alarm;
  const missionExpiresAt = route.params?.missionExpiresAt;
  const insets = useSafeAreaInsets();
  const { rescueTokens, setRescueTokens } = useColors();
  const { user } = useAuth();
  const { t, missionCopy } = useLanguage();
  const [phase, setPhase] = useState<'frame' | 'analyzing' | 'success' | 'incorrect'>('frame');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef<any>(null);
  const [failCount, setFailCount] = useState(0);
  const [showRescuePrompt, setShowRescuePrompt] = useState(false);
  const [rescueReason, setRescueReason] = useState<'fail' | 'timeout' | null>(null);
  const phaseRef = useRef(phase);
  const timeoutHandledRef = useRef(false);
  const rescueTokensRef = useRef(rescueTokens);
  const showRescuePromptRef = useRef(showRescuePrompt);

  useEffect(() => {
    rescueTokensRef.current = rescueTokens;
  }, [rescueTokens]);

  useEffect(() => {
    showRescuePromptRef.current = showRescuePrompt;
  }, [showRescuePrompt]);

  const mission = getMission(alarm?.mission);
  const availableFrameSpace = height - insets.top - insets.bottom - 260;
  const frameSize = Math.max(280, Math.min(width - 48, availableFrameSpace, 360));
  const scanStart = 10;
  const scanEnd = frameSize - 13;
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!missionExpiresAt) return 60;
    return Math.max(0, Math.ceil((missionExpiresAt - Date.now()) / 1000));
  });

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const triggerTimeoutFlow = () => {
    if (timeoutHandledRef.current || phaseRef.current === 'success') return;

    void (async () => {
      const outcome = await onMissionTimerExpired(
        { isDaily, alarm },
        user?.id,
        rescueTokensRef.current,
      );
      if (outcome === 'rescue') {
        setRescueReason('timeout');
        setShowRescuePrompt(true);
        return;
      }
      timeoutHandledRef.current = true;
      await finishMissionTimeout(navigation, { isDaily, alarm }, user?.id, { skipRetrigger: true });
    })();
  };

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();

    const interval = setInterval(() => {
      const next = missionExpiresAt
        ? Math.max(0, Math.ceil((missionExpiresAt - Date.now()) / 1000))
        : null;
      if (next === null) {
        setTimeLeft(prev => Math.max(0, prev - 1));
        return;
      }
      setTimeLeft(next);
      if (next === 0) {
        if (phaseRef.current === 'success') return;
        clearInterval(interval);
        triggerTimeoutFlow();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [missionExpiresAt, navigation, isDaily, alarm, user?.id]);

  useEffect(() => {
    if (phase === 'analyzing') {
      scanAnim.setValue(0);
      const scanLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1850,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      scanLoop.start();
      return () => scanLoop.stop();
    } else {
      scanAnim.stopAnimation();
      scanAnim.setValue(0);
    }
  }, [phase, scanAnim]);

  useEffect(() => {
    if (phase === 'success' || phase === 'incorrect') {
      resultAnim.setValue(0);
      Animated.spring(resultAnim, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }
  }, [phase]);

  const handleCapture = async () => {
    if (timeLeft <= 0) {
      triggerTimeoutFlow();
      return;
    }

    let photoUri: string | null = null;
    let photoBase64: string | null = null;

    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
        base64: true,
      });
      photoUri = photo?.uri ?? null;
      photoBase64 = photo?.base64 ?? null;
      if (photoUri) setCapturedUri(photoUri);
    } catch (e) {
      console.log('Capture error', e);
    }

    setPhase('analyzing');

    const finishWithResult = (willPass: boolean) => {
      const nextFailCount = failCount + 1;

      if (!willPass && missionExpiresAt && Date.now() >= missionExpiresAt) {
        triggerTimeoutFlow();
        return;
      }

      if (!willPass) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPhase('incorrect');
        setFailCount(nextFailCount);

        if (nextFailCount === 2 && rescueTokens > 0) {
          setTimeout(() => {
            setRescueReason('fail');
            setShowRescuePrompt(true);
          }, 1500);
        } else {
          setTimeout(() => {
            setCapturedUri(null);
            setPhase('frame');
          }, 1900);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPhase('success');
        void finalizeAlarmSuccess(alarm, user?.id);
        setTimeout(() => navigation.replace('Success', { isDaily, alarm }), 1250);
      }
    };

    if (isAiMissionVerifyEnabled() && photoBase64) {
      try {
        const copy = missionCopy(mission.id);
        const result = await verifyMissionPhoto({
          missionId: mission.id,
          missionLabel: copy.label,
          missionHint: copy.hint,
          missionEmoji: mission.emoji,
          imageBase64: photoBase64,
        });

        if (result.unavailable) {
          console.log('Gemini unavailable, using fallback verify', result.reason);
        } else {
          finishWithResult(result.passed);
          return;
        }
      } catch (error) {
        console.log('Gemini mission verify error', error);
      }
    }

    setTimeout(() => {
      finishWithResult(true);
    }, 2200);
  };

  const handleUseToken = async () => {
    if (rescueTokens <= 0) return;
    timeoutHandledRef.current = true;
    setRescueTokens(rescueTokens - 1);
    const { data: { user } } = await supabase.auth.getUser();
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
    setRescueReason(null);
    void finalizeAlarmSuccess(alarm, user?.id);
    navigation.replace('Success', { isDaily, alarm });
  };

  const handleKeepTrying = () => {
    const wasTimeout = rescueReason === 'timeout';
    setShowRescuePrompt(false);
    setRescueReason(null);
    if (wasTimeout) {
      timeoutHandledRef.current = true;
      void finishMissionTimeout(navigation, { isDaily, alarm }, user?.id, { skipRetrigger: true });
      return;
    }
    setCapturedUri(null);
    setPhase('frame');
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.permissionWrap]}>
        <Text style={styles.permissionBody}>{t('camera.permission')}</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionText}>{t('camera.grant')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanTranslate = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [scanStart, scanEnd],
  });

  return (
    <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
      <StatusBar style="light" hidden />

      <View style={StyleSheet.absoluteFill}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} active={!capturedUri} />
        {capturedUri && <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        <View style={styles.viewfinderOverlay} />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.missionHeader}>
          <Text style={styles.missionEmoji}>{mission.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.missionEyebrow}>{t('mission').toUpperCase()}</Text>
            <Text style={styles.chipText}>{missionCopy(mission.id).label}</Text>
          </View>
        </View>
        <View style={styles.smallTimer}>
          <Text style={styles.smallTimerText}>{timeLeft}s</Text>
        </View>
      </View>

      <View style={styles.frameArea}>
        <View style={[styles.frameBox, { width: frameSize, height: frameSize }]}>
          <Corner position="tl" />
          <Corner position="tr" />
          <Corner position="bl" />
          <Corner position="br" />
          {phase === 'analyzing' && (
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanTranslate }] }]} />
          )}
          {phase === 'success' && (
            <Animated.View style={[styles.resultBadge, styles.resultSuccess, { transform: [{ scale: resultAnim }] }]}>
              <Icon name="check" size={34} color="#FFFFFF" stroke={3} />
            </Animated.View>
          )}
          {phase === 'incorrect' && (
            <Animated.View style={[styles.resultBadge, styles.resultError, { transform: [{ scale: resultAnim }] }]}>
              <Icon name="x" size={34} color="#FFFFFF" stroke={3} />
            </Animated.View>
          )}
        </View>
      </View>

      <View style={{ flex: 1 }} />

      {phase === 'analyzing' && (
        <View style={styles.analyzingBanner}>
          <View style={styles.analyzingCard}>
            <View style={styles.analyzingRow}>
              <Icon name="sparkle" size={18} color="#F5E8D4" />
              <Text style={styles.analyzingText}>{t('camera.analyzing')}</Text>
            </View>
          </View>
        </View>
      )}

      {phase === 'success' && (
        <View style={styles.analyzingBanner}>
          <View style={[styles.analyzingCard, styles.successCard]}>
            <View style={styles.analyzingRow}>
              <Icon name="check" size={18} color="#fff" stroke={3} />
              <Text style={styles.analyzingText}>{t('camera.valid')}</Text>
            </View>
          </View>
        </View>
      )}

      {phase === 'incorrect' && (
        <View style={styles.analyzingBanner}>
          <View style={[styles.analyzingCard, { backgroundColor: '#C34235' }]}>
            <View style={styles.analyzingRow}>
              <Icon name="x" size={18} color="#fff" stroke={3} />
              <Text style={[styles.analyzingText, { color: '#fff' }]}>{t('camera.retry')}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={[styles.shutterRow, { paddingBottom: insets.bottom + 36 }]}>
        <TouchableOpacity style={styles.flipBtn} onPress={toggleCameraFacing}>
          <Icon name="flip" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shutterOuter, phase !== 'frame' && styles.shutterDisabled]}
          onPress={phase === 'frame' ? handleCapture : undefined}
          activeOpacity={0.86}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <View style={{ width: 50, height: 50 }} />
      </View>

      <MissionRescuePrompt
        visible={showRescuePrompt}
        tokens={rescueTokens}
        variant={rescueReason === 'timeout' ? 'timeout' : 'fail'}
        onUseToken={handleUseToken}
        onDecline={handleKeepTrying}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  permissionWrap: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  permissionBody: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  permissionBtn: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  permissionText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  viewfinderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,12,10,0.18)', pointerEvents: 'none' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, zIndex: 5, gap: 12 },
  missionHeader: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(28,22,18,0.58)' },
  missionEmoji: { fontSize: 28, width: 34, textAlign: 'center' },
  missionEyebrow: { fontSize: 9, fontWeight: FONT.bold, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.1 },
  chipText: { fontSize: 15, fontWeight: FONT.bold, color: '#fff' },
  smallTimer: { height: 42, paddingHorizontal: 15, borderRadius: 999, backgroundColor: 'rgba(28,22,18,0.58)', alignItems: 'center', justifyContent: 'center' },
  smallTimerText: { color: '#fff', fontSize: 16, fontWeight: FONT.bold, fontVariant: ['tabular-nums'] },
  frameArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 132, alignItems: 'center', justifyContent: 'center' },
  frameBox: { width: 280, height: 280, position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  scanLine: { position: 'absolute', top: 0, left: 16, right: 16, height: 3, borderRadius: 999, backgroundColor: '#F8EEE0', shadowColor: '#F8EEE0', shadowOpacity: 0.72, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  resultBadge: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.86)' },
  resultSuccess: { backgroundColor: 'rgba(52, 199, 89, 0.88)' },
  resultError: { backgroundColor: 'rgba(195, 66, 53, 0.88)' },
  analyzingBanner: { paddingHorizontal: 20, zIndex: 5, marginBottom: 16 },
  analyzingCard: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 28, backgroundColor: 'rgba(28,22,18,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
  successCard: { backgroundColor: 'rgba(52, 199, 89, 0.82)' },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  analyzingText: { fontSize: 16, fontWeight: FONT.bold, color: '#fff' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, zIndex: 5, gap: 14 },
  flipBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  shutterOuter: { width: 92, height: 92, borderRadius: 46, borderWidth: 5, borderColor: '#fff', padding: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  shutterInner: { width: '100%', height: '100%', borderRadius: 33, backgroundColor: '#FFFFFF' },
  shutterDisabled: { opacity: 0.58 },
});
