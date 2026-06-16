import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, View } from 'react-native';

interface AppLoadingScreenProps {
  backgroundColor?: string;
  indicatorColor?: string;
}

export default function AppLoadingScreen({
  backgroundColor = '#FFFFFF',
  indicatorColor = '#E53935',
}: AppLoadingScreenProps) {
  const pulse = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 760, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.96, duration: 760, useNativeDriver: true }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <Animated.View style={[styles.logoWrap, { transform: [{ scale: pulse }] }]}>
        <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <ActivityIndicator size="large" color={indicatorColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  logoWrap: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});
