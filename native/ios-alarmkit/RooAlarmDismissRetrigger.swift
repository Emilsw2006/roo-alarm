import Foundation

#if canImport(AlarmKit)
import AlarmKit

@available(iOS 26.0, *)
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

  static func schedule(appAlarmId: String, delaySeconds: Int = RooAlarmConfigurationFactory.dismissRetriggerSeconds) async -> Bool {
    guard !appAlarmId.isEmpty, appAlarmId != "simulation" else { return false }
    let manager = AlarmManager.shared
    guard manager.authorizationState == .authorized else { return false }

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
    return false
  }

  static func cancel(appAlarmId: String) async {
    guard !appAlarmId.isEmpty, appAlarmId != "simulation" else { return }
    let key = dismissKey(for: appAlarmId)
    let map = loadIdMap()
    guard let existing = map[key], let uuid = UUID(uuidString: existing) else { return }
    try? AlarmManager.shared.cancel(id: uuid)
  }
}
#endif
