import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, SafeAreaView, Easing, TouchableOpacity, Dimensions, BackHandler } from 'react-native';
import { useColors } from '../../constants/ThemeContext';
import { ONBOARDING_STEPS } from './OnboardingSteps';
import Icon from '../../components/Icon';
import LanguageFlagButton from '../../components/LanguageFlagButton';

const { width } = Dimensions.get('window');

export default function OnboardingScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { colors } = useColors();
  const initialStep = Math.min(route?.params?.initialStep ?? 1, ONBOARDING_STEPS.length - 1);
  const [step, setStep] = useState(initialStep);
  
  // Animación de la barra de progreso superior
  const progressAnim = useRef(new Animated.Value(0)).current;
  // Animación de transición entre pantallas (slide horizontal)
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const processingStepIndex = ONBOARDING_STEPS.findIndex(Component => Component.name === 'Step29_Processing');
  const isLockedProcessingStep = step === processingStepIndex;

  useEffect(() => {
    // Animar la barra de progreso
    Animated.timing(progressAnim, {
      toValue: step / (ONBOARDING_STEPS.length - 1),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step]);

  useEffect(() => {
    if (!isLockedProcessingStep) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [isLockedProcessingStep]);

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
    } else {
      navigation.navigate('Welcome');
    }
  };

  const handleBack = () => {
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
      {!isLockedProcessingStep && (
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

      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim, transform: [{ translateX }] }]}>
        <CurrentStepComponent onNext={handleNext} onSignIn={() => navigation.navigate('Login')} />
      </Animated.View>

      {step === initialStep && initialStep <= 1 && <LanguageFlagButton />}
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
  }
});
