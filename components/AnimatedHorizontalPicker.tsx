import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, FlatList, NativeSyntheticEvent, NativeScrollEvent, Dimensions } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
// Leave padding on sides so center is centered
const SIDE_PADDING = (SCREEN_W - 40) / 2;

interface AnimatedHorizontalPickerProps<T> {
  data: T[];
  selectedValue: string;
  onSelect: (value: string) => void;
  keyExtractor: (item: T) => string;
  renderItemContent: (item: T, isSelected: boolean) => React.ReactNode;
  itemWidth?: number;
}

export default function AnimatedHorizontalPicker<T>({ 
  data, 
  selectedValue, 
  onSelect, 
  keyExtractor, 
  renderItemContent,
  itemWidth = 140 
}: AnimatedHorizontalPickerProps<T>) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  
  const paddedData = [null, ...data, null]; // Add nulls for padding at start and end
  
  const initialIndex = data.findIndex(item => keyExtractor(item) === selectedValue);

  useEffect(() => {
    if (flatListRef.current && initialIndex >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: initialIndex * itemWidth, animated: false });
      }, 50);
    }
  }, [initialIndex, itemWidth]);

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / itemWidth);
    if (index >= 0 && index < data.length) {
      onSelect(keyExtractor(data[index]));
    }
  };

  const renderItem = ({ item, index }: { item: T | null, index: number }) => {
    if (item === null) {
      // Return a spacer
      return <View style={{ width: (SCREEN_W - 40 - itemWidth) / 2 }} />;
    }

    const position = (index - 1) * itemWidth;

    const inputRange = [
      position - itemWidth * 1.5,
      position - itemWidth,
      position,
      position + itemWidth,
      position + itemWidth * 1.5,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.7, 0.85, 1.1, 0.85, 0.7],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.2, 0.5, 1, 0.5, 0.2],
      extrapolate: 'clamp',
    });

    // Determine if it's currently selected to pass to renderItemContent (for colors)
    // We can't know perfectly synchronously during scroll via state, but we can pass a boolean for initialization
    const isSelected = keyExtractor(item) === selectedValue;

    return (
      <View style={{ width: itemWidth, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ opacity, transform: [{ scale }], width: '100%', alignItems: 'center' }}>
          {renderItemContent(item, isSelected)}
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef as any}
        data={paddedData as any}
        keyExtractor={(item: any, index) => item ? keyExtractor(item) : `pad-${index}`}
        renderItem={renderItem as any}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
        decelerationRate="fast"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        contentContainerStyle={{ alignItems: 'center' }}
      />
      {/* Center Indicator (Subtle highlight) */}
      <View style={[styles.centerIndicator, { width: itemWidth }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 120, // tall enough to fit scaled items
    justifyContent: 'center',
    marginVertical: 10,
  },
  centerIndicator: {
    position: 'absolute',
    height: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    zIndex: -1, // behind the items
  }
});
