import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT_FAMILY } from '../constants/theme';
import Icon from '../components/Icon';
import SquishyButton from '../components/SquishyButton';
import { configurePlaybackAudio, createRooAudioPlayer, stopRooAudioPlayer } from '../lib/audioPlayer';
import { resetToHome } from '../lib/alarmNavigation';

interface FailScreenProps {
  navigation: any;
  route: any;
}

export default function FailScreen({ navigation, route }: FailScreenProps) {
  const isDaily = route.params?.isDaily ?? false;
  const insets = useSafeAreaInsets();
  const { colors } = useColors();
  const { t } = useLanguage();
  const oldStreak = 17;
  const newStreak = 0;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const streakSlide = useRef(new Animated.Value(24)).current;
  const streakFade = useRef(new Animated.Value(0)).current;
  const hapticFade = useRef(new Animated.Value(0)).current;
  const btnFade = useRef(new Animated.Value(0)).current;
  const oldNumFade = useRef(new Animated.Value(1)).current;
  const oldNumSlide = useRef(new Animated.Value(0)).current;
  const newNumFade = useRef(new Animated.Value(0)).current;
  const newNumSlide = useRef(new Animated.Value(20)).current;
  const newNumScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Error sound & vibration
    const playFail = async () => {
      try {
        await configurePlaybackAudio(false);
        const sound = createRooAudioPlayer({ uri: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Computer_Error_Alert.ogg' }, { volume: 1.0 });
        sound.play();
        setTimeout(() => stopRooAudioPlayer(sound), 2500);
      } catch (e) { console.log(e); }
    };
    playFail();
    Vibration.vibrate([0, 100, 100, 100, 100, 500]); // Erratic vibration

    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 180, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(titleFade, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(subtitleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(streakSlide, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(streakFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.stagger(150, [
        Animated.parallel([
          Animated.timing(oldNumFade, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.spring(oldNumSlide, { toValue: 30, friction: 6, useNativeDriver: true }), // drops down
        ]),
        Animated.parallel([
          Animated.spring(newNumSlide, { toValue: 0, friction: 5, tension: 120, useNativeDriver: true }),
          Animated.spring(newNumScale, { toValue: 1, friction: 5, tension: 150, useNativeDriver: true }),
          Animated.timing(newNumFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(hapticFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(btnFade, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.gradientBottom]}
      style={styles.screen}
    >
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <Animated.View style={[styles.glow, { backgroundColor: '#ff3b3020', opacity: scaleAnim }]} />

      <View style={[styles.center, { paddingBottom: insets.bottom + 80 }]}>
        <Animated.View
          style={[
            styles.checkCircle,
            { backgroundColor: '#ff3b30', transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Icon name="x" size={56} color="#1a0e08" stroke={2.4} />
        </Animated.View>

        <Animated.Text style={[styles.title, { color: colors.text, opacity: titleFade }]}>
          {t('alarmFlow.missionFailed')}
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { color: colors.textDim, opacity: subtitleFade }]}>
          {t('alarmFlow.missionFailedBody')}
        </Animated.Text>

        {isDaily && (
          <Animated.View
            style={[
              styles.streakCard,
              { backgroundColor: colors.surface, borderColor: '#ff3b3050' },
              { opacity: streakFade, transform: [{ translateY: streakSlide }] },
            ]}
          >
            <View style={[styles.flameBox, { backgroundColor: '#ff3b30' }]}>
              <Icon name="x" size={26} color="#1a0e08" stroke={2} />
            </View>
            <View>
              <Text style={[styles.streakLabel, { color: '#ff3b30' }]}>{t('alarmFlow.streakLost')}</Text>
              <View style={styles.streakCountRow}>
                <View style={{ height: 40, justifyContent: 'center' }}>
                  <Animated.Text
                    style={[
                      styles.newStreak,
                      { position: 'absolute', color: '#ff3b30', opacity: newNumFade, transform: [{ scale: newNumScale }, { translateY: newNumSlide }] },
                    ]}
                  >
                    {newStreak}
                  </Animated.Text>
                  <Animated.Text
                    style={[
                      styles.newStreak,
                      { color: colors.textFaint, opacity: oldNumFade, transform: [{ translateY: oldNumSlide }] },
                    ]}
                  >
                    {oldStreak}
                  </Animated.Text>
                </View>
                <Text style={[styles.daysLabel, { color: colors.textDim }]}>{t('days').toLowerCase()}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        <Animated.View style={[styles.hapticRow, { opacity: hapticFade }]}>
          <Icon name="bolt" size={14} color={colors.textFaint} />
          <Text style={[styles.hapticText, { color: colors.textFaint }]}>{t('alarmFlow.hapticFeedback')}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottomBtn, { paddingBottom: insets.bottom + 34, opacity: btnFade }]}>
        <SquishyButton
          color="#ff3b30"
          shadowColor="rgba(255, 59, 48, 0.4)"
          onPress={() => resetToHome(navigation, isDaily ? { failedDaily: true } : undefined)}
          contentStyle={{ height: 58, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={styles.startBtnText}>{t('alarmFlow.tryTomorrow')}</Text>
        </SquishyButton>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' },
  glow: { position: 'absolute', top: '25%', width: 400, height: 400, borderRadius: 200, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  checkCircle: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', shadowColor: '#ff3b30', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 10 },
  title: { marginTop: 30, fontSize: 32, fontFamily: FONT_FAMILY.bold, letterSpacing: -1 },
  subtitle: { fontSize: 16, marginTop: 8, textAlign: 'center', fontFamily: FONT_FAMILY.regular },
  streakCard: { marginTop: 34, flexDirection: 'row', alignItems: 'center', gap: 18, padding: 20, borderWidth: 1, borderRadius: 28 },
  flameBox: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  streakLabel: { fontFamily: 'monospace', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  streakCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 2 },
  oldStreak: { fontSize: 22, fontFamily: FONT_FAMILY.bold },
  newStreak: { fontSize: 34, fontFamily: FONT_FAMILY.bold, letterSpacing: -1 },
  daysLabel: { fontSize: 15, fontFamily: FONT_FAMILY.semiBold },
  hapticRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  hapticText: { fontSize: 13, fontFamily: FONT_FAMILY.regular },
  bottomBtn: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24 },
  startBtnText: { color: '#1a0e08', fontSize: 17, fontFamily: FONT_FAMILY.bold },
});
