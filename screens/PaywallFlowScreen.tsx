import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useColors } from '../constants/ThemeContext';
import { useSubscription } from '../constants/SubscriptionContext';
import { PAYWALL_FLOW_STEPS } from './onboarding/OnboardingSteps';

const { width } = Dimensions.get('window');

interface PaywallFlowScreenProps {
  navigation: any;
}

export default function PaywallFlowScreen({ navigation }: PaywallFlowScreenProps) {
  const { colors } = useColors();
  const { hasPremiumAccess } = useSubscription();
  const [step, setStep] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hasPremiumAccess) return;
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      event.preventDefault();
    });
    return unsubscribe;
  }, [hasPremiumAccess, navigation]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: hasPremiumAccess });
  }, [hasPremiumAccess, navigation]);

  useEffect(() => {
    if (hasPremiumAccess) {
      navigation.goBack();
    }
  }, [hasPremiumAccess, navigation]);

  const handleNext = () => {
    if (step < PAYWALL_FLOW_STEPS.length - 1) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -width * 0.3, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start(() => {
        setStep((prev) => prev + 1);
        translateX.setValue(width * 0.3);
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(translateX, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          ]).start();
        }, 50);
      });
      return;
    }
    if (hasPremiumAccess) {
      navigation.goBack();
    }
  };

  const CurrentStepComponent = PAYWALL_FLOW_STEPS[step];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim, transform: [{ translateX }] }]}>
        <CurrentStepComponent onNext={handleNext} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  contentContainer: {
    flex: 1,
  },
});
