import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FONT, SIZES } from '../constants/theme';
import Icon from '../components/Icon';
import { useLanguage } from '../constants/LanguageContext';

interface WelcomeScreenProps {
  navigation: any;
}

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />

      <View style={styles.top}>
        <View style={styles.logoCircle}>
          <Icon name="clock" size={40} color="#fff" />
        </View>
        <Text style={styles.kicker}>ROO ALARM</Text>
        <Text style={styles.appName}>{t('welcomeTitle')}</Text>
        <Text style={styles.tagline}>{t('welcomeTagline')}</Text>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('SignUp')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{t('createPlan')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.7}
        >
          <Text style={styles.signInText}>{t('onboarding.haveAccount')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: SIZES.pad, backgroundColor: '#FFFFFF' },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#E53935',
    shadowColor: '#E53935',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  kicker: { color: '#E53935', fontSize: 12, fontWeight: FONT.bold },
  appName: { color: '#373737', fontSize: 38, lineHeight: 42, fontWeight: '900', textAlign: 'center' },
  tagline: { color: '#A09E9B', fontSize: 17, fontWeight: FONT.semiBold, textAlign: 'center', lineHeight: 25, maxWidth: 310 },
  bottom: { gap: 12, paddingBottom: 20 },
  primaryBtn: {
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: FONT.bold },
  signInLink: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  signInText: { color: '#A09E9B', fontSize: 14, fontWeight: FONT.bold },
});
