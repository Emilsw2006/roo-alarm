import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated, LayoutChangeEvent, Vibration } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import { FONT } from '../constants/theme';
import Icon from './Icon';

interface SwipeBeginProps {
  onComplete: () => void;
  label?: string;
  color?: string;
  iconColor?: string;
}

export default function SwipeBegin({ onComplete, label = 'Swipe to begin', color, iconColor }: SwipeBeginProps) {
  const { colors } = useColors();
  const pan = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const maxSwipe = trackWidth - 62; // 54 thumb size + 4 padding on each side = 62

  const panResponder = React.useMemo(() => 
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (maxSwipe > 0) {
          const val = Math.max(0, Math.min(maxSwipe, gestureState.dx));
          pan.setValue(val);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (maxSwipe > 0 && gestureState.dx > maxSwipe * 0.7) {
          Vibration.vibrate(50); // Feedback al soltar para completar
          Animated.timing(pan, {
            toValue: maxSwipe,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            onComplete();
          });
        } else {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 5,
          }).start();
        }
      },
    }), [maxSwipe, onComplete]
  );

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  // Interpolate opacity of label text
  const labelOpacity = pan.interpolate({
    inputRange: [0, maxSwipe > 0 ? maxSwipe * 0.6 : 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.track, { borderColor: color || 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' }]} onLayout={onLayout}>
      <Animated.View style={[styles.labelContainer, { opacity: labelOpacity }]}>
        <Text style={[styles.label, { color: color || 'rgba(255,255,255,0.4)' }]}>{label}</Text>
        <Icon name="chevR" size={16} color={color || 'rgba(255,255,255,0.4)'} />
      </Animated.View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.thumb,
          {
            backgroundColor: '#ff2d55', // Mejor rojo (vibrante)
            transform: [{ translateX: pan }],
            shadowColor: '#ff2d55',
            shadowOpacity: 0.4,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          },
        ]}
      >
        <Icon name="arrowR" size={24} color={iconColor || '#fff'} stroke={2.5} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 70, // un poco más alto para mejor grip
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  labelContainer: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: FONT.medium,
  },
  thumb: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
});
