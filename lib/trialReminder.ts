import * as Notifications from 'expo-notifications';

const TRIAL_REMINDER_ID = 'rooalarm.trial-ending-reminder';
const REMIND_HOURS_BEFORE_END = 24;

export async function scheduleTrialReminderNotification(trialEndDate?: Date | null) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== 'granted') return;
  }

  await Notifications.cancelScheduledNotificationAsync(TRIAL_REMINDER_ID).catch(() => {});

  const end = trialEndDate ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const fireAt = new Date(end.getTime() - REMIND_HOURS_BEFORE_END * 60 * 60 * 1000);
  if (fireAt.getTime() <= Date.now()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: TRIAL_REMINDER_ID,
    content: {
      title: 'Tu prueba gratis termina pronto',
      body: 'Queda menos de un día de Roo Alarm gratis. Puedes gestionar tu suscripción en Ajustes.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
}

export async function cancelTrialReminderNotification() {
  await Notifications.cancelScheduledNotificationAsync(TRIAL_REMINDER_ID).catch(() => {});
}
