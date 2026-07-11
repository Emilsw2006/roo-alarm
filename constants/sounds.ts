export interface SoundAsset {
  id: string;
  name: string;
  category: string;
  file: any;
  gradient: [string, string, ...string[]];
}

export const SOUND_CATEGORIES = ['Loud & Wakeful', 'Nature & Ambience', 'Classic Alarms', 'Sci-Fi & Tech'];

export const SOUND_ASSETS: SoundAsset[] = [
  // Loud & Wakeful
  { id: 'emergency_local', name: 'Neon', category: 'Loud & Wakeful', file: require('../assets/sounds/emergency.mp3'), gradient: ['#f12711', '#f5af19'] },
  { id: 'piano_loud', name: 'Arcade', category: 'Loud & Wakeful', file: require('../assets/sounds/digital_alarm.mp3'), gradient: ['#1c92d2', '#f2fcfe'] },
  { id: 'radar_fast', name: 'Radar', category: 'Loud & Wakeful', file: require('../assets/sounds/radar_classic.mp3'), gradient: ['#f79d00', '#64f38c'] },

  // Nature & Ambience
  { id: 'rain', name: 'Rain', category: 'Nature & Ambience', file: require('../assets/sounds/rain.mp3'), gradient: ['#3a6073', '#3a7bd5'] },
  { id: 'bird', name: 'Birdsong', category: 'Nature & Ambience', file: require('../assets/sounds/bird.mp3'), gradient: ['#56ab2f', '#a8e063'] },
  { id: 'rooster_local', name: 'Rooster', category: 'Nature & Ambience', file: require('../assets/sounds/rooster.mp3'), gradient: ['#e65c00', '#F9D423'] },
  { id: 'ocean', name: 'Ocean', category: 'Nature & Ambience', file: require('../assets/sounds/rain.mp3'), gradient: ['#8e9eab', '#eef2f3'] },

  // Classic Alarms
  { id: 'radar_local', name: 'Sunrise', category: 'Classic Alarms', file: require('../assets/sounds/radar_classic.mp3'), gradient: ['#cb2d3e', '#ef473a'] },
  { id: 'bell_local', name: 'Bell', category: 'Classic Alarms', file: require('../assets/sounds/bell.mp3'), gradient: ['#FDFC47', '#24FE41'] },
  { id: 'bell_near', name: 'Ring', category: 'Classic Alarms', file: require('../assets/sounds/bell.mp3'), gradient: ['#30E8BF', '#FF8235'] },
  { id: 'alarm_clock', name: 'Clock', category: 'Classic Alarms', file: require('../assets/sounds/digital_alarm.mp3'), gradient: ['#8E0E00', '#1F1C18'] },

  // Sci-Fi & Tech
  { id: 'digital_long', name: 'Blaster', category: 'Sci-Fi & Tech', file: require('../assets/sounds/digital_alarm.mp3'), gradient: ['#ff0000', '#4a0000'] },
  { id: 'digital_local', name: 'Arcade', category: 'Sci-Fi & Tech', file: require('../assets/sounds/digital_alarm.mp3'), gradient: ['#DCE35B', '#45B649'] },
  { id: 'spaceship', name: 'Neon', category: 'Sci-Fi & Tech', file: require('../assets/sounds/emergency.mp3'), gradient: ['#C6EA8D', '#FE90AF'] },
];
