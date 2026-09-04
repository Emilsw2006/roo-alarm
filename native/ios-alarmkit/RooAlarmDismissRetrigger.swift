import Foundation
import UserNotifications

#if canImport(AlarmKit)
import AlarmKit
#endif

enum RooAlarmDismissRetrigger {
  private static let idMapKey = "rooalarm.alarmkit.idmap"
  private static let soundMapKey = "rooalarm.alarmkit.soundmap"
  private static let titleMapKey = "rooalarm.alarmkit.titlemap"

  static func storeTitle(_ title: String, for appAlarmId: String) {
    var map = UserDefaults.standard.dictionary(forKey: titleMapKey) as? [String: String] ?? [:]
    map[appAlarmId] = title
    UserDefaults.standard.set(map, forKey: titleMapKey)
  }

  private static func dismissKey(for appAlarmId: String) -> String {
    "dismiss-retrigger-\(appAlarmId)"
  }

  private static func loadIdMap() -> [String: String] {
    UserDefaults.standard.dictionary(forKey: idMapKey) as? [String: String] ?? [:]
  }

  private static func saveIdMap(_ map: [String: String]) {
    UserDefaults.standard.set(map, forKey: idMapKey)
  }

  private static func alarmUUID(for mapKey: String) -> UUID {
    var map = loadIdMap()
    if let existing = map[mapKey], let uuid = UUID(uuidString: existing) {
      return uuid
    }
    let uuid = UUID()
    map[mapKey] = uuid.uuidString
    saveIdMap(map)
    return uuid
  }

  private static func soundId(for appAlarmId: String) -> String {
    let map = UserDefaults.standard.dictionary(forKey: soundMapKey) as? [String: String]
    return map?[appAlarmId] ?? "radar_classic"
  }

  private static func title(for appAlarmId: String) -> String {
    let map = UserDefaults.standard.dictionary(forKey: titleMapKey) as? [String: String]
    return map?[appAlarmId] ?? "Roo Alarm"
  }

  static func scheduleFallback(appAlarmId: String, delaySeconds: Int = 5) {
    let center = UNUserNotificationCenter.current()
    let content = UNMutableNotificationContent()
    content.title = "⏰ ¡ALARMA ACTIVA!"
    content.body = "¡Haz la foto para apagar la alarma!"
    let soundName = soundId(for: appAlarmId) + ".mp3"
    if #available(iOS 15.0, *) {
      content.sound = UNNotificationSound.criticalSoundNamed(UNNotificationSoundName(rawValue: soundName), withAudioVolume: 1.0)
      content.interruptionLevel = .critical
    } else {
      content.sound = UNNotificationSound.defaultCritical
    }
    content.userInfo = ["alarmId": appAlarmId, "source": "rooalarm"]
    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(max(1, delaySeconds)), repeats: false)
    let request = UNNotificationRequest(identifier: "retrigger-\(appAlarmId)", content: content, trigger: trigger)
    center.add(request, withCompletionHandler: nil)
  }

  static func schedule(appAlarmId: String, delaySeconds: Int = 1) async -> Bool {
    guard !appAlarmId.isEmpty, appAlarmId != "simulation" else { return false }

#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      let manager = AlarmManager.shared
      if manager.authorizationState == .authorized {
        let key = dismissKey(for: appAlarmId)
        let uuid = alarmUUID(for: key)
        try? manager.cancel(id: uuid)

        let delay = max(1, delaySeconds)
        let title = title(for: appAlarmId)
        let sound = soundId(for: appAlarmId)
        let fireDate = Date().addingTimeInterval(TimeInterval(delay))
        let configs: [AlarmManager.AlarmConfiguration<RooAlarmMetadata>] = [
          RooAlarmConfigurationFactory.makeDelayedRetriggerOneShotConfiguration(
            uuid: uuid,
            title: title,
            soundId: sound,
            appAlarmId: appAlarmId,
            delaySeconds: delay
          ),
          RooAlarmConfigurationFactory.makeDelayedRetriggerOneShotSimpleConfiguration(
            uuid: uuid,
            title: title,
            soundId: sound,
            delaySeconds: delay
          ),
          RooAlarmConfigurationFactory.makeDismissRetriggerConfiguration(
            uuid: uuid,
            title: title,
            soundId: sound,
            appAlarmId: appAlarmId,
            fireDate: fireDate
          ),
          RooAlarmConfigurationFactory.makeDismissRetriggerCountdownConfiguration(
            uuid: uuid,
            title: title,
            soundId: sound,
            fireDate: fireDate
          ),
        ]

        for config in configs {
          do {
            _ = try await manager.schedule(id: uuid, configuration: config)
            NSLog("[RooAlarm] dismiss retrigger one-shot in %ds for %@", delay, appAlarmId)
            return true
          } catch {
            NSLog("[RooAlarm] dismiss retrigger failed for %@: %@", appAlarmId, String(describing: error))
          }
        }
      }
    }
#endif

    scheduleFallback(appAlarmId: appAlarmId, delaySeconds: delaySeconds)
    return true
  }

  static func cancel(appAlarmId: String) async {
    guard !appAlarmId.isEmpty, appAlarmId != "simulation" else { return }
    let center = UNUserNotificationCenter.current()
    center.removePendingNotificationRequests(withIdentifiers: ["retrigger-\(appAlarmId)"])

#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      let key = dismissKey(for: appAlarmId)
      let map = loadIdMap()
      if let existing = map[key], let uuid = UUID(uuidString: existing) {
        try? AlarmManager.shared.cancel(id: uuid)
      }
    }
#endif
  }
}

