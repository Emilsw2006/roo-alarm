/**
 * Pantalla de desbloqueo con sonido propio de la app.
 * Solo se usa en Android (notificación → deslizar → misión) o como fallback sin AlarmKit.
 * En iOS con AlarmKit el despertar ocurre en la UI del sistema; tras Comprobar se va directo a AlarmMission.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Vibration, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT_FAMILY } from '../constants/theme';
import SwipeBegin from '../components/SwipeBegin';
import Icon from '../components/Icon';
import { SOUND_ASSETS } from '../constants/sounds';
import { configurePlaybackAudio, createRooAudioPlayer, RooAudioPlayer, stopRooAudioPlayer } from '../lib/audioPlayer';
import { getCurrentAlarmClockDisplay } from '../lib/alarmScheduler';
import { navigationRef } from '../App';
import { tryOpenPendingAlarmFlow } from '../lib/alarmMissionLaunch';
import { useAuth } from '../constants/AuthContext';

const { width } = Dimensions.get('window');
const ORB_SIZE = Math.min(width * 0.72, 320);

interface AlarmUnlockScreenProps {
  navigation: any;
  route: any;
}

export default function AlarmUnlockScreen({ navigation, route }: AlarmUnlockScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useColors();
  const { t } = useLanguage();
  const alarm = route.params?.alarm;
  const isDaily = route.params?.isDaily ?? false;
  const { user } = useAuth();
  const displayClock = alarm
    ? { time: alarm.time, ampm: alarm.ampm }
    : getCurrentAlarmClockDisplay();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeScale = useRef(new Animated.Value(0.96)).current;
  const soundRef = useRef<RooAudioPlayer | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void (async () => {
      const opened = await tryOpenPendingAlarmFlow(navigationRef, user?.id);
      if (!opened) {
        navigation.replace('AlarmMission', { isDaily, alarm, fromAlarmKit: true });
      }
    })();
  }, [alarm, isDaily, navigation, user?.id]);

  useEffect(() => {
    if (Platform.OS === 'ios') return;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(timeScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();

    let volumeInterval: NodeJS.Timeout;
    async function playSound() {
      try {
        await configurePlaybackAudio(true);

        const newSound = createRooAudioPlayer(SOUND_ASSETS[0].file, { loop: true, volume: 0.1 });
        soundRef.current = newSound;
        newSound.play();

        Vibration.vibrate([1000, 1000, 1000], true);

        let currentVol = 0.1;
        volumeInterval = setInterval(() => {
          currentVol += 0.05;
          if (currentVol >= 1.0) {
            currentVol = 1.0;
            clearInterval(volumeInterval);
          }
          newSound.volume = currentVol;
        }, 1000);
      } catch (error) {
        console.log('Error loading sound', error);
      }
    }
    playSound();

    return () => {
      if (volumeInterval) clearInterval(volumeInterval);
      Vibration.cancel();
      stopRooAudioPlayer(soundRef.current);
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      stopRooAudioPlayer(soundRef.current);
      soundRef.current = null;
    });
    return unsubscribe;
  }, [navigation]);

  const handleComplete = async () => {
    Vibration.cancel();
    stopRooAudioPlayer(soundRef.current);
    soundRef.current = null;
    navigation.navigate('AlarmMission', { isDaily, alarm });
  };

  if (Platform.OS === 'ios') {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" translucent />

      <Animated.View
        style={[
          styles.body,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 20) + 16,
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.centerArea}>
          <View style={[styles.alarmOrb, { backgroundColor: colors.accSolid }]}>
            <View style={styles.alarmLabelRow}>
              <Icon name="bell" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.alarmLabel}>{t('alarmFlow.alarm')}</Text>
            </View>
            <Animated.View style={{ marginTop: 16, transform: [{ scale: timeScale }], alignItems: 'center' }}>
              <Text style={styles.time}>{displayClock.time}</Text>
              <Text style={styles.ampm}>{displayClock.ampm}</Text>
            </Animated.View>
          </View>
        </View>

        <View style={styles.sliderArea}>
          <SwipeBegin
            onComplete={handleComplete}
            label={t('alarmFlow.slideToStop')}
            iconColor="#ffffff"
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  body: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  alarmOrb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  alarmLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alarmLabel: {
    fontSize: 18,
    fontFamily: FONT_FAMILY.bold,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
  },
  time: {
    fontSize: 72,
    fontFamily: FONT_FAMILY.black,
    color: '#ffffff',
    letterSpacing: -2,
    lineHeight: 78,
  },
  ampm: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 22,
    fontFamily: FONT_FAMILY.bold,
    marginTop: 4,
  },
  sliderArea: {
    paddingHorizontal: 24,
    width: '100%',
  },
});
