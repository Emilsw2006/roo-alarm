import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface AppLoadingScreenProps {
  backgroundColor?: string;
  indicatorColor?: string;
}

export default function AppLoadingScreen({
  backgroundColor = '#FFFFFF',
}: AppLoadingScreenProps) {
  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <View style={styles.logoClip}>
        <Image source={require('../assets/logo.jpeg')} style={styles.logo} resizeMode="cover" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoClip: {
    width: 132,
    height: 132,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFEBE4',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});
