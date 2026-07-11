import Foundation

/// Persists a dismiss retrigger if the slide intent is interrupted before scheduling completes.
enum RooAlarmPendingDismissRetrigger {
  private static let key = "rooalarm.pending_dismiss_retrigger"

  private struct Pending: Codable {
    let appAlarmId: String
    let fireAt: TimeInterval
  }

  static func store(appAlarmId: String, delaySeconds: Int) {
    guard !appAlarmId.isEmpty, appAlarmId != "simulation" else { return }
    let fireAt = Date().addingTimeInterval(TimeInterval(max(1, delaySeconds))).timeIntervalSince1970
    let pending = Pending(appAlarmId: appAlarmId, fireAt: fireAt)
    if let data = try? JSONEncoder().encode(pending) {
      UserDefaults.standard.set(data, forKey: key)
    }
  }

  static func clear(appAlarmId: String) {
    guard let data = UserDefaults.standard.data(forKey: key),
          let pending = try? JSONDecoder().decode(Pending.self, from: data),
          pending.appAlarmId == appAlarmId
    else { return }
    UserDefaults.standard.removeObject(forKey: key)
  }

  /// Devuelve el appAlarmId pendiente (si lo hay) y lo borra. Lo usa la app al abrirse
  /// tras deslizar para volver a sonar la alarma completa con el camino fiable.
  static func consume() -> String? {
    guard let data = UserDefaults.standard.data(forKey: key),
          let pending = try? JSONDecoder().decode(Pending.self, from: data),
          !pending.appAlarmId.isEmpty
    else { return nil }
    UserDefaults.standard.removeObject(forKey: key)
    return pending.appAlarmId
  }

  static func clearAny() {
    UserDefaults.standard.removeObject(forKey: key)
  }

  static func flushIfNeeded() async {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      guard let data = UserDefaults.standard.data(forKey: key),
            let pending = try? JSONDecoder().decode(Pending.self, from: data),
            !pending.appAlarmId.isEmpty
      else { return }

      let remaining = Int(ceil(pending.fireAt - Date().timeIntervalSince1970))
      await RooAlarmDismissRetrigger.schedule(
        appAlarmId: pending.appAlarmId,
        delaySeconds: max(1, remaining)
      )
      UserDefaults.standard.removeObject(forKey: key)
    }
#endif
  }
}
