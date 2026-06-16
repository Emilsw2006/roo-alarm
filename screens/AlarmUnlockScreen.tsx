import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Vibration, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT_FAMILY } from '../constants/theme';
import SwipeBegin from '../components/SwipeBegin';
import Icon from '../components/Icon';
import { SOUND_ASSETS } from '../constants/sounds';
import { configurePlaybackAudio, createRooAudioPlayer, RooAudioPlayer, stopRooAudioPlayer } from '../lib/audioPlayer';

const { width, height } = Dimensions.get('window');

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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeScale = useRef(new Animated.Value(0.96)).current;
  const soundRef = useRef<RooAudioPlayer | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(timeScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();

    // Play alarm sound
    let volumeInterval: NodeJS.Timeout;
    async function playSound() {
      try {
        await configurePlaybackAudio(true);

        const newSound = createRooAudioPlayer(SOUND_ASSETS[0].file, { loop: true, volume: 0.1 });
        soundRef.current = newSound;
        newSound.play();
        
        // Vibrate
        Vibration.vibrate([1000, 1000, 1000], true);

        // Gradual fade-in to max volume
        let currentVol = 0.1;
        volumeInterval = setInterval(async () => {
          currentVol += 0.05;
          if (currentVol >= 1.0) {
            currentVol = 1.0;
            clearInterval(volumeInterval);
          }
          newSound.volume = currentVol;
        }, 1000); // increase volume every second
        
      } catch (error) {
        console.log("Error loading sound", error);
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

  // Stop the sound when unmounting (the cleanup above handles it, but let's be explicit when navigating)
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

  return (
    <View style={[styles.screen, { backgroundColor: '#000000' }]}>
      <StatusBar style="light" hidden />
      
      {/* Liquid Glass Glow */}
      <Animated.View style={[styles.glow, { top: height * 0.1, backgroundColor: colors.accSolid, opacity: fadeAnim }]} />
      <View style={StyleSheet.absoluteFill}>
         {/* Subtle blur overlay if we had BlurView, but a dark semi-transparent overlay works to diffuse the glow */}
         <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
      </View>

      <Animated.View style={[styles.contentTop, { paddingTop: insets.top + 80, opacity: fadeAnim }]}>
        <View style={styles.alarmLabelRow}>
          <Icon name="bell" size={16} color="rgba(255,255,255,0.6)" />
          <Text style={[styles.alarmLabel, { color: 'rgba(255,255,255,0.6)' }]}>{t('alarmFlow.alarm')}</Text>
        </View>
        <Animated.View style={{ marginTop: 20, transform: [{ scale: timeScale }], alignItems: 'center' }}>
          <Text style={[styles.time, { color: '#ffffff', fontSize: 80, lineHeight: 90 }]}>{alarm ? alarm.time : '7:00'}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 24, fontFamily: FONT_FAMILY.bold }}>{alarm ? alarm.ampm : 'AM'}</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.contentBottom, { paddingBottom: insets.bottom + 60, opacity: fadeAnim }]}>
        <View style={styles.sliderContainer}>
          <SwipeBegin
            onComplete={handleComplete}
            label={t('alarmFlow.slideToStop')}
            color="rgba(255,255,255,0.1)"
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width,
    alignSelf: 'center',
    filter: 'blur(60px)',
  },
  contentTop: {
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 2,
  },
  alarmLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alarmLabel: {
    fontSize: 20,
    fontFamily: FONT_FAMILY.bold,
  },
  time: {
    fontSize: 100,
    fontFamily: FONT_FAMILY.black,
    letterSpacing: -2,
    lineHeight: 110,
  },
  contentBottom: {
    paddingHorizontal: 24,
    width: '100%',
    zIndex: 2,
  },
  sliderContainer: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  }
});
