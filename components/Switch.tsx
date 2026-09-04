import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import * as Haptics from 'expo-haptics';

interface SwitchProps {
  on: boolean;
  onToggle: () => void;
  trackColor?: { false?: string; true?: string };
}

export default function Switch({ on, onToggle, trackColor }: SwitchProps) {
  const { colors } = useColors();
  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: on ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 100,
    }).start();
  }, [on]);

  const handleToggle = () => {
    Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    onToggle();
  };

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 23],
  });

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      trackColor?.false || colors.surface2 || '#E5E5EA',
      trackColor?.true || colors.accSolid,
    ],
  });

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.hairline2 || 'rgba(0,0,0,0.12)', trackColor?.true || colors.accSolid],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handleToggle}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor,
            borderColor,
            borderWidth: 1.5,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX }],
              backgroundColor: '#FFFFFF',
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 50,
    height: 30,
    borderRadius: 999,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
