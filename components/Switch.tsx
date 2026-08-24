import React, { useEffect, useState } from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import * as Haptics from 'expo-haptics';

interface SwitchProps {
  on: boolean;
  onToggle: () => void;
}

export default function Switch({ on, onToggle }: SwitchProps) {
  const { colors } = useColors();
  const anim = React.useRef(new Animated.Value(on ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: on ? 1 : 0,
      useNativeDriver: true,
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

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleToggle}
      style={[
        styles.track,
        {
          backgroundColor: on ? colors.accSolid : 'rgba(0,0,0,0.08)',
          borderColor: on ? colors.accSolid : 'transparent',
          borderWidth: 1,
        },
      ]}
    >
      <Animated.View
        style={[styles.thumb, { transform: [{ translateX }], backgroundColor: '#fff' }]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 50,
    height: 30,
    borderRadius: 999,
    justifyContent: 'center',
    shadowColor: '#8b6040',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#fff',
    shadowColor: '#8b6040',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
});
