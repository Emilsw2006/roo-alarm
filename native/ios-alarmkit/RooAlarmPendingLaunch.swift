import Foundation

enum RooAlarmPendingLaunch {
  private static let appAlarmIdKey = "rooalarm.pending_app_alarm_id"
  private static let kitIdKey = "rooalarm.pending_kit_alarm_id"
  private static let mapKey = "rooalarm.alarmkit.idmap"

  static func storeAppAlarmId(_ appAlarmId: String) {
    UserDefaults.standard.set(appAlarmId, forKey: appAlarmIdKey)
    UserDefaults.standard.removeObject(forKey: kitIdKey)
  }

  static func store(alarmKitUUID: String) {
    UserDefaults.standard.set(alarmKitUUID, forKey: kitIdKey)
    if let map = UserDefaults.standard.dictionary(forKey: mapKey) as? [String: String],
       let appId = map.first(where: { $0.value == alarmKitUUID })?.key {
      UserDefaults.standard.set(appId, forKey: appAlarmIdKey)
    } else if alarmKitUUID.hasPrefix("retrigger-") {
      UserDefaults.standard.set(String(alarmKitUUID.dropFirst("retrigger-".count)), forKey: appAlarmIdKey)
    } else {
      UserDefaults.standard.set("simulation", forKey: appAlarmIdKey)
    }
  }

  static func consume() -> String? {
    guard let appId = UserDefaults.standard.string(forKey: appAlarmIdKey) else {
      return nil
    }
    UserDefaults.standard.removeObject(forKey: appAlarmIdKey)
    UserDefaults.standard.removeObject(forKey: kitIdKey)
    return appId
  }

  static func clear() {
    UserDefaults.standard.removeObject(forKey: appAlarmIdKey)
    UserDefaults.standard.removeObject(forKey: kitIdKey)
  }
}
