import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useColors } from '../constants/ThemeContext';

interface ParticleExplosionProps {
  visible: boolean;
  onComplete?: () => void;
}

export default function ParticleExplosion({ visible, onComplete }: ParticleExplosionProps) {
  const { colors } = useColors();
  const particles = useRef([...Array(10)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel(
        particles.map((p) =>
          Animated.timing(p, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          })
        )
      ).start(() => {
        particles.forEach((p) => p.setValue(0));
        if (onComplete) onComplete();
      });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const angle = (i * 360) / particles.length;
        const rad = (angle * Math.PI) / 180;
        const distance = 80 + Math.random() * 40;
        
        const translateX = p.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(rad) * distance],
        });
        
        const translateY = p.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(rad) * distance],
        });

        const scale = p.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0, 1, 0],
        });

        const size = i % 2 === 0 ? 12 : 8;
        const color = i % 3 === 0 ? colors.accSolid : colors.brandOrange || '#FFA000';

        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                transform: [{ translateX }, { translateY }, { scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -6,
    marginLeft: -6,
  },
});
