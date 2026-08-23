import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, SafeAreaView, Easing, TouchableOpacity, Dimensions, BackHandler, Text, ActivityIndicator, Alert } from 'react-native';
import { useColors } from '../../constants/ThemeContext';
import { useSubscription } from '../../constants/SubscriptionContext';
import { useAuth } from '../../constants/AuthContext';
import { useOnboarding } from '../../constants/OnboardingContext';
import { ONBOARDING_STEPS, FIRST_ONBOARDING_STEP, PAYWALL_START_STEP, DIRECT_PAYWALL_STEP } from './OnboardingSteps';
import { requestAuthNavigationRefresh } from '../../lib/authNavigationRefresh';
import { fetchSubscriptionFromSupabase } from '../../lib/subscriptionSupabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../../components/Icon';
import LanguageFlagButton from '../../components/LanguageFlagButton';
import { FONT_FAMILY } from '../../constants/theme';

const { width } = Dimensions.get('window');
const premiumFlagKey = (userId: string) => `rooalarm.premium.${userId}`;

export default function OnboardingScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { colors } = useColors();
  const { hasPremiumAccess, grantDevScreenshotAccess } = useSubscription();
  const { session, signOut } = useAuth();
  const { resetData } = useOnboarding();
  const initialStep = Math.min(route?.params?.initialStep ?? FIRST_ONBOARDING_STEP, ONBOARDING_STEPS.length - 1);
  const [step, setStep] = useState(initialStep);

  useEffect(() => {
    const nextStep = Math.min(route?.params?.initialStep ?? FIRST_ONBOARDING_STEP, ONBOARDING_STEPS.length - 1);
    setStep(nextStep);
  }, [route?.params?.initialStep]);
  
  // Animación de la barra de progreso superior
  const progressAnim = useRef(new Animated.Value(0)).current;
  // Animación de transición entre pantallas (slide horizontal)
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const processingStepIndex = ONBOARDING_STEPS.findIndex(Component => Component.name === 'Step29_Processing');
  const isLockedProcessingStep = step === processingStepIndex;
  const isPaywallStep = step >= PAYWALL_START_STEP;
  const isFinalPaywallStep = step === DIRECT_PAYWALL_STEP;

  const goToLoginForPaywall = () => {
    navigation.navigate('Login', { existingAccount: true, resumePaywall: true });
  };

  const goToLogin = () => {
    navigation.navigate('Login', { existingAccount: true });
  };

  const handlePaywallDismiss = () => {
    setStep(PAYWALL_START_STEP);
  };

  const handleSignOutSession = async () => {
    const userId = session?.user?.id;
    if (userId) {
      const [localFlag, dbSub] = await Promise.all([
        AsyncStorage.getItem(premiumFlagKey(userId)),
        fetchSubscriptionFromSupabase(userId),
      ]);
      const isSubscribed =
        hasPremiumAccess || localFlag === '1' || dbSub?.is_subscribed === true;
      if (isSubscribed) {
        requestAuthNavigationRefresh();
        return;
      }
    }

    resetData();
    setStep(FIRST_ONBOARDING_STEP);
    await signOut();
    requestAuthNavigationRefresh();
  };


  useEffect(() => {
    if (!isPaywallStep || hasPremiumAccess || isFinalPaywallStep) return;
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      event.preventDefault();
    });
    return unsubscribe;
  }, [hasPremiumAccess, isFinalPaywallStep, isPaywallStep, navigation]);

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !isPaywallStep && !isLockedProcessingStep,
    });
  }, [isLockedProcessingStep, isPaywallStep, navigation]);

  useEffect(() => {
    // Animar la barra de progreso
    Animated.timing(progressAnim, {
      toValue: step / (ONBOARDING_STEPS.length - 1),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step]);

  useEffect(() => {
    if (!isLockedProcessingStep && !isPaywallStep) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [isLockedProcessingStep, isPaywallStep]);

  const handleNext = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      // Salida hacia la izquierda
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -width * 0.3, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true })
      ]).start(() => {
        setStep(prev => prev + 1);
        // Prepara entrada desde la derecha
        translateX.setValue(width * 0.3);
        
        // Da un respiro a React para montar componentes pesados (ej: DateTimePicker) antes de animar
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(translateX, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true })
          ]).start();
        }, 50);
      });
    }
  };

  const handleBack = () => {
    if (step >= PAYWALL_START_STEP) return;
    if (step > initialStep) {
      // Salida hacia la derecha
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: width * 0.3, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true })
      ]).start(() => {
        setStep(prev => prev - 1);
        // Prepara entrada desde la izquierda
        translateX.setValue(-width * 0.3);
        
        // Da un respiro a React para montar componentes pesados antes de animar
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(translateX, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true })
          ]).start();
        }, 50);
      });
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const CurrentStepComponent = ONBOARDING_STEPS[step];

  // Calculamos el width de la barra de progreso
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      {!isLockedProcessingStep && !isPaywallStep && (
        <View style={[styles.header, { paddingTop: 34 }]}>
          {step > initialStep ? (
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Icon name="arrowL" size={20} color={colors.textDim} stroke={3} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40, height: 40 }} />
          )}
          {step > 1 && (
            <View style={styles.progressBarContainer}>
              <Animated.View style={[styles.progressBarFill, { width: progressWidth, backgroundColor: colors.accSolid }]} />
            </View>
          )}
        </View>
      )}

      <Animated.View key={step} style={[styles.contentContainer, { opacity: fadeAnim, transform: [{ translateX }] }]}>
        <CurrentStepComponent
          onNext={handleNext}
          onSignUp={() => navigation.navigate('SignUp', { fromOnboarding: true })}
          onSignIn={isPaywallStep ? goToLoginForPaywall : goToLogin}
          onDismiss={isFinalPaywallStep && !hasPremiumAccess ? handlePaywallDismiss : undefined}
          onSignOutSession={step === PAYWALL_START_STEP && session ? handleSignOutSession : undefined}
          onRestartOnboarding={isPaywallStep ? () => {
            resetData();
            setStep(FIRST_ONBOARDING_STEP);
          } : undefined}
        />
      </Animated.View>

      {step === initialStep && initialStep <= FIRST_ONBOARDING_STEP && <LanguageFlagButton />}


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32, // increased from 16 so the progress bar doesn't touch the top edge
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  progressBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  contentContainer: {
    flex: 1,
  },
});
