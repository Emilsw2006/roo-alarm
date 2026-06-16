import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from './constants/ThemeContext';
import { LanguageProvider } from './constants/LanguageContext';
import { AuthProvider } from './constants/AuthContext';
import { OnboardingProvider } from './constants/OnboardingContext';
import { SubscriptionProvider } from './constants/SubscriptionContext';
import AppNavigator from './navigation/AppNavigator';
import { LogBox } from 'react-native';
import AppLoadingScreen from './components/AppLoadingScreen';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested inside plain ScrollViews',
  '[expo-av]: Expo AV has been deprecated',
]);

const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && (args[0].includes('VirtualizedLists') || args[0].includes('expo-av'))) return;
  originalWarn(...args);
};

const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('VirtualizedLists')) return;
  originalError(...args);
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  if (!fontsLoaded) {
    return <AppLoadingScreen />;
  }

  return (
    <LanguageProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <ThemeProvider>
            <OnboardingProvider>
              <NavigationContainer>
                <AppNavigator />
              </NavigationContainer>
            </OnboardingProvider>
          </ThemeProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
