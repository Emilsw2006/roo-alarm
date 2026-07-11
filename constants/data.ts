import type { MissionMode } from './missions';

export interface Alarm {
  id: number;
  time: string;
  ampm: 'AM' | 'PM';
  mission: string;
  label: string;
  on: boolean;
  sound?: string;
  customMission?: string;
  missionMode?: MissionMode;
  enabledMissions?: string[];
  specificDate?: string; // e.g. "2026-10-15"
  lastTriggeredDate?: string; // "YYYY-MM-DD"
  lastCompletedDate?: string; // "YYYY-MM-DD"
}

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowIso = tomorrow.toISOString();

export const MOCK_ALARMS: Alarm[] = [
  { id: 1, time: '7:00', ampm: 'AM', mission: 'make_bed', label: 'Wake up', on: true },
  { id: 2, time: '8:15', ampm: 'AM', mission: 'water', label: 'Gym', on: true, specificDate: tomorrowIso },
  { id: 3, time: '6:30', ampm: 'AM', mission: 'sky_photo', label: 'Run', on: false, specificDate: tomorrowIso },
];
