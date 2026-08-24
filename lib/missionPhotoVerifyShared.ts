export type MissionPhotoVerifyInput = {
  missionId: string;
  missionLabel: string;
  missionHint: string;
  missionEmoji?: string;
  imageBase64: string;
  mimeType?: string;
};

export type MissionPhotoVerifyResult = {
  passed: boolean;
  unavailable?: boolean;
  reason?: string;
};

const MISSION_OBJECT_GUIDANCE: Record<string, string> = {
  make_bed:
    'Category: bed/bedding. Any bed, mattress, sheets, duvet, or pillows — any color, angle, or messiness.',
  water: 'Category: drinkware/water. Any glass, cup, mug, bottle, jar, or tap/faucet.',
  toothbrush: 'Category: toothbrush. Manual or electric; partial visibility OK.',
  sun_photo: 'Category: sunlight. Sun rays, bright light on wall/floor/window, or the sun.',
  sky_photo: 'Category: sky. Through window, balcony, or outdoors; even a tiny patch counts.',
  doorway: 'Category: door/doorway. ANY door type, color, angle, or perspective.',
  mug: 'Category: mug/cup. Any mug, cup, taza, or similar drinkware.',
  towel: 'Category: towel. Any towel, hand towel, or bath towel.',
  shoes: 'Category: footwear. Shoes, sneakers, boots, slippers, sandals.',
  keys: 'Category: keys. Keys or keyring; partial visibility OK.',
  book: 'Category: book/reading material. Book, notebook, journal, or magazine.',
  touch_grass: 'Category: outdoor greenery. Grass, lawn, leaves, or plants outside.',
  plant: 'Category: plant. Houseplant, pot, flowers, or visible greenery.',
  pet: 'Category: pet. Dog, cat, bird, etc.',
  random_object: 'Category: any household object. One clear real object in frame.',
};

function missionObjectGuidance(missionId: string, missionLabel: string): string {
  return (
    MISSION_OBJECT_GUIDANCE[missionId] ??
    `The mission asks for: "${missionLabel}". Accept ANY real-world instance of that object category. Reject ONLY when clearly unrelated.`
  );
}

export function buildMissionPhotoPrompt(input: MissionPhotoVerifyInput): string {
  const objectGuidance = missionObjectGuidance(input.missionId, input.missionLabel);
  const emojiLine = input.missionEmoji
    ? `Mission emoji (category hint ONLY): ${input.missionEmoji}`
    : '';

  return [
    'You verify wake-up mission photos for a mobile alarm app.',
    'Return ONLY valid JSON: {"passed": boolean, "reason": string}',
    'Match the OBJECT CATEGORY, never the exact app icon/emoji appearance.',
    'Be LENIENT: blurry, dark, tilted, cropped photos are fine.',
    'passed=true if there is ANY plausible evidence of the requested category.',
    'passed=false ONLY when clearly unrelated or blank/black.',
    'In "reason", act like friendly mascot "Roo" in Spanish, under 2 sentences.',
    `Mission id: ${input.missionId}`,
    `Mission label: ${input.missionLabel}`,
    `Camera hint: ${input.missionHint}`,
    emojiLine,
    `Object check: ${objectGuidance}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseMissionPhotoGeminiText(text: string): MissionPhotoVerifyResult | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    const parsed = JSON.parse(candidate) as { passed?: boolean; reason?: string };
    if (typeof parsed.passed !== 'boolean') return null;
    return {
      passed: parsed.passed,
      reason: parsed.passed ? undefined : parsed.reason || 'rejected',
    };
  } catch {
    return null;
  }
}
