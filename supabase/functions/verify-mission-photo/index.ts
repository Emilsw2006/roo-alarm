import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash-lite";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

type VerifyInput = {
  missionId: string;
  missionLabel: string;
  missionHint: string;
  missionEmoji?: string;
  imageBase64: string;
  mimeType?: string;
};

type VerifyResult = {
  passed: boolean;
  unavailable?: boolean;
  reason?: string;
};

const MISSION_OBJECT_GUIDANCE: Record<string, string> = {
  make_bed:
    "Category: bed/bedding. Must clearly show a bed, mattress with sheets/duvet, or pillow arrangement. The bed must be the main subject.",
  water:
    "Category: drinkware with water. A glass, cup, mug, bottle, or similar container — must be clearly visible and identifiable as the main subject.",
  toothbrush: "Category: toothbrush. A manual or electric toothbrush must be clearly visible as the main subject.",
  sun_photo: "Category: sunlight. Must clearly show sunlight: the sun itself, strong light rays, or bright sunlit area. Dark photos fail.",
  sky_photo: "Category: sky. Must clearly show sky (blue, cloudy, or night). Through window is OK as long as sky is clearly visible.",
  doorway:
    "Category: door or doorway. A door must be clearly visible as the main subject — any type, color, or material.",
  mug: "Category: mug or cup. A mug or cup must be clearly visible and identifiable as the main subject.",
  towel: "Category: towel. A towel must be clearly visible as the main subject.",
  shoes: "Category: footwear. Shoes, sneakers, boots, slippers, or sandals must be clearly visible as the main subject.",
  keys: "Category: keys. Keys or a keyring must be clearly visible and identifiable as the main subject.",
  book: "Category: book or reading material. A book, notebook, journal, or magazine must be clearly the main subject.",
  touch_grass: "Category: outdoor greenery. Must clearly show grass, lawn, leaves, or plants outdoors. Indoor plants do not count.",
  plant: "Category: plant. A houseplant, pot, or flowers must be clearly the main subject.",
  pet: "Category: pet animal. A dog, cat, bird, or other pet must be clearly visible and identifiable.",
  random_object: "Category: any single household object. One clear, recognizable real-world object must be the main subject of the photo.",
};

function missionObjectGuidance(missionId: string, missionLabel: string): string {
  return (
    MISSION_OBJECT_GUIDANCE[missionId] ??
    `The mission asks for: "${missionLabel}". Accept ANY real-world instance of that object category. Reject ONLY when clearly unrelated.`
  );
}

function extractJsonObject(text: string): VerifyResult | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    const parsed = JSON.parse(candidate) as { passed?: boolean; reason?: string };
    if (typeof parsed.passed !== "boolean") return null;
    return {
      passed: parsed.passed,
      reason: parsed.passed ? undefined : parsed.reason || "rejected",
    };
  } catch {
    return null;
  }
}

function jsonResponse(body: VerifyResult, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ passed: false, unavailable: true, reason: "missing_api_key" }, 503);
  }

  let input: VerifyInput;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ passed: false, unavailable: true, reason: "invalid_response" }, 400);
  }

  const mimeType = input.mimeType ?? "image/jpeg";
  const objectGuidance = missionObjectGuidance(input.missionId, input.missionLabel);
  const emojiLine = input.missionEmoji
    ? `Mission emoji (category hint ONLY): ${input.missionEmoji}`
    : "";

  const prompt = [
    "You verify wake-up mission photos for a mobile alarm app.",
    'Return ONLY valid JSON: {"passed": boolean, "reason": string}',
    "",
    "RULES:",
    "1. passed=true ONLY if the photo CLEARLY and RECOGNIZABLY shows the requested object or category.",
    "2. The object must be the MAIN subject of the photo, not barely visible or accidental.",
    "3. passed=false if:",
    "   - The photo shows something clearly different from what was asked.",
    "   - The photo is completely black, blank, or the camera is covered.",
    "   - The object is so blurry or far away that you cannot identify it with confidence.",
    "   - The user is photographing something random that has nothing to do with the mission.",
    "4. Be fair but STRICT. A photo of grass does NOT pass for 'make bed'. A selfie does NOT pass for 'glass of water'.",
    "5. Reasonable variation IS allowed: different colors, angles, lighting conditions, partial visibility — as long as the object is clearly identifiable.",
    'In "reason", respond as friendly mascot "Roo" in Spanish. If passed=false, clearly but kindly explain what was wrong (under 2 sentences).',
    "",
    `Mission id: ${input.missionId}`,
    `Mission label: ${input.missionLabel}`,
    `Camera hint: ${input.missionHint}`,
    emojiLine,
    `Object category to verify: ${objectGuidance}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("Gemini verify failed", response.status, body.slice(0, 240));
      const reason =
        response.status === 429 ? "billing_exhausted" : response.status === 404 ? "model_unavailable" : "api_error";
      return jsonResponse({ passed: false, unavailable: true, reason }, 502);
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text).join("") ?? "";
    const parsed = extractJsonObject(text);

    if (!parsed) {
      console.error("Gemini invalid JSON", text.slice(0, 240));
      return jsonResponse({ passed: false, unavailable: true, reason: "invalid_response" }, 502);
    }

    return jsonResponse(parsed);
  } catch (err) {
    console.error("verify-mission-photo error", err);
    return jsonResponse({ passed: false, unavailable: true, reason: "api_error" }, 502);
  }
});
