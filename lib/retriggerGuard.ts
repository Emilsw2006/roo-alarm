export const MISSION_RETRIGGER_GUARD_MS = 35000;

const retriggerGuardUntil = new Map<number, number>();

export function markAlarmRetriggerPending(alarmId: number) {
  retriggerGuardUntil.set(alarmId, Date.now() + MISSION_RETRIGGER_GUARD_MS);
}

export function clearAlarmRetriggerPending(alarmId: number) {
  retriggerGuardUntil.delete(alarmId);
}

export function shouldSkipAlarmSyncForRetrigger(alarmId: number) {
  const until = retriggerGuardUntil.get(alarmId);
  if (!until) return false;
  if (Date.now() > until) {
    retriggerGuardUntil.delete(alarmId);
    return false;
  }
  return true;
}
