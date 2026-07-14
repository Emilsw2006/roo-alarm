import { getGeminiApiKey, getGeminiModel, getGeminiApiBase, getNvidiaApiKey } from './geminiConfig';

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
  | 'api_error'
  | 'billing_exhausted'
  | 'model_unavailable'
  | 'invalid_response'
  | 'rejected';

export type VerifyMissionPhotoResult = {
  passed: boolean;
  /** True when the AI API could not run — not a user photo failure. */
  unavailable?: boolean;
  reason?: VerifyMissionPhotoReason | string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function extractJsonObject(text: string): VerifyMissionPhotoResult | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as { passed?: boolean; reason?: string };
    if (typeof parsed.passed !== 'boolean') return null;
    return {
      passed: parsed.passed,
      reason: parsed.passed ? undefined : (parsed.reason || 'rejected'),
    };
  } catch {
    return null;
  }
}

const MISSION_OBJECT_GUIDANCE: Record<string, string> = {
  make_bed:
    'Must show a bed, mattress, sheets, duvet, or pillows. Close variants OK; a random sofa or chair is NOT enough.',
  water:
    'Must show drinkware with water context: glass, cup, mug, bottle, jar, or tap/faucet. Other unrelated objects are NOT enough.',
  toothbrush:
    'Must show a toothbrush (manual or electric). Only part of the brush visible is OK.',
  sun_photo:
    'Must show real sunlight: sun rays, bright morning light on a wall/floor/window, or the sun itself. A dark room with no light is NOT enough.',
  sky_photo:
    'Must show sky: through a window, balcony, or outdoors. Even a small patch of sky counts.',
  doorway:
    'Must show a door, door frame, or doorway opening. A plain wall with no door is NOT enough.',
  mug:
    'Must show a mug, cup, or taza. A bottle alone is borderline — prefer cup-like drinkware.',
  towel:
    'Must show a towel, hand towel, or bath towel. Toilet paper counts ONLY if the mission label clearly asks for toilet paper / papel higiénico.',
  shoes:
    'Must show footwear: shoes, sneakers, boots, slippers, or sandals. Socks alone are NOT enough.',
  keys:
    'Must show keys or a keyring. A single key partially visible is OK.',
  book:
    'Must show a book, notebook, journal, or magazine. Only a plain table is NOT enough.',
  touch_grass:
    'Must show grass, lawn, leaves, or outdoor greenery you can touch. Indoor fake plants alone are weak but real plants/leaves count.',
  plant:
    'Must show a plant, houseplant, pot, or visible greenery. A random object is NOT enough.',
  pet:
    'Must show a pet animal (dog, cat, bird, etc.). A stuffed toy is NOT enough unless clearly the mission allows it.',
  random_object:
    'Must show one clear, identifiable household object (anything real and specific in frame). A blank wall or empty floor is NOT enough.',
};

function missionObjectGuidance(missionId: string, missionLabel: string): string {
  const specific = MISSION_OBJECT_GUIDANCE[missionId];
  if (specific) return specific;

  return [
    `The mission asks for: "${missionLabel}".`,
    'Identify the everyday object category from that label (same type as the app icon suggests).',
    'Accept that object OR a direct equivalent in the same category (e.g. backpack/mochila = bag/bolso/mochila; toilet paper = roll or even a visible piece).',
    'Reject clearly unrelated objects.',
  ].join(' ');
}

function classifyApiFailure(status: number, body: string): VerifyMissionPhotoResult {
  const lower = body.toLowerCase();

  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return { passed: false, unavailable: true, reason: 'billing_exhausted' };
  }

  if (status === 404 || lower.includes('not found') || lower.includes('not supported')) {
    return { passed: false, unavailable: true, reason: 'model_unavailable' };
  }

  return { passed: false, unavailable: true, reason: 'api_error' };
}

export async function verifyMissionPhoto(
  input: VerifyMissionPhotoInput
): Promise<VerifyMissionPhotoResult> {
  const nvidiaKey = getNvidiaApiKey();
  const geminiKey = getGeminiApiKey();

  if (!nvidiaKey && !geminiKey) {
    return { passed: false, unavailable: true, reason: 'missing_api_key' };
  }

  const mimeType = input.mimeType ?? 'image/jpeg';
  const objectGuidance = missionObjectGuidance(input.missionId, input.missionLabel);
  const emojiLine = input.missionEmoji ? `Mission icon/emoji (reference only, not pixel-perfect): ${input.missionEmoji}` : '';

  const prompt = [
    'You verify wake-up mission photos for a mobile alarm app.',
    'Return ONLY valid JSON: {"passed": boolean, "reason": string}',
    'Goal: objectively confirm the photo shows the CORRECT object for this mission — but be very forgiving about photo quality and partial visibility.',
    'The user just woke up. Photos may be blurry, dark, tilted, cropped, or rushed. That is fine.',
    'Rules:',
    '- passed=true when there is any minimal but objective visual evidence of the requested object type (or a very close equivalent).',
    '- The object does NOT need to match the app icon exactly.',
    '- Partial visibility is enough: a small piece, corner, handle, strap, texture, label, silhouette, or half-out-of-frame object counts if it reasonably indicates that object type.',
    '- passed=false when: (1) image is black/blank/screenshot, (2) there is no recognizable evidence of the requested object/category, (3) the visible object is clearly DIFFERENT and unrelated (e.g. shoes when mission asks for toothbrush).',
    '- Act like "Roo" (a friendly, energetic mascot) in the "reason" string! If passed=true, give a short, happy congratulation. If passed=false, explain cheerfully what you actually see and what you need them to show instead. Keep it under 2 sentences in Spanish.',
    '- If the evidence is weak but plausible, choose passed=true. If there is no plausible match, choose passed=false.',
    `Mission id: ${input.missionId}`,
    `Mission label (defines the required object): ${input.missionLabel}`,
    `Camera hint: ${input.missionHint}`,
    emojiLine,
    `Object check: ${objectGuidance}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (nvidiaKey) {
    try {
      const response = await fetch(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${nvidiaKey}`,
          },
          body: JSON.stringify({
            model: 'meta/llama-3.2-11b-vision-instruct',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${input.imageBase64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 256,
            temperature: 0.35,
            response_format: { type: 'json_object' },
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const failure = classifyApiFailure(response.status, body);
        console.log('NVIDIA Llama Vision verify failed', response.status, failure.reason, body.slice(0, 240));
        return failure;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      const parsed = extractJsonObject(text);

      if (!parsed) {
        console.log('NVIDIA Llama Vision verify invalid JSON', text.slice(0, 240));
        return { passed: false, unavailable: true, reason: 'invalid_response' };
      }

      if (!parsed.passed) {
        console.log('NVIDIA Llama Vision verify rejected', parsed.reason);
        return { ...parsed, reason: parsed.reason || 'rejected' };
      }

      return parsed;
    } catch (err) {
      console.log('NVIDIA Llama Vision error, falling back to Gemini or default', err);
      if (!geminiKey) {
        return { passed: false, unavailable: true, reason: 'api_error' };
      }
    }
  }

  // Fallback to Gemini
  if (geminiKey) {
    const model = getGeminiModel();
    const response = await fetch(
      `${getGeminiApiBase()}/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            temperature: 0.35,
            maxOutputTokens: 256,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const failure = classifyApiFailure(response.status, body);
      console.log('Gemini verify failed', response.status, failure.reason, body.slice(0, 240));
      return failure;
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') ?? '';
    const parsed = extractJsonObject(text);

    if (!parsed) {
      console.log('Gemini verify invalid JSON', text.slice(0, 240));
      return { passed: false, unavailable: true, reason: 'invalid_response' };
    }

    if (!parsed.passed) {
      console.log('Gemini verify rejected', parsed.reason);
      return { ...parsed, reason: parsed.reason || 'rejected' };
    }

    return parsed;
  }

  return { passed: false, unavailable: true, reason: 'missing_api_key' };
}
