import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
} from 'react-native';
import { FONT } from '../constants/theme';

const ITEM_H = 60;
const VISIBLE = 3;

interface TimeWheelProps {
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
  accentColor?: string;
}

export default function TimeWheel({ values, selected, onSelect, accentColor = '#ff8e63' }: TimeWheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const idx = values.indexOf(selected);
  const selectedIndex = idx >= 0 ? idx : 0;

  useEffect(() => {
    if (scrollRef.current && selectedIndex >= 0) {
      scrollRef.current.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }
  }, []);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_H);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: clamped * ITEM_H, animated: true });
    }, 50);
    onSelect(values[clamped]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.mask}>
        <View style={[styles.gradientTop, { backgroundColor: '#0b0b0c' }]} />
        <View style={styles.gradientTopFade} />
        <View style={styles.gradientBotFade} />
        <View style={[styles.gradientBot, { backgroundColor: '#0b0b0c' }]} />
        <View style={[styles.selectedBar, { borderColor: accentColor + '40' }]} />
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
      >
        {values.map((v, i) => {
          const isSelected = i === selectedIndex;
          return (
            <View key={v} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  isSelected && { color: accentColor, fontSize: 22, fontWeight: FONT.bold },
                  !isSelected && { color: 'rgba(255,255,255,0.2)', fontSize: 16 },
                ]}
              >
                {v}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ITEM_H * VISIBLE,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  scroll: {
    flex: 1,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: 'monospace',
  },
  mask: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1,
    pointerEvents: 'none',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    opacity: 0.9,
  },
  gradientTopFade: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    height: ITEM_H - 8,
    backgroundColor: 'rgba(11,11,12,0.85)',
  },
  gradientBotFade: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    height: ITEM_H - 8,
    backgroundColor: 'rgba(11,11,12,0.85)',
  },
  gradientBot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    opacity: 0.9,
  },
  selectedBar: {
    position: 'absolute',
    top: ITEM_H,
    left: 8,
    right: 8,
    height: ITEM_H,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
