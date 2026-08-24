/**
 * La verificación de misiones con Gemini se hace en la Edge Function
 * `verify-mission-photo`. La clave vive como secreto del proyecto Supabase.
 * Si el servidor no tiene el secreto, la app usa EXPO_PUBLIC_GEMINI_API_KEY
 * como respaldo (ya presente en builds de desarrollo).
 */
export function isGeminiMissionVerifyEnabled() {
  return true;
}

export function getGeminiApiKey() {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || null;
}

export function getGeminiModel() {
  return process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
}
