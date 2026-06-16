export interface Mission {
  id: string;
  label: string;
  emoji: string;
  icon: string;
  verb: string;
  hint: string;
}

export type MissionMode = 'personalized' | 'roulette';

export const DEFAULT_PERSONALIZED_MISSION = 'make_bed';

export const DEFAULT_ENABLED_MISSIONS = [
  'make_bed',
  'sky_photo',
  'touch_grass',
  'random_object',
  'water',
  'toothbrush',
  'shoes',
  'keys',
  'book',
  'plant',
  'doorway',
  'mug',
  'towel',
  'pet',
  'sun_photo',
];

export const MISSION_LIST: Mission[] = [
  {
    id: 'make_bed',
    label: 'Make your bed',
    emoji: '🛏️',
    icon: 'bed',
    verb: 'Sheets straight, pillows set',
    hint: 'Frame your made bed in view',
  },
  {
    id: 'sky_photo',
    label: 'Photo of the sky',
    emoji: '🌤️',
    icon: 'sunrise',
    verb: 'Step into daylight',
    hint: 'Capture the sky from a window, balcony, or outside',
  },
  {
    id: 'touch_grass',
    label: 'Touch grass',
    emoji: '🌱',
    icon: 'globe',
    verb: 'Get near real nature',
    hint: 'Show grass, leaves, or a plant outside',
  },
  {
    id: 'random_object',
    label: 'Find an object',
    emoji: '🎒',
    icon: 'search',
    verb: 'Grab something away from bed',
    hint: 'Show any clear household object',
  },
  {
    id: 'water',
    label: 'Drink water',
    emoji: '🥤',
    icon: 'droplet',
    verb: 'A full glass before you start',
    hint: 'Show your glass or bottle to the camera',
  },
  {
    id: 'toothbrush',
    label: 'Find your toothbrush',
    emoji: '🪥',
    icon: 'sparkle',
    verb: 'Get to the bathroom',
    hint: 'Show your toothbrush clearly',
  },
  {
    id: 'shoes',
    label: 'Find your shoes',
    emoji: '👟',
    icon: 'arrowUp',
    verb: 'Get ready to move',
    hint: 'Show a pair of shoes',
  },
  {
    id: 'keys',
    label: 'Find your keys',
    emoji: '🔑',
    icon: 'lock',
    verb: 'Leave-bed proof',
    hint: 'Show your keys in frame',
  },
  {
    id: 'book',
    label: 'Find a book',
    emoji: '📘',
    icon: 'fileText',
    verb: 'Wake your brain gently',
    hint: 'Show a book or notebook',
  },
  {
    id: 'plant',
    label: 'Find a plant',
    emoji: '🪴',
    icon: 'globe',
    verb: 'Start with something alive',
    hint: 'Show a house plant or outdoor greenery',
  },
  {
    id: 'doorway',
    label: 'Go to a doorway',
    emoji: '🚪',
    icon: 'door',
    verb: 'Cross out of sleep mode',
    hint: 'Show a door or doorway',
  },
  {
    id: 'mug',
    label: 'Find a mug',
    emoji: '☕',
    icon: 'droplet',
    verb: 'Kitchen check-in',
    hint: 'Show a mug or cup',
  },
  {
    id: 'towel',
    label: 'Find a towel',
    emoji: '🧻',
    icon: 'layers',
    verb: 'Bathroom check-in',
    hint: 'Show a towel clearly',
  },
  {
    id: 'pet',
    label: 'Find your pet',
    emoji: '🐾',
    icon: 'heart',
    verb: 'Say good morning',
    hint: 'Show your pet if they are nearby',
  },
  {
    id: 'sun_photo',
    label: 'Photo of sunlight',
    emoji: '☀️',
    icon: 'sunrise',
    verb: 'Find morning light',
    hint: 'Show sunlight on a wall, window, or floor',
  },
];

export const MISSIONS: Record<string, Mission> = MISSION_LIST.reduce((acc, mission) => {
  acc[mission.id] = mission;
  return acc;
}, {} as Record<string, Mission>);

const LEGACY_MISSION_ALIASES: Record<string, string> = {
  bed: 'make_bed',
  outside: 'sky_photo',
  custom: 'make_bed',
};

export function normalizeMissionId(id?: string | null) {
  if (!id) return DEFAULT_PERSONALIZED_MISSION;
  return MISSIONS[id] ? id : (LEGACY_MISSION_ALIASES[id] || DEFAULT_PERSONALIZED_MISSION);
}

export function getMission(id?: string | null) {
  return MISSIONS[normalizeMissionId(id)] || MISSIONS[DEFAULT_PERSONALIZED_MISSION];
}
