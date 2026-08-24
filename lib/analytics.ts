import posthog from 'posthog-react-native';

/**
 * Registra un evento personalizado en PostHog.
 * 
 * Ejemplo:
 *   trackEvent('alarm_triggered', { alarmId: 123 });
 */
export function trackEvent(name: string, properties?: Record<string, any>) {
  try {
    posthog.capture(name, properties);
  } catch (err) {
    console.warn('[Analytics] Error tracking event:', err);
  }
}

/**
 * Mapea la identidad del usuario logueado en Analytics.
 */
export function identifyUser(userId: string, email?: string) {
  try {
    posthog.identify(userId, email ? { email } : undefined);
  } catch (err) {
    console.warn('[Analytics] Error identifying user:', err);
  }
}

/**
 * Resetea el estado de analytics al cerrar sesión.
 */
export function resetAnalytics() {
  try {
    posthog.reset();
  } catch (err) {
    console.warn('[Analytics] Error resetting analytics:', err);
  }
}
