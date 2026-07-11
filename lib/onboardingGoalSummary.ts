import { Language, translations } from '../constants/i18n';

const WEEKS_PER_MONTH = 52 / 12;

/** Minutes saved per protected morning — aligned with the 25 min chart example. */
const AWAKE_MINUTES_SAVED = [10, 15, 25, 35] as const;

/** Small boost when the user snoozes often. */
const SNOOZE_BONUS_MINUTES = [6, 3, 1, 0] as const;

function resolveOptionIndex(
  value: string | undefined,
  optionKey: 'awakeTimeOptions' | 'snoozeOptions',
  fallback: number
): number {
  if (!value) return fallback;

  for (const lang of Object.keys(translations) as Language[]) {
    const options = translations[lang].onboarding[optionKey] as readonly string[];
    const index = options.indexOf(value);
    if (index >= 0) return index;
  }

  return fallback;
}

export function getMonthlyHoursSaved(input: {
  protectedDaysPerWeek: number;
  wakeUpDuration?: string;
  snoozeHabit?: string;
}): number {
  const days = Math.max(1, Math.min(7, input.protectedDaysPerWeek));
  const awakeIndex = resolveOptionIndex(input.wakeUpDuration, 'awakeTimeOptions', 2);
  const snoozeIndex = resolveOptionIndex(input.snoozeHabit, 'snoozeOptions', 1);

  const minutesPerMorning =
    AWAKE_MINUTES_SAVED[awakeIndex] + SNOOZE_BONUS_MINUTES[snoozeIndex];

  const totalMinutes = days * WEEKS_PER_MONTH * minutesPerMorning;
  return Math.max(1, Math.round(totalMinutes / 60));
}

export function formatGoalWakeTime(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const isPM = hours >= 12;
  const hour12 = hours % 12 || 12;

  return {
    clock: `${hour12}:${minutes.toString().padStart(2, '0')}`,
    period: isPM ? 'PM' : 'AM',
  };
}
