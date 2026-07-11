const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

// Clave de Google Cloud Console (Generative Language API).
// Endpoint estándar de Gemini API — compatible con claves de GCP, no solo AI Studio.
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function getGeminiApiKey() {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function getGeminiModel() {
  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim();
  return model && model.length > 0 ? model : DEFAULT_MODEL;
}

export function isGeminiMissionVerifyEnabled() {
  return !!getGeminiApiKey();
}

export function getGeminiApiBase() {
  return GEMINI_API_BASE;
}
