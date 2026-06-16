import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../constants/AuthContext';
import { useSubscription } from '../constants/SubscriptionContext';
import { useColors } from '../constants/ThemeContext';
import AppLoadingScreen from '../components/AppLoadingScreen';

import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import { PAYWALL_START_STEP } from '../screens/onboarding/OnboardingSteps';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AlarmUnlockScreen from '../screens/AlarmUnlockScreen';
import AlarmMissionScreen from '../screens/AlarmMissionScreen';
import CameraScreen from '../screens/CameraScreen';
import SuccessScreen from '../screens/SuccessScreen';
import FailScreen from '../screens/FailScreen';

export type AuthStackParamList = {
  Onboarding: { initialStep?: number } | undefined;
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type MainStackParamList = {
  Home: undefined;
  Settings: undefined;
  AlarmUnlock: { isDaily?: boolean };
  AlarmMission: { isDaily?: boolean };
  Camera: { isDaily?: boolean };
  Success: { isDaily?: boolean };
  Fail: { isDaily?: boolean };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator({ initialStep = 1 }: { initialStep?: number }) {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} initialParams={{ initialStep }} />
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <MainStack.Screen name="Home" component={HomeScreen} />
      <MainStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
      <MainStack.Screen
        name="AlarmUnlock"
        component={AlarmUnlockScreen}
        options={{ animation: 'fade' }}
      />
      <MainStack.Screen
        name="AlarmMission"
        component={AlarmMissionScreen}
        options={{ animation: 'fade' }}
      />
      <MainStack.Screen
        name="Camera"
        component={CameraScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <MainStack.Screen
        name="Success"
        component={SuccessScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <MainStack.Screen
        name="Fail"
        component={FailScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();
  const { loading: subscriptionLoading, hasPremiumAccess } = useSubscription();
  const { colors, initialDataLoading } = useColors();

  if (loading || (session && (subscriptionLoading || (hasPremiumAccess && initialDataLoading)))) {
    return <AppLoadingScreen backgroundColor={colors.bg} indicatorColor={colors.accSolid} />;
  }

  if (session && hasPremiumAccess) {
    return <MainNavigator />;
  }

  return <AuthNavigator initialStep={session ? PAYWALL_START_STEP : 1} />;
}
