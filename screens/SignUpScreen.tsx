import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../constants/AuthContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT, SIZES } from '../constants/theme';
import Icon from '../components/Icon';
import { AppleIcon, GoogleIcon } from '../components/BrandIcons';

interface SignUpScreenProps {
  navigation: any;
}

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const insets = useSafeAreaInsets();
  const { signUp, signInWithGoogle, signInWithApple } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securePass, setSecurePass] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(emailAnim, {
      toValue: showEmail ? 1 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [showEmail]);

  const handleSignUp = async () => {
    setError(null);
    if (!name.trim()) {
      setError(t('auth.missingName'));
      return;
    }
    if (!email.trim()) {
      setError(t('auth.missingEmail'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.shortPassword'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(email.trim(), password, name.trim());
    if (err) setError(err);
    else navigation.navigate('Login');
    setLoading(false);
  };

  const formHeight = emailAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 398] });
  const formOpacity = emailAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] });
  const formTranslate = emailAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: '#FFFFFF' }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
            <Icon name="chevL" size={22} color="#373737" />
          </TouchableOpacity>

          <View style={styles.hero}>
            <Text style={styles.kicker}>{t('auth.planKicker')}</Text>
            <Text style={styles.title}>{t('auth.planTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.planSubtitle')}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.appleBtn} onPress={signInWithApple} activeOpacity={0.86}>
              <AppleIcon />
              <Text style={styles.appleText} numberOfLines={1}>{t('auth.continueApple')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.googleBtn} onPress={signInWithGoogle} activeOpacity={0.86}>
              <GoogleIcon />
              <Text style={styles.googleText} numberOfLines={1}>{t('auth.continueGoogle')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emailToggle}
              onPress={() => {
                setShowEmail(prev => !prev);
                setError(null);
              }}
              activeOpacity={0.75}
            >
              <Icon name="mail" size={18} color="#E53935" variant="outline" />
              <Text style={styles.emailToggleText} numberOfLines={1}>{t('auth.createEmail')}</Text>
              <Icon name={showEmail ? 'chevDown' : 'chevR'} size={17} color="#A09E9B" />
            </TouchableOpacity>

            <Animated.View style={[styles.emailPanel, { height: formHeight, opacity: formOpacity, transform: [{ translateY: formTranslate }] }]}>
              <View style={styles.form}>
                <Text style={styles.label}>{t('auth.name')}</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('auth.yourName')}
                  placeholderTextColor="rgba(55,55,55,0.32)"
                  autoCapitalize="words"
                />

                <Text style={styles.label}>{t('auth.email')}</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@email.com"
                  placeholderTextColor="rgba(55,55,55,0.32)"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />

                <Text style={styles.label}>{t('auth.password')}</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.inputInner}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('auth.minPassword')}
                    placeholderTextColor="rgba(55,55,55,0.32)"
                    secureTextEntry={securePass}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setSecurePass(!securePass)} activeOpacity={0.7}>
                    <Icon name={securePass ? 'eyeOff' : 'eye'} size={18} color="#A09E9B" variant="outline" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>{t('auth.confirm')}</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.inputInner}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={t('auth.repeatPassword')}
                    placeholderTextColor="rgba(55,55,55,0.32)"
                    secureTextEntry={secureConfirm}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setSecureConfirm(!secureConfirm)} activeOpacity={0.7}>
                    <Icon name={secureConfirm ? 'eyeOff' : 'eye'} size={18} color="#A09E9B" variant="outline" />
                  </TouchableOpacity>
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.primaryBtn, { opacity: loading ? 0.68 : 1 }]}
                  onPress={handleSignUp}
                  disabled={loading}
                  activeOpacity={0.86}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('auth.createAccount')}</Text>}
                </TouchableOpacity>
              </View>
            </Animated.View>

            <TouchableOpacity style={styles.switchBtn} onPress={() => navigation.replace('Login')} activeOpacity={0.75}>
              <Text style={styles.switchText}>
                {t('auth.alreadyAccount')} <Text style={styles.switchStrong}>{t('auth.signIn')}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: SIZES.pad },
  backBtn: { marginTop: 14, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F7' },
  hero: { paddingTop: 36, paddingBottom: 28 },
  kicker: { color: '#E53935', fontSize: 12, fontWeight: FONT.bold, marginBottom: 12 },
  title: { color: '#373737', fontSize: 38, lineHeight: 42, fontWeight: '900', marginBottom: 12 },
  subtitle: { color: '#A09E9B', fontSize: 17, lineHeight: 25, fontWeight: FONT.semiBold },
  actions: { gap: 12 },
  appleBtn: { height: 58, borderRadius: 18, backgroundColor: '#050505', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  appleText: { color: '#FFFFFF', fontSize: 17, fontWeight: FONT.bold },
  googleBtn: { height: 58, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E9E6DF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  googleText: { color: '#373737', fontSize: 17, fontWeight: FONT.bold },
  emailToggle: { height: 52, borderRadius: 16, backgroundColor: '#FFF8F8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 2 },
  emailToggleText: { color: '#E53935', fontSize: 16, fontWeight: FONT.bold },
  emailPanel: { overflow: 'hidden' },
  form: { paddingTop: 8, gap: 10 },
  label: { color: '#A09E9B', fontSize: 11, fontWeight: FONT.bold, marginTop: 3 },
  input: { height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: '#E9E6DF', backgroundColor: '#FFFFFF', paddingHorizontal: 16, fontSize: 16, color: '#373737', fontWeight: FONT.semiBold },
  inputWrap: { height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: '#E9E6DF', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  inputInner: { flex: 1, fontSize: 16, color: '#373737', fontWeight: FONT.semiBold, paddingRight: 12 },
  errorText: { color: '#E53935', fontSize: 13, fontWeight: FONT.semiBold, textAlign: 'center' },
  primaryBtn: { height: 54, borderRadius: 17, backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: FONT.bold },
  switchBtn: { alignItems: 'center', paddingVertical: 18 },
  switchText: { color: '#A09E9B', fontSize: 15, fontWeight: FONT.semiBold },
  switchStrong: { color: '#373737', fontWeight: FONT.bold },
});
