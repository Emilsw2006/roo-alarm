import { getGeminiApiKey, getGeminiModel } from './geminiConfig';
import {
  buildMissionPhotoPrompt,
  parseMissionPhotoGeminiText,
  type MissionPhotoVerifyInput,
  type MissionPhotoVerifyResult,
} from './missionPhotoVerifyShared';
import { withTimeout } from './withTimeout';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const CLIENT_VERIFY_TIMEOUT_MS = 12_000;

const unavailable = (reason: string): MissionPhotoVerifyResult => ({
  passed: false,
  unavailable: true,
  reason,
});

export async function verifyMissionPhotoClient(
  input: MissionPhotoVerifyInput
): Promise<MissionPhotoVerifyResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return unavailable('missing_api_key');
  }

  const model = getGeminiModel();
  const mimeType = input.mimeType ?? 'image/jpeg';
  const prompt = buildMissionPhotoPrompt(input);

  const verifyPromise = (async (): Promise<MissionPhotoVerifyResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: input.imageBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 256,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text();
        console.log('Gemini client verify failed', response.status, body.slice(0, 240));
        const reason =
          response.status === 429
            ? 'billing_exhausted'
            : response.status === 404
              ? 'model_unavailable'
              : 'api_error';
        return unavailable(reason);
      }

      const data = await response.json();
      const text =
        data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text).join('') ??
        '';
      const parsed = parseMissionPhotoGeminiText(text);

      if (!parsed) {
        console.log('Gemini client invalid JSON', text.slice(0, 240));
        return unavailable('invalid_response');
      }

      return parsed;
    } catch (err) {
      console.log('Gemini client verify error', err);
      const reason =
        err instanceof DOMException && err.name === 'AbortError' ? 'timeout' : 'api_error';
      return unavailable(reason);
    } finally {
      clearTimeout(timeout);
    }
  })();

  return withTimeout(verifyPromise, CLIENT_VERIFY_TIMEOUT_MS, unavailable('timeout'));
}
