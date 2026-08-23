/**
 * La verificación de misiones con Gemini se hace en la Edge Function
 * `verify-mission-photo`. La clave vive como secreto del proyecto Supabase:
 * no hay ninguna credencial de Gemini en el cliente, porque todo lo que se
 * compila en el bundle es extraíble del IPA.
 */
export function isGeminiMissionVerifyEnabled() {
  return true;
}
