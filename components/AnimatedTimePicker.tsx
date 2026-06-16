import React, { useRef, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Animated, NativeSyntheticEvent, NativeScrollEvent, TouchableOpacity } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import { FONT } from '../constants/theme';
import * as Haptics from 'expo-haptics';

const ITEM_HEIGHT = 64;
const REPEAT_COUNT = 150; // Big array for infinite scrolling

interface AnimatedTimePickerProps {
  values: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  accentColor?: string;
}

export default function AnimatedTimePicker({ values, selectedValue, onSelect, accentColor = '#b8704e' }: AnimatedTimePickerProps) {
  const { colors } = useColors();
  const dimColor = colors.isDark ? '#ffffff' : '#2c2420';
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<any>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  
  const repeatedValues = useMemo(() => Array(REPEAT_COUNT).fill(values).flat(), [values]);
  const paddedValues = useMemo(() => ['', ...repeatedValues, ''], [repeatedValues]);
  
  const baseIndex = values.indexOf(selectedValue) >= 0 ? values.indexOf(selectedValue) : 0;
  const initialIndex = Math.floor(REPEAT_COUNT / 2) * values.length + baseIndex;

  useEffect(() => {
    let lastIndex = initialIndex;
    const listener = scrollY.addListener(({ value }) => {
      const index = Math.round(value / ITEM_HEIGHT);
      if (index !== lastIndex && index >= 0 && index < repeatedValues.length) {
        lastIndex = index;
        try { Haptics.selectionAsync(); } catch (e) {}
      }
    });
    return () => scrollY.removeListener(listener);
  }, [initialIndex, repeatedValues.length]);

  const hasJumped = useRef(false);

  // When layout is ready, jump to the middle without animation
  useEffect(() => {
    if (isLayoutReady && flatListRef.current && initialIndex >= 0 && !hasJumped.current) {
      hasJumped.current = true;
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: initialIndex * ITEM_HEIGHT, animated: false });
      }, 50);
    }
  }, [isLayoutReady]);

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    if (index >= 0 && index < repeatedValues.length) {
      onSelect(repeatedValues[index]);
    }
  };

  const handleItemPress = (idx: number) => {
    if (idx === 0 || idx === paddedValues.length - 1) return;
    const scrollIndex = idx - 1;
    flatListRef.current?.scrollToOffset({ offset: scrollIndex * ITEM_HEIGHT, animated: true });
    onSelect(repeatedValues[scrollIndex]);
  };

  const renderItem = ({ item, index }: { item: string, index: number }) => {
    if (item === '') {
      return <View style={{ height: ITEM_HEIGHT }} />;
    }

    const position = (index - 1) * ITEM_HEIGHT;

    const inputRange = [
      position - ITEM_HEIGHT * 2,
      position - ITEM_HEIGHT,
      position,
      position + ITEM_HEIGHT,
      position + ITEM_HEIGHT * 2,
    ];

    const scale = scrollY.interpolate({
      inputRange,
      outputRange: [0.6, 0.8, 1.25, 0.8, 0.6],
      extrapolate: 'clamp',
    });

    const colorOpacity = scrollY.interpolate({
      inputRange: [position - ITEM_HEIGHT / 2, position, position + ITEM_HEIGHT / 2],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });

    const whiteOpacity = scrollY.interpolate({
      inputRange,
      outputRange: [0.1, 0.4, 0, 0.4, 0.1],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={() => handleItemPress(index)}
        style={styles.itemContainer}
      >
        <Animated.Text style={[styles.itemText, { opacity: whiteOpacity, transform: [{ scale }], color: dimColor }]}>
          {item}
        </Animated.Text>
        
        <Animated.Text style={[styles.itemText, { position: 'absolute', opacity: colorOpacity, transform: [{ scale }], color: accentColor }]}>
          {item}
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={paddedValues}
        nestedScrollEnabled={true}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="normal"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        windowSize={5}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        onLayout={() => setIsLayoutReady(true)}
        style={{ opacity: isLayoutReady ? 1 : 0 }}
      />
      <View style={styles.centerHighlight} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT * 3,
    overflow: 'hidden',
    position: 'relative',
    width: 86,
  },
  itemContainer: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontFamily: 'monospace',
    fontSize: 26,
    fontWeight: FONT.bold,
  },
  centerHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: '50%',
    marginLeft: -36,
    width: 72,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
  },
});
