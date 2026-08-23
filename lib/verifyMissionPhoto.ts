import { supabase } from './supabase';

type VerifyMissionPhotoInput = {
  missionId: string;
  missionLabel: string;
  missionHint: string;
  missionEmoji?: string;
  imageBase64: string;
  mimeType?: string;
};

export type VerifyMissionPhotoReason =
  | 'missing_api_key'
  | 'timeout'
  | 'api_error'
  | 'billing_exhausted'
  | 'model_unavailable'
  | 'invalid_response'
  | 'rejected';

export type VerifyMissionPhotoResult = {
  passed: boolean;
  /** True when the verifier could not run — not a user photo failure. */
  unavailable?: boolean;
  reason?: VerifyMissionPhotoReason | string;
};

/**
 * La verificación vive en la Edge Function `verify-mission-photo`. La clave de
 * Gemini es un secreto del proyecto Supabase y nunca se compila dentro de la app:
 * cualquier clave incluida en el bundle es extraíble del IPA.
 */
export async function verifyMissionPhoto(
  input: VerifyMissionPhotoInput
): Promise<VerifyMissionPhotoResult> {
  try {
    const { data, error } = await supabase.functions.invoke<VerifyMissionPhotoResult>(
      'verify-mission-photo',
      {
        body: {
          missionId: input.missionId,
          missionLabel: input.missionLabel,
          missionHint: input.missionHint,
          missionEmoji: input.missionEmoji,
          imageBase64: input.imageBase64,
          mimeType: input.mimeType ?? 'image/jpeg',
        },
      }
    );

    if (error) {
      console.log('verify-mission-photo invoke failed', error);
      return { passed: false, unavailable: true, reason: 'api_error' };
    }

    if (!data || typeof data.passed !== 'boolean') {
      console.log('verify-mission-photo invalid payload', data);
      return { passed: false, unavailable: true, reason: 'invalid_response' };
    }

    if (data.unavailable) {
      console.log('verify-mission-photo unavailable', data.reason);
    } else if (!data.passed) {
      console.log('verify-mission-photo rejected', data.reason);
    }

    return data;
  } catch (err) {
    console.log('verify-mission-photo network error', err);
    return { passed: false, unavailable: true, reason: 'api_error' };
  }
}
