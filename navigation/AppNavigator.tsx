import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColors } from '../constants/ThemeContext';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { useAuthNavigationState } from '../hooks/useAuthNavigationState';
import { usePendingAlarmRoute } from '../hooks/usePendingAlarmRoute';

import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import PaywallFlowScreen from '../screens/PaywallFlowScreen';
import AlarmUnlockScreen from '../screens/AlarmUnlockScreen';
import AlarmMissionScreen from '../screens/AlarmMissionScreen';
import CameraScreen from '../screens/CameraScreen';
import SuccessScreen from '../screens/SuccessScreen';
import FailScreen from '../screens/FailScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Onboarding: { initialStep?: number } | undefined;
  Login: { fromOnboarding?: boolean; existingAccount?: boolean; resumePaywall?: boolean } | undefined;
  SignUp: { fromOnboarding?: boolean } | undefined;
  ForgotPassword: undefined;
};

export type MainStackParamList = {
  Home: { completedDaily?: boolean; failedDaily?: boolean } | undefined;
  Settings: undefined;
  Subscription: undefined;
  Paywall: undefined;
  AlarmUnlock: { isDaily?: boolean; alarm?: import('../constants/data').Alarm };
  AlarmMission: { isDaily?: boolean; alarm?: import('../constants/data').Alarm; fromAlarmKit?: boolean };
  Camera: { isDaily?: boolean; alarm?: import('../constants/data').Alarm; missionExpiresAt?: number };
  Success: { isDaily?: boolean; alarm?: import('../constants/data').Alarm };
  Fail: { isDaily?: boolean };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator({
  initialRoute = 'Onboarding',
  initialStep = 1,
}: {
  initialRoute?: keyof Pick<AuthStackParamList, 'Onboarding'>;
  initialStep?: number;
}) {
  return (
    <AuthStack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <AuthStack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        initialParams={{ initialStep }}
      />
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
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <MainStack.Screen
        name="Paywall"
        component={PaywallFlowScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: false,
        }}
      />
      <MainStack.Screen
        name="AlarmUnlock"
        component={AlarmUnlockScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: false,
          contentStyle: { backgroundColor: '#000000' },
        }}
      />
      <MainStack.Screen
        name="AlarmMission"
        component={AlarmMissionScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: false,
          contentStyle: { backgroundColor: '#000000' },
        }}
      />
      <MainStack.Screen
        name="Camera"
        component={CameraScreen}
        options={{ animation: 'fade', gestureEnabled: false, contentStyle: { backgroundColor: '#000000' } }}
      />
      <MainStack.Screen
        name="Success"
        component={SuccessScreen}
        options={{ animation: 'fade', gestureEnabled: false, contentStyle: { backgroundColor: '#ffffff' } }}
      />
      <MainStack.Screen
        name="Fail"
        component={FailScreen}
        options={{ animation: 'fade', gestureEnabled: false, contentStyle: { backgroundColor: '#ffffff' } }}
      />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { colors } = useColors();
  const {
    loading,
    session,
    showMain,
    authInitialRoute,
    authInitialStep,
  } = useAuthNavigationState();
  const { pendingAlarm } = usePendingAlarmRoute();
  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => setForceReady(true), 2500);
    return () => clearTimeout(timeoutId);
  }, []);

  const showMainForAlarm = !!session?.user && pendingAlarm;
  const shouldShowMain = showMain || showMainForAlarm;

  if (loading && (!forceReady || !!session?.user?.id)) {
    return <AppLoadingScreen backgroundColor={colors.bg} indicatorColor={colors.accSolid} />;
  }

  if (shouldShowMain) {
    return <MainNavigator />;
  }

  return (
    <AuthNavigator
      key={`${session?.user?.id ?? 'guest'}-${authInitialRoute}-${authInitialStep}`}
      initialRoute={authInitialRoute}
      initialStep={authInitialStep}
    />
  );
}
