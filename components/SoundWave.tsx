import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface SoundWaveProps {
  color: string;
}

export default function SoundWave({ color }: SoundWaveProps) {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.8)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animateBar = (val: Animated.Value, duration: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration, useNativeDriver: true }),
        ])
      ).start();
    };

    animateBar(bar1, 400);
    animateBar(bar2, 300);
    animateBar(bar3, 500);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.bar, { backgroundColor: color, transform: [{ scaleY: bar1 }] }]} />
      <Animated.View style={[styles.bar, { backgroundColor: color, transform: [{ scaleY: bar2 }] }]} />
      <Animated.View style={[styles.bar, { backgroundColor: color, transform: [{ scaleY: bar3 }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 14,
    height: 14,
  },
  bar: {
    width: 3,
    height: '100%',
    borderRadius: 2,
  }
});
