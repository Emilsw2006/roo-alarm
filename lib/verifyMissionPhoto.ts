import { verifyMissionPhotoClient } from './verifyMissionPhotoClient';
import { supabase } from './supabase';
import { withTimeout } from './withTimeout';
import type { MissionPhotoVerifyInput, MissionPhotoVerifyResult } from './missionPhotoVerifyShared';

export type VerifyMissionPhotoInput = MissionPhotoVerifyInput;

export type VerifyMissionPhotoReason =
  | 'missing_api_key'
  | 'timeout'
  | 'api_error'
  | 'billing_exhausted'
  | 'model_unavailable'
  | 'invalid_response'
  | 'rejected';

export type VerifyMissionPhotoResult = MissionPhotoVerifyResult;

const VERIFY_TIMEOUT_MS = 8_000;

const unavailable = (reason: VerifyMissionPhotoReason): VerifyMissionPhotoResult => ({
  passed: false,
  unavailable: true,
  reason,
});

async function verifyMissionPhotoViaEdge(
  input: VerifyMissionPhotoInput
): Promise<VerifyMissionPhotoResult> {
  const invokePromise = supabase.functions
    .invoke<VerifyMissionPhotoResult>('verify-mission-photo', {
      body: {
        missionId: input.missionId,
        missionLabel: input.missionLabel,
        missionHint: input.missionHint,
        missionEmoji: input.missionEmoji,
        imageBase64: input.imageBase64,
        mimeType: input.mimeType ?? 'image/jpeg',
      },
    })
    .then(({ data, error }) => {
      if (data && typeof data.passed === 'boolean') {
        if (data.unavailable) {
          console.log('verify-mission-photo unavailable', data.reason);
        } else if (!data.passed) {
          console.log('verify-mission-photo rejected', data.reason);
        }
        return data;
      }

      if (error) {
        console.log('verify-mission-photo invoke failed', error);
        return unavailable('api_error');
      }

      console.log('verify-mission-photo invalid payload', data);
      return unavailable('invalid_response');
    })
    .catch((err) => {
      console.log('verify-mission-photo network error', err);
      return unavailable('api_error');
    });

  const result = await withTimeout(
    invokePromise,
    VERIFY_TIMEOUT_MS,
    unavailable('timeout')
  );

  if (result.reason === 'timeout') {
    console.log('verify-mission-photo timed out after', VERIFY_TIMEOUT_MS, 'ms');
  }

  return result;
}

/**
 * Primero intenta la Edge Function (clave en Supabase). Si el servidor no puede
 * verificar, usa Gemini directamente con la clave de desarrollo en la app.
 */
export async function verifyMissionPhoto(
  input: VerifyMissionPhotoInput
): Promise<VerifyMissionPhotoResult> {
  const edgeResult = await verifyMissionPhotoViaEdge(input);
  if (!edgeResult.unavailable) {
    return edgeResult;
  }

  console.log('verify-mission-photo edge unavailable, trying client Gemini', edgeResult.reason);
  return verifyMissionPhotoClient(input);
}
