import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, ScrollView } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT } from '../constants/theme';
import Icon from './Icon';
import Ring from './Ring';
import { useSwipeInteractive } from './useSwipeInteractive';
import * as Haptics from 'expo-haptics';

interface StreakModalProps {
  visible: boolean;
  streak: number;
  isSuccessSequence?: boolean;
  hasCompletedToday?: boolean;
  onClose: () => void;
}

function AnimatedDayDot({ isCompleted, isNew, isStart, tierColor, isEmpty, colors, dayNumber }: any) {
  const scale = React.useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const opacity = React.useRef(new Animated.Value(isNew ? 0 : 1)).current;

  React.useEffect(() => {
    if (isNew) {
      Animated.sequence([
        Animated.delay(600), // Espera a que el modal se abra
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true })
        ])
      ]).start();
    }
  }, [isNew]);

  if (isEmpty) {
    return (
      <View style={[styles.monthDot, { backgroundColor: 'transparent' }]}>
        <Text style={{ color: colors.textFaint, fontSize: 12, opacity: 0.3 }}>{dayNumber}</Text>
      </View>
    );
  }

  const bgColor = isCompleted ? (tierColor || colors.accSolid) : colors.surface2;

  return (
    <Animated.View style={[styles.monthDot, { 
      backgroundColor: bgColor,
      opacity,
      transform: [{ scale }]
    }]}>
      {isStart ? (
        <Icon name="star" size={16} color="#FFFFFF" variant="solid" />
      ) : isCompleted ? (
        <Icon name="flame" size={16} color="#FFFFFF" />
      ) : (
        <Text style={{ color: colors.textDim, fontSize: 12, opacity: 0.5 }}>{dayNumber}</Text>
      )}
    </Animated.View>
  );
}

export default function StreakModal({ visible, streak, isSuccessSequence = false, hasCompletedToday = false, onClose }: StreakModalProps) {
  const { colors } = useColors();
  const { t, weekdays, language } = useLanguage();
  const swipe = useSwipeInteractive(visible, onClose);
  const [monthOffset, setMonthOffset] = useState(0);

  const { calendarDays, currentMonthName, minOffset } = React.useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const streakEndDate = new Date(today);
    if (!hasCompletedToday) {
      streakEndDate.setDate(streakEndDate.getDate() - 1);
    }
    
    const streakStartDate = new Date(streakEndDate);
    streakStartDate.setDate(streakEndDate.getDate() - streak + 1);
    
    const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    
    const locale = language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : 'en-US';
    const currentMonthName = targetDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Lun=0, Dom=6
    
    const startYear = streakStartDate.getFullYear();
    const startMonth = streakStartDate.getMonth();
    const diffMonths = (startYear - today.getFullYear()) * 12 + (startMonth - today.getMonth());
    const minOffset = diffMonths;

    const calendarDays = [];
    
    for (let i = 0; i < startOffset; i++) {
      calendarDays.push({ type: 'empty', id: `empty-${i}` });
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      cellDate.setHours(0,0,0,0);
      
      const isBeforeStart = streak > 0 && cellDate < streakStartDate;
      const isFuture = cellDate > today;
      
      let isCompleted = false;
      let diffDaysFromStart = 0;
      let isStart = false;
      let isNew = false;
      
      if (!isBeforeStart && cellDate <= streakEndDate && streak > 0) {
        isCompleted = true;
        diffDaysFromStart = Math.round((cellDate.getTime() - streakStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (diffDaysFromStart === 1) isStart = true;
        if (isSuccessSequence && cellDate.getTime() === streakEndDate.getTime()) {
          isNew = true;
        }
      }
      
      let tierColor = null;
      if (diffDaysFromStart === 4) tierColor = '#A9A9A9';
      else if (diffDaysFromStart === 8) tierColor = '#FFD700';
      else if (diffDaysFromStart === 13) tierColor = '#50c8ff';
      else if (diffDaysFromStart === 18) tierColor = '#FF3B30';
      else if (diffDaysFromStart === 22) tierColor = '#333333';
      
      calendarDays.push({
        type: 'day',
        id: `day-${d}`,
        dayNumber: d,
        isCompleted,
        isNew,
        isStart,
        tierColor,
        isEmpty: isBeforeStart || (streak === 0 && cellDate < today)
      });
    }
    
    return { calendarDays, currentMonthName, minOffset };
  }, [streak, monthOffset, isSuccessSequence, hasCompletedToday, language]);
  
  const oldY = React.useRef(new Animated.Value(0)).current;
  const newY = React.useRef(new Animated.Value(-20)).current;
  const oldOpacity = React.useRef(new Animated.Value(1)).current;
  const newOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible && isSuccessSequence) {
      Animated.sequence([
        Animated.delay(600), // Sincronizado con AnimatedDayDot
        Animated.parallel([
          Animated.timing(oldY, { toValue: 20, duration: 800, useNativeDriver: true }),
          Animated.timing(oldOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.timing(newY, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.timing(newOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ]).start();
      
      // Haptic de confirmación final
      setTimeout(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 600);
    } else if (!visible) {
      oldY.setValue(0);
      newY.setValue(-20);
      oldOpacity.setValue(1);
      newOpacity.setValue(0);      
    }
  }, [visible, isSuccessSequence]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay} {...swipe.panResponder.panHandlers}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { backgroundColor: colors.bg, transform: [{ translateY: swipe.panY }] }]}>
          <View style={[styles.handleBar, { backgroundColor: colors.hairline }]} />
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Text style={[
              styles.title, 
              { color: colors.text, marginBottom: isSuccessSequence ? 12 : 24, fontSize: isSuccessSequence ? 26 : 22 }
            ]}>
              {isSuccessSequence ? t('alarmFlow.missionComplete') : t('alarmFlow.streakCalendar')}
            </Text>
            
            {isSuccessSequence && (
              <View style={styles.streakRow}>
                <Icon name="flame" size={20} color={colors.accSolid} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ height: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    <Animated.Text style={[{ color: colors.text, fontWeight: '700', fontSize: 16, position: 'absolute' }, { opacity: oldOpacity, transform: [{ translateY: oldY }] }]}>
                      {streak - 1}
                    </Animated.Text>
                    <Animated.Text style={[{ color: colors.text, fontWeight: '700', fontSize: 16, position: 'absolute' }, { opacity: newOpacity, transform: [{ translateY: newY }] }]}>
                      {streak}
                    </Animated.Text>
                    <Text style={{ opacity: 0, fontWeight: '700', fontSize: 16 }}>{streak}</Text>
                  </View>
                  <Text style={[styles.streakText, { color: colors.textDim }]}>
                    {t('alarmFlow.dayStreak')}
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.calRow, { marginTop: isSuccessSequence ? 32 : 16 }]}>
              <View style={styles.monthHeader}>
                <TouchableOpacity 
                  onPress={() => setMonthOffset(prev => Math.max(minOffset, prev - 1))}
                  disabled={monthOffset <= minOffset}
                  style={{ opacity: monthOffset <= minOffset ? 0.2 : 1, padding: 8 }}
                >
                  <Icon name="chevL" size={24} color={colors.textDim} />
                </TouchableOpacity>
                <Text style={[styles.calTitle, { color: colors.textDim }]}>{currentMonthName}</Text>
                <TouchableOpacity 
                  onPress={() => setMonthOffset(prev => Math.min(1, prev + 1))}
                  disabled={monthOffset >= 0}
                  style={{ opacity: monthOffset >= 0 ? 0.2 : 1, padding: 8 }}
                >
                  <Icon name="chevR" size={24} color={colors.textDim} />
                </TouchableOpacity>
              </View>

              <View style={styles.monthGrid}>
                {/* Cabecera L M X J V S D */}
                <View style={{ flexDirection: 'row', width: '100%', marginBottom: 8 }}>
                  {weekdays.map((d, i) => (
                    <View key={i} style={styles.calCell}>
                      <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: 'bold' }}>{d}</Text>
                    </View>
                  ))}
                </View>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
                  {calendarDays.map((item, i) => {
                    if (item.type === 'empty') {
                      return <View key={item.id} style={styles.calCell} />;
                    }
                    return (
                      <View key={item.id} style={styles.calCell}>
                        <AnimatedDayDot 
                          dayNumber={item.dayNumber}
                          isCompleted={item.isCompleted} 
                          isNew={item.isNew} 
                          isStart={item.isStart}
                          tierColor={item.tierColor}
                          isEmpty={item.isEmpty}
                          colors={colors} 
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </ScrollView>
          
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(50,40,35,0.45)', // Warm dark overlay
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingBottom: 48,
    maxHeight: '90%',
  },
  handleBar: {
    width: 38,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  content: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 40,
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: FONT.bold,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  streakText: {
    fontSize: 16,
    fontWeight: FONT.medium,
  },
  calRow: {
    paddingHorizontal: 10,
    paddingBottom: 20,
    width: '100%',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  calTitle: {
    fontSize: 16,
    fontWeight: FONT.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  monthGrid: {
    width: '100%',
    paddingHorizontal: 12,
  },
  calCell: {
    width: '14.28%',
    alignItems: 'center',
    marginBottom: 8,
  },
  monthDot: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
