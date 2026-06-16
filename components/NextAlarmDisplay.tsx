import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/ThemeContext';

import { useLanguage } from '../constants/LanguageContext';
import Icon from './Icon';

interface NextAlarmDisplayProps {
  time: string;
  ampm: string;
  onPress: () => void;
}

export default function NextAlarmDisplay({ time, ampm, onPress }: NextAlarmDisplayProps) {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.outerContainer}>
      <BlurView intensity={colors.isDark ? 40 : 80} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={[colors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)', colors.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.3)']}
        style={styles.container}
      >
        <View style={styles.centerContent}>
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: colors.text }]}>{time}</Text>
          <Text style={[styles.ampmText, { color: colors.accSolid }]}>{ampm.toLowerCase()}</Text>
        </View>
        <Text style={[styles.eyebrow, { color: colors.textFaint }]}>{t('tomorrow')}</Text>
      </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: 32,
    marginBottom: 16,
    width: '100%',
    overflow: 'hidden',
  },
  container: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timeText: {
    fontSize: 76,
    fontWeight: '900',
    letterSpacing: -3,
    textShadowColor: 'rgba(0,0,0,0.05)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  ampmText: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 4,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: -4,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
