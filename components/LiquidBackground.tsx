import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../constants/ThemeContext';

const { width, height } = Dimensions.get('window');

interface LiquidBackgroundProps {
  children: React.ReactNode;
  style?: any;
}

export default function LiquidBackground({ children, style }: LiquidBackgroundProps) {
  const { colors } = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }, style]}>
      <LinearGradient
        colors={[colors.gradientTop, colors.gradientBottom]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Top right blob */}
      <View
        style={[
          styles.blob,
          {
            top: -height * 0.1,
            right: -width * 0.3,
            width: width * 0.9,
            height: width * 0.9,
            borderRadius: width * 0.45,
            backgroundColor: colors.accSolid,
            opacity: 0.15,
          },
        ]}
      />
      
      {/* Bottom left blob */}
      <View
        style={[
          styles.blob,
          {
            bottom: -height * 0.05,
            left: -width * 0.2,
            width: width * 0.7,
            height: width * 0.7,
            borderRadius: width * 0.35,
            backgroundColor: colors.accGlow,
            opacity: 0.3,
          },
        ]}
      />

      {/* Center right blob (optional, for more depth) */}
      <View
        style={[
          styles.blob,
          {
            top: height * 0.4,
            right: -width * 0.2,
            width: width * 0.6,
            height: width * 0.6,
            borderRadius: width * 0.3,
            backgroundColor: colors.green,
            opacity: 0.08,
          },
        ]}
      />

      <BlurView
        intensity={90}
        tint={colors.isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        experimentalBlurMethod="dimezisBlurView"
      />

      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
  },
  content: {
    flex: 1,
  },
});
