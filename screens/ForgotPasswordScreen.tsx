import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../constants/ThemeContext';
import { useAuth } from '../constants/AuthContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT, SIZES } from '../constants/theme';
import Icon from '../components/Icon';

interface ForgotPasswordScreenProps {
  navigation: any;
}

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useColors();
  const { resetPassword } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setError(null);
    if (!email.trim()) {
      setError(t('auth.resetMissing'));
      return;
    }
    setLoading(true);
    const { error: err } = await resetPassword(email.trim());
    if (err) {
      setError(err);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.gradientBottom]}
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={[styles.content, { paddingHorizontal: SIZES.pad }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevL" size={22} color={colors.text} />
          </TouchableOpacity>

          {success ? (
            <View style={styles.successWrap}>
              <View style={[styles.successIcon, { backgroundColor: colors.green }]}>
                <Icon name="check" size={32} color="#fff" />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{t('auth.resetCheck')}</Text>
              <Text style={[styles.subtitle, { color: colors.textDim, textAlign: 'center' }]}>
                {t('auth.resetSent', { email })}
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.accSolid }]}
                onPress={() => navigation.navigate('Login', { existingAccount: true })}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>{t('auth.resetBack')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formWrap}>
              <Text style={[styles.title, { color: colors.text }]}>{t('auth.resetTitle')}</Text>
              <Text style={[styles.subtitle, { color: colors.textDim }]}>
                {t('auth.resetBody')}
              </Text>

              <Text style={[styles.label, { color: colors.textFaint }]}>{t('auth.email')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.hairline }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.accSolid, opacity: loading ? 0.7 : 1 }]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('auth.resetSend')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1 },
  backBtn: { marginTop: 16, marginBottom: 24, width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: FONT.bold, marginBottom: 6 },
  subtitle: { fontSize: 15, fontWeight: FONT.medium, marginBottom: 32 },
  label: { fontSize: 11, fontWeight: FONT.bold, letterSpacing: 1.5, marginTop: 8 },
  input: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  errorText: { color: '#E53935', fontSize: 13, fontWeight: FONT.medium, textAlign: 'center', marginTop: 8 },
  primaryBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: FONT.bold },
  formWrap: { flex: 1, justifyContent: 'center', paddingBottom: 80 },
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80, gap: 16 },
  successIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
