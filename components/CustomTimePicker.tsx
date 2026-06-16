import React, { useRef, useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, NativeSyntheticEvent, NativeScrollEvent, InteractionManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '../constants/ThemeContext';
import { FONT } from '../constants/theme';

interface CustomTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  itemHeight?: number;
}

export default function CustomTimePicker({ value, onChange, itemHeight = 60 }: CustomTimePickerProps) {
  const { colors } = useColors();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const [selectedHour, setSelectedHour] = useState(value.getHours());
  const [selectedMinute, setSelectedMinute] = useState(value.getMinutes());

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Fallback for Android if contentOffset is ignored on mount
    InteractionManager.runAfterInteractions(() => {
      hourScrollRef.current?.scrollTo({ y: selectedHour * itemHeight, animated: false });
      minuteScrollRef.current?.scrollTo({ y: selectedMinute * itemHeight, animated: false });
    });
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>, type: 'hour' | 'minute') => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemHeight);
    
    if (type === 'hour') {
      const newHour = Math.max(0, Math.min(23, index));
      if (newHour !== selectedHour) {
        Haptics.selectionAsync();
        setSelectedHour(newHour);
        const newDate = new Date(value);
        newDate.setHours(newHour);
        onChange(newDate);
      }
    } else {
      const newMin = Math.max(0, Math.min(59, index));
      if (newMin !== selectedMinute) {
        Haptics.selectionAsync();
        setSelectedMinute(newMin);
        const newDate = new Date(value);
        newDate.setMinutes(newMin);
        onChange(newDate);
      }
    }
  };

  const renderItem = (num: number, isSelected: boolean) => (
    <View key={num} style={{ height: itemHeight, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{
        fontSize: isSelected ? 36 : 28,
        fontWeight: isSelected ? '900' : '600',
        color: isSelected ? colors.accSolid : colors.textDim,
        opacity: isSelected ? 1 : 0.4
      }}>
        {num.toString().padStart(2, '0')}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { height: itemHeight * 3 }]}>
      {/* Selector highlight background */}
      <View style={[styles.highlight, { height: itemHeight, top: itemHeight, backgroundColor: colors.surface }]} />
      
      <View style={styles.columns}>
        <ScrollView
          ref={hourScrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onMomentumScrollEnd={(e) => handleScroll(e, 'hour')}
          contentContainerStyle={{ paddingVertical: itemHeight }}
          contentOffset={{ x: 0, y: selectedHour * itemHeight }}
        >
          {hours.map(h => renderItem(h, h === selectedHour))}
        </ScrollView>

        <View style={{ justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Text style={{ fontSize: 36, fontWeight: '900', color: colors.accSolid, marginBottom: 8 }}>:</Text>
        </View>

        <ScrollView
          ref={minuteScrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onMomentumScrollEnd={(e) => handleScroll(e, 'minute')}
          contentContainerStyle={{ paddingVertical: itemHeight }}
          contentOffset={{ x: 0, y: selectedMinute * itemHeight }}
        >
          {minutes.map(m => renderItem(m, m === selectedMinute))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    width: '100%',
    borderRadius: 16,
  },
  columns: {
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    justifyContent: 'center',
  }
});
