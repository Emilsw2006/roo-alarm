import React, { useRef } from 'react';
import { Pressable, Animated, Text, StyleSheet, ViewStyle, TextStyle, View } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import { SIZES, FONT_FAMILY } from '../constants/theme';
import * as Haptics from 'expo-haptics';

interface SquishyButtonProps {
  title?: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  textStyle?: TextStyle;
  shadowColor?: string;
  shadowDepth?: number;
  borderRadius?: number;
  children?: React.ReactNode;
}

export default function SquishyButton({ 
  title, 
  onPress, 
  color, 
  textColor, 
  style, 
  contentStyle,
  textStyle,
  shadowColor = 'rgba(200, 200, 200, 0.4)',
  shadowDepth = 6,
  borderRadius = SIZES.rXl,
  children
}: SquishyButtonProps) {
  const { colors } = useColors();
  const animatedValue = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    Animated.spring(animatedValue, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animatedValue, {
      toValue: 0,
      useNativeDriver: true,
      speed: 30,
      bounciness: 12,
    }).start();
  };

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, shadowDepth]
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96]
  });

  const bgColor = color || colors.surface;
  const txtColor = textColor || colors.text;

  return (
    <Pressable 
      onPressIn={handlePressIn} 
      onPressOut={handlePressOut} 
      onPress={onPress}
      style={[styles.container, style]}
    >
      <Animated.View style={[
        styles.buttonInner,
        {
          backgroundColor: bgColor,
          borderRadius: borderRadius,
          borderBottomWidth: shadowDepth,
          borderBottomColor: shadowColor !== 'transparent' ? shadowColor : 'transparent',
          borderLeftWidth: shadowDepth > 0 ? 1 : 0,
          borderRightWidth: shadowDepth > 0 ? 1 : 0,
          borderTopWidth: shadowDepth > 0 ? 1 : 0,
          borderColor: shadowColor !== 'transparent' ? shadowColor : 'transparent',
          transform: [{ scale }, { translateY }]
        },
        contentStyle
      ]}>
        {title ? <Text style={[styles.buttonText, { color: txtColor }, textStyle]}>{title}</Text> : children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  buttonOuter: {
    width: '100%',
  },
  buttonInner: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    fontFamily: FONT_FAMILY.extraBold,
    fontWeight: '800',
    fontSize: 18,
  }
});
