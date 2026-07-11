import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { translations } from '../constants/i18n';
import Icon from './Icon';

interface WeeklyStreakProps {
  streak: number;
  animateDayIndex?: number | null;
  visualHistory?: boolean[];
  onPress: () => void;
  compact?: boolean;
  circles?: boolean;
  rings?: boolean;
  ringSize?: number;
  ringRadius?: number;
  flameSize?: number;
  labelSize?: number;
}

const getOpenRingPath = (ringSize: number, ringRadius: number) => {
  const center = ringSize / 2;
  const start = (145 * Math.PI) / 180;
  const end = (395 * Math.PI) / 180;
  const startX = center + ringRadius * Math.cos(start);
  const startY = center + ringRadius * Math.sin(start);
  const endX = center + ringRadius * Math.cos(end);
  const endY = center + ringRadius * Math.sin(end);
  return `M ${startX} ${startY} A ${ringRadius} ${ringRadius} 0 1 1 ${endX} ${endY}`;
};

export default function WeeklyStreak({
  streak,
  animateDayIndex,
  visualHistory,
  onPress,
  compact = false,
  circles = false,
  rings = false,
  ringSize = 44,
  ringRadius = 17,
  flameSize = 15,
  labelSize = 10,
}: WeeklyStreakProps) {
  const { colors, weeklyHistory, currentDayIndex } = useColors();
  const { t, language } = useLanguage();
  const scaleAnims = useRef(Array.from({ length: 7 }).map(() => new Animated.Value(1))).current;
  const displayHistory = visualHistory || weeklyHistory;

  useEffect(() => {
    if (animateDayIndex != null && animateDayIndex >= 0 && animateDayIndex < 7) {
      Animated.sequence([
        Animated.spring(scaleAnims[animateDayIndex], { toValue: 1.6, friction: 3, tension: 180, useNativeDriver: true }),
        Animated.spring(scaleAnims[animateDayIndex], { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [animateDayIndex]);

  const days = translations[language].weekdays;

  return (
    <TouchableOpacity 
      style={[styles.container]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.dotsRow}>
        {days.map((day, i) => {
          const isFilled = displayHistory[i];
          const isToday = i === currentDayIndex;
          const isPast = i < currentDayIndex;
          
          const accentColor = colors.brandOrange || '#FFA000';
          let iconColor = colors.textDim;
          let iconVariant: 'outline' | 'solid' = 'outline';
          let labelColor = colors.textDim;
          
          if (isFilled || animateDayIndex === i) {
            iconColor = accentColor;
            iconVariant = 'solid';
            labelColor = colors.textDim;
          } else if (isPast) {
            iconColor = colors.textDim;
            iconVariant = 'outline';
            labelColor = colors.textDim;
          }
          const ringActive = isFilled || animateDayIndex === i;
          const ringColor = colors.textDim;
          const ringStroke = ringActive ? 3.2 : 2.4;
          const ringOpacity = ringActive ? 0.86 : 0.24;
          const ringContentOpacity = ringActive ? 1 : 0.58;
          
          return (
            <Animated.View key={i} style={[styles.dayContainer, compact && styles.compactDay, rings && styles.ringDay, { transform: [{ scale: scaleAnims[i] }] }]}>
              {rings ? (
                <View style={[styles.ringItem, { width: ringSize - 2, height: ringSize + 4 }]}>
                  <Svg width={ringSize} height={ringSize} style={styles.ringSvg}>
                    <Path
                      d={getOpenRingPath(ringSize, ringRadius)}
                      fill="none"
                      stroke={ringColor}
                      strokeWidth={ringStroke}
                      strokeOpacity={ringOpacity}
                      strokeLinecap="round"
                    />
                  </Svg>
                  <View style={[styles.ringFlame, { opacity: ringContentOpacity, top: ringSize * 0.2, width: ringSize - 2 }]}>
                    <Icon 
                      name="flame" 
                      size={flameSize} 
                      color={ringActive ? accentColor : colors.textDim} 
                      variant={ringActive ? 'solid' : 'outline'}
                    />
                  </View>
                  <Text style={[styles.ringLabel, { color: labelColor, opacity: ringActive ? 1 : 0.72, top: ringSize * 0.61, width: ringSize - 2, fontSize: labelSize }]}>{days[i][0]}</Text>
                </View>
              ) : circles ? (
                <>
                  <View style={styles.circleLabelWrap}>
                    <Text style={[styles.circleLabel, { color: labelColor }]}>{days[i][0]}</Text>
                  </View>
                  <View style={[
                    styles.circleIcon,
                    {
                      backgroundColor: (isFilled || animateDayIndex === i) ? colors.surface2 : colors.surface3,
                      borderColor: isToday ? colors.textDim : colors.hairline,
                    },
                  ]}>
                    <Icon 
                      name="flame" 
                      size={17} 
                      color={(isFilled || animateDayIndex === i) ? accentColor : colors.textDim} 
                      variant={(isFilled || animateDayIndex === i) ? 'solid' : 'outline'}
                    />
                  </View>
                </>
              ) : compact ? (
                <View style={[
                  styles.compactDot,
                  isToday && styles.compactDotToday,
                  (isFilled || animateDayIndex === i) && styles.compactDotFilled,
                  isPast && !isFilled && styles.compactDotPast,
                ]} />
              ) : (
                <>
                  <View style={[
                    styles.dayLabelContainer,
                    isToday && { backgroundColor: colors.surface2, paddingHorizontal: 6, borderRadius: 8, paddingVertical: 2 }
                  ]}>
                    <Text style={[styles.dayLabel, { color: labelColor }]}>{days[i][0]}</Text>
                  </View>
                  <View style={[
                    styles.iconWrapper,
                    (isFilled || animateDayIndex === i) && styles.activeIconGlow,
                    (isFilled || animateDayIndex === i) && { shadowColor: colors.accGlow },
                  ]}>
                    <Icon 
                      name="flame" 
                      size={18} 
                      color={iconColor} 
                      variant={iconVariant}
                    />
                  </View>
                </>
              )}
            </Animated.View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    marginHorizontal: 8,
    marginTop: 0,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  dayContainer: {
    alignItems: 'center',
    gap: 6,
  },
  ringDay: {
    flex: 1,
    minWidth: 0,
  },
  ringItem: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'center',
  },
  ringSvg: {
    position: 'absolute',
    top: 0,
  },
  ringLabel: {
    position: 'absolute',
    textAlign: 'center',
    fontWeight: '900',
  },
  ringFlame: {
    position: 'absolute',
    alignItems: 'center',
  },
  compactDay: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    gap: 0,
  },
  compactDot: {
    width: 9,
    height: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  compactDotFilled: {
    width: 12,
    height: 12,
    backgroundColor: '#FFE27A',
    borderColor: '#FFFFFF',
  },
  compactDotPast: {
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  compactDotToday: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dayLabelContainer: {
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  circleLabelWrap: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  circleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  activeIconGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  }
});
