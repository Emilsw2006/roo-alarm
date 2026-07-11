import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT_FAMILY } from '../constants/theme';
import SquishyButton from '../components/SquishyButton';
import * as Haptics from 'expo-haptics';
import { configurePlaybackAudio, createRooAudioPlayer, stopRooAudioPlayer } from '../lib/audioPlayer';
import { resetToHome } from '../lib/alarmNavigation';
import { finalizeAlarmSuccess } from '../lib/finalizeAlarmSuccess';
import { useAuth } from '../constants/AuthContext';
import { Alarm } from '../constants/data';

interface SuccessScreenProps {
  navigation: any;
  route: any;
}

export default function SuccessScreen({ navigation, route }: SuccessScreenProps) {
  const isDaily = route.params?.isDaily ?? false;
  const alarm = route.params?.alarm as Alarm | undefined;
  const insets = useSafeAreaInsets();
  const { colors, streak } = useColors();
  const { t } = useLanguage();
  const { user } = useAuth();

  const oldStreakNum = isDaily ? streak : 0;
  const newStreak = isDaily ? streak + 1 : streak;

  const flameScale = useRef(new Animated.Value(0.3)).current;
  const flameOpacity = useRef(new Animated.Value(0.4)).current;
  const oldNumOpacity = useRef(new Animated.Value(1)).current;
  const oldNumTranslateY = useRef(new Animated.Value(0)).current;
  const newNumOpacity = useRef(new Animated.Value(0)).current;
  const newNumTranslateY = useRef(new Animated.Value(80)).current;
  const masterScale = useRef(new Animated.Value(0.3)).current;
  const masterOpacity = useRef(new Animated.Value(0.4)).current;
  const wobbleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const btnFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void finalizeAlarmSuccess(alarm, user?.id);
  }, [alarm?.id, user?.id]);

  useEffect(() => {
    if (!isDaily) {
      Animated.timing(btnFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    Vibration.vibrate(40);
    setTimeout(() => Vibration.vibrate(40), 1000);
    setTimeout(() => Vibration.vibrate([0, 50, 100, 60]), 3000);

    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(wobbleAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(wobbleAnim, { toValue: -1, duration: 800, useNativeDriver: true }),
          Animated.timing(wobbleAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
      ])
    ).start();

    const playSuccessSound = async () => {
      try {
        await configurePlaybackAudio(false);
        const sound = createRooAudioPlayer({ uri: 'https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg' });
        sound.play();
        setTimeout(() => stopRooAudioPlayer(sound), 3000);
      } catch (e) {
        console.log(e);
      }
    };

    Animated.sequence([
      Animated.parallel([
        Animated.timing(masterScale, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(masterOpacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(flameScale, { toValue: 0.85, duration: 650, useNativeDriver: true }),
        Animated.timing(flameOpacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
      Animated.delay(1250),
      Animated.parallel([
        Animated.timing(oldNumOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        Animated.timing(oldNumTranslateY, { toValue: -80, duration: 900, useNativeDriver: true }),
        Animated.timing(newNumOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(newNumTranslateY, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ]).start(() => {
      Animated.timing(btnFade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    });

    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      playSuccessSound();
    }, 1850);
  }, []);

  const wobbleRotation = wobbleAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-55deg', '-35deg'],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const oldStreakStr = String(oldStreakNum);
  const newStreakStr = String(newStreak);
  const maxLen = Math.max(oldStreakStr.length, newStreakStr.length);
  const paddedOld = oldStreakStr.padStart(maxLen, ' ');
  const paddedNew = newStreakStr.padStart(maxLen, ' ');

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.center}>
        {isDaily ? (
        <Animated.View style={[styles.flameContainer, { opacity: flameOpacity, transform: [{ scale: flameScale }, { scale: pulseScale }] }]}>
          <Animated.View style={[styles.dropletOuter, { backgroundColor: colors.accSolid, shadowColor: colors.accSolid, transform: [{ rotate: wobbleRotation }] }]}>
            <View style={styles.dropletInner} />
          </Animated.View>
        </Animated.View>
        ) : (
          <Text style={{ fontSize: 64, marginBottom: 12 }}>✅</Text>
        )}

        {isDaily ? (
        <Animated.View style={[styles.numbersContainer, { opacity: masterOpacity, transform: [{ scale: masterScale }] }]}>
          {paddedNew.split('').map((newChar, i) => {
            const oldChar = paddedOld[i];
            if (oldChar === newChar) {
              return (
                <Text key={`static-${i}`} style={styles.bigNumber}>
                  {newChar}
                </Text>
              );
            }
            return (
              <View key={`anim-${i}`} style={styles.digitSlot}>
                <Text style={[styles.bigNumber, { opacity: 0 }]}>{newChar}</Text>
                {oldChar !== ' ' && (
                  <Animated.Text style={[styles.bigNumber, styles.absoluteDigit, { opacity: oldNumOpacity, transform: [{ translateY: oldNumTranslateY }] }]}>
                    {oldChar}
                  </Animated.Text>
                )}
                <Animated.Text style={[styles.bigNumber, styles.absoluteDigit, { opacity: newNumOpacity, transform: [{ translateY: newNumTranslateY }] }]}>
                  {newChar}
                </Animated.Text>
              </View>
            );
          })}
        </Animated.View>
        ) : (
          <Text style={[styles.bigNumber, { fontSize: 28, textAlign: 'center', paddingHorizontal: 24 }]}>
            {t('alarmFlow.missionComplete')}
          </Text>
        )}
      </View>

      <Animated.View style={[styles.bottomBtn, { paddingBottom: insets.bottom + 34, opacity: btnFade }]}>
        <SquishyButton
          color="#000000"
          shadowColor="rgba(0,0,0,0.4)"
          onPress={() =>
            resetToHome(navigation, isDaily ? { completedDaily: true, skipAlarmSync: true } : { skipAlarmSync: true })
          }
          contentStyle={styles.startBtnContent}
        >
          <Text style={styles.startBtnText}>{t('alarmFlow.startDay')}</Text>
        </SquishyButton>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  flameContainer: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  dropletOuter: {
    width: 100,
    height: 100,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  dropletInner: {
    width: 46,
    height: 46,
    backgroundColor: '#FFB000',
    borderBottomLeftRadius: 23,
    borderBottomRightRadius: 23,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 2,
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  numbersContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  digitSlot: { alignItems: 'center', justifyContent: 'center', height: 90, overflow: 'hidden' },
  absoluteDigit: { position: 'absolute' },
  bigNumber: { fontSize: 80, fontFamily: FONT_FAMILY.black, color: '#000000', letterSpacing: -3, lineHeight: 90 },
  bottomBtn: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24 },
  startBtnContent: { height: 68, alignItems: 'center', justifyContent: 'center', paddingVertical: 0 },
  startBtnText: { color: '#ffffff', fontSize: 17, lineHeight: 24, fontFamily: FONT_FAMILY.bold },
});
