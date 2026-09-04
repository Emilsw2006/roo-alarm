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
import { startPersistentAlarm } from '../lib/alarmPersistentGuard';
import { getCurrentAlarmClockDisplay } from '../lib/alarmScheduler';
import { isPersistentAlarmActive } from '../lib/alarmPersistentGuard';
import { useAuth } from '../constants/AuthContext';

// Early navigation effect moved inside component

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

  useEffect(() => {
    void startPersistentAlarm(alarm);
  }, [alarm]);

  // If alarm is already ringing (app was backgrounded), navigate instantly to alarm mission
  useEffect(() => {
    if (Platform.OS !== 'ios' && isPersistentAlarmActive()) {
      navigation.replace('AlarmMission', { isDaily, alarm, fromAlarmKit: false });
    }
  }, [alarm, isDaily, navigation]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    navigation.replace('AlarmMission', { isDaily, alarm, fromAlarmKit: true });
  }, [alarm, isDaily, navigation]);

  useEffect(() => {
    if (Platform.OS === 'ios') return;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(timeScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, timeScale]);

  const handleComplete = async () => {
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
