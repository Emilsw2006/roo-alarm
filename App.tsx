import { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { ThemeProvider } from './constants/ThemeContext';
import { LanguageProvider } from './constants/LanguageContext';
import { AuthProvider, useAuth } from './constants/AuthContext';
import { OnboardingProvider } from './constants/OnboardingContext';
import { SubscriptionProvider } from './constants/SubscriptionContext';
import AppNavigator from './navigation/AppNavigator';
import { LogBox, Platform, AppState, Alert, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppLoadingScreen from './components/AppLoadingScreen';
import { useAlarmKitLaunchNavigation } from './hooks/useAlarmKitLaunchNavigation';
import { useOnboardingPersistence } from './hooks/useOnboardingPersistence';
import { useGlobalAlarmTrigger } from './hooks/useGlobalAlarmTrigger';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { configureAlarmNotifications, capturePendingAlarmLaunch, requestAlarmPermissions, refreshUserAlarmSchedules, getAlarmKitStatus, ensureAlarmKitAuthorized } from './lib/alarmScheduler';
import { useMainAppReady } from './constants/MainAppReadyContext';

export const navigationRef = createNavigationContainerRef<any>();

LogBox.ignoreLogs([
  'VirtualizedLists should never be nested inside plain ScrollViews',
  '[expo-av]: Expo AV has been deprecated',
  'Error configuring Purchases',
  '[RevenueCat]',
  'Network request failed',
  'TypeError: Network request failed',
]);

const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && (args[0].includes('VirtualizedLists') || args[0].includes('expo-av'))) return;
  originalWarn(...args);
};

const originalError = console.error;
console.error = (...args) => {
  const first = typeof args[0] === 'string' ? args[0] : (args[0]?.message ?? '');
  if (
    first.includes('VirtualizedLists') ||
    first.includes('Error configuring Purchases') ||
    first.includes('Invalid API key') ||
    first.includes('[RevenueCat]') ||
    first.includes('Network request failed')
  ) {
    return;
  }
  originalError(...args);
};

function AlarmPermissionsBridge() {
  const { session } = useAuth();
  useEffect(() => {
    if (!session?.user) return;
    if (Platform.OS !== 'ios') {
      requestAlarmPermissions().catch(() => {});
      return;
    }

    const checkAndPrompt = async () => {
      // First ensure base notification permissions
      await requestAlarmPermissions().catch(() => {});

      // Then check AlarmKit specifically
      const status = await getAlarmKitStatus().catch(() => null);
      if (!status?.available) return; // iOS < 26 or Simulator, nothing to do

      if (status.authorized) return; // Already granted ✅

      if (status.authorization === 'denied') {
        // User previously denied — offer to go to Settings
        Alert.alert(
          '🔔 Activa las Alarmas',
          'Roo Alarm necesita permiso de Alarmas para que tu alarma suene aunque el teléfono esté en silencio. Ve a Ajustes para activarlo.',
          [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      // notDetermined — ask directly with system dialog
      const result = await ensureAlarmKitAuthorized().catch(() => 'unsupported' as const);
      if (result === 'denied') {
        Alert.alert(
          '🔔 Permiso denegado',
          'Sin el permiso de Alarmas, Roo Alarm no podrá despertarte. Puedes activarlo en Ajustes → Roo Alarm → Alarmas.',
          [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
          ]
        );
      }
    };

    void checkAndPrompt();
  }, [session?.user?.id]);
  return null;
}

function AlarmForegroundSyncBridge() {
  const { session } = useAuth();
  const mainReady = useMainAppReady();
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !mainReady) return;

    const sync = () => {
      void refreshUserAlarmSchedules(userId).catch((err) => {
        console.warn('[RooAlarm] Foreground alarm sync failed', err);
      });
    };

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });

    return () => subscription.remove();
  }, [session?.user?.id, mainReady]);
  return null;
}

function OnboardingPersistenceBridge() {
  useOnboardingPersistence();
  return null;
}

function GlobalAlarmBridge() {
  const { session } = useAuth();
  const mainReady = useMainAppReady();
  const alarmFlowEnabled = !!session?.user && mainReady;
  useGlobalAlarmTrigger(navigationRef, session?.user?.id ?? null, alarmFlowEnabled);
  return null;
}

function AlarmKitLaunchBridge() {
  const { session } = useAuth();
  const mainReady = useMainAppReady();
  const alarmFlowEnabled = !!session?.user && mainReady;
  useAlarmKitLaunchNavigation(
    navigationRef,
    Platform.OS === 'ios',
    session?.user?.id ?? null,
    alarmFlowEnabled
  );
  return null;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    configureAlarmNotifications().catch(() => {});
    if (Platform.OS === 'ios') {
      capturePendingAlarmLaunch().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      setFontsReady(true);
      return;
    }
    const timeoutId = setTimeout(() => setFontsReady(true), 1200);
    return () => clearTimeout(timeoutId);
  }, [fontsLoaded]);

  if (!fontsReady) {
    return <AppLoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <ThemeProvider>
              <OnboardingProvider>
                <NavigationContainer ref={navigationRef}>
                  <OnboardingPersistenceBridge />
                  <AlarmPermissionsBridge />
                  <AlarmForegroundSyncBridge />
                  <GlobalAlarmBridge />
                  <AlarmKitLaunchBridge />
                  <AppNavigator />
                </NavigationContainer>
              </OnboardingProvider>
            </ThemeProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
