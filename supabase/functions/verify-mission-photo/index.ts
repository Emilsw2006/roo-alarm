import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_MODEL_DEFAULT = "gemini-3.5-flash-lite";
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
    "Category: bed/bedding. Any bed, mattress, sheets, duvet, or pillows — any color, angle, or messiness.",
  water:
    "Category: drinkware/water. Any glass, cup, mug, bottle, jar, or tap/faucet.",
  toothbrush: "Category: toothbrush. Manual or electric; partial visibility OK.",
  sun_photo: "Category: sunlight. Sun rays, bright light on wall/floor/window, or the sun.",
  sky_photo: "Category: sky. Through window, balcony, or outdoors; even a tiny patch counts.",
  doorway:
    "Category: door/doorway. ANY door type, color, angle, or perspective.",
  mug: "Category: mug/cup. Any mug, cup, taza, or similar drinkware.",
  towel: "Category: towel. Any towel, hand towel, or bath towel.",
  shoes: "Category: footwear. Shoes, sneakers, boots, slippers, sandals.",
  keys: "Category: keys. Keys or keyring; partial visibility OK.",
  book: "Category: book/reading material. Book, notebook, journal, or magazine.",
  touch_grass: "Category: outdoor greenery. Grass, lawn, leaves, or plants outside.",
  plant: "Category: plant. Houseplant, pot, flowers, or visible greenery.",
  pet: "Category: pet. Dog, cat, bird, etc.",
  random_object: "Category: any household object. One clear real object in frame.",
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

  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) {
    console.error("verify-mission-photo: GEMINI_API_KEY missing at runtime — redeploy function after setting secrets");
    return jsonResponse({ passed: false, unavailable: true, reason: "missing_api_key" }, 503);
  }

  const model = (Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite").trim();

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
    "Match the OBJECT CATEGORY, never the exact app icon/emoji appearance.",
    "Be LENIENT: blurry, dark, tilted, cropped photos are fine.",
    "passed=true if there is ANY plausible evidence of the requested category.",
    "passed=false ONLY when clearly unrelated or blank/black.",
    'In "reason", act like friendly mascot "Roo" in Spanish, under 2 sentences.',
    `Mission id: ${input.missionId}`,
    `Mission label: ${input.missionLabel}`,
    `Camera hint: ${input.missionHint}`,
    emojiLine,
    `Object check: ${objectGuidance}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const geminiController = new AbortController();
    const geminiTimeout = setTimeout(() => geminiController.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: geminiController.signal,
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
    } finally {
      clearTimeout(geminiTimeout);
    }

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
    const reason =
      err instanceof DOMException && err.name === "AbortError" ? "timeout" : "api_error";
    return jsonResponse({ passed: false, unavailable: true, reason }, 502);
  }
});
