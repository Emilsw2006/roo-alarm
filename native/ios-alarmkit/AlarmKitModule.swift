import Foundation
import React
import WidgetKit

#if canImport(AlarmKit)
import AlarmKit
import SwiftUI

nonisolated struct RooAlarmMetadata: AlarmMetadata, Codable, Hashable {}

@available(iOS 26.0, *)
private func parseWeekdayIndices(_ raw: [NSNumber]) -> [Int] {
  raw.map { $0.intValue }
}

@available(iOS 26.0, *)
private func retriggerKey(for appAlarmId: String) -> String {
  "retrigger-\(appAlarmId)"
}
#endif

@available(iOS 26.0, *)
private func scheduleConfigurations(
  _ manager: AlarmManager,
  id uuid: UUID,
  alarmId: String,
  configurations: [AlarmManager.AlarmConfiguration<RooAlarmMetadata>]
) async -> (Bool, String?) {
  var lastError: String? = nil
  for config in configurations {
    do {
      _ = try await manager.schedule(id: uuid, configuration: config)
      NSLog("[RooAlarm] scheduled %@ successfully", alarmId)
      return (true, nil)
    } catch let scheduleError {
      let errStr = String(describing: scheduleError)
      lastError = errStr
      NSLog("[RooAlarm] schedule attempt failed for %@: %@", alarmId, errStr)
    }
  }
  return (false, lastError)
}

@available(iOS 26.0, *)
private func scheduledAlarmConfigurations(
  uuid: UUID,
  title: String,
  schedule: Alarm.Schedule,
  soundId: String,
  appAlarmId: String
) -> [AlarmManager.AlarmConfiguration<RooAlarmMetadata>] {
  [
    RooAlarmConfigurationFactory.makeStandardScheduledConfiguration(
      uuid: uuid,
      title: title,
      schedule: schedule,
      soundId: soundId,
      appAlarmId: appAlarmId
    ),
    RooAlarmConfigurationFactory.makeScheduledConfiguration(
      uuid: uuid,
      title: title,
      schedule: schedule,
      soundId: soundId,
      appAlarmId: appAlarmId
    ),
    RooAlarmConfigurationFactory.makeStopIntentOnlyConfiguration(
      uuid: uuid,
      title: title,
      schedule: schedule,
      soundId: soundId,
      appAlarmId: appAlarmId
    ),
    RooAlarmConfigurationFactory.makeCountdownOnlyScheduledConfiguration(
      uuid: uuid,
      title: title,
      schedule: schedule,
      soundId: soundId
    ),
  ]
}

@objc(AlarmKitModule)
class AlarmKitModule: NSObject {
  private let alarmIdMapKey = "rooalarm.alarmkit.idmap"
  private let soundIdMapKey = "rooalarm.alarmkit.soundmap"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  private func loadAlarmIdMap() -> [String: String] {
    let raw = UserDefaults.standard.dictionary(forKey: alarmIdMapKey) as? [String: String]
    return raw ?? [:]
  }

  private func saveAlarmIdMap(_ map: [String: String]) {
    UserDefaults.standard.set(map, forKey: alarmIdMapKey)
  }

  private func saveSoundId(_ soundId: String, for alarmId: String) {
    var map = UserDefaults.standard.dictionary(forKey: soundIdMapKey) as? [String: String] ?? [:]
    map[alarmId] = soundId
    UserDefaults.standard.set(map, forKey: soundIdMapKey)
  }

  private func soundId(for alarmId: String) -> String {
    let map = UserDefaults.standard.dictionary(forKey: soundIdMapKey) as? [String: String]
    return map?[alarmId] ?? "radar_classic"
  }

  private func alarmUUID(for appAlarmId: String) -> UUID {
    var map = loadAlarmIdMap()
    if let existing = map[appAlarmId], let uuid = UUID(uuidString: existing) {
      return uuid
    }
    let uuid = UUID()
    map[appAlarmId] = uuid.uuidString
    saveAlarmIdMap(map)
    return uuid
  }

  @objc
  func consumePendingAlarmLaunch(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // El re-disparo al deslizar lo gestiona la app vía consumePendingDismissRetrigger
    // (suena alarma completa, no notificación). No usar flushIfNeeded aquí para evitar
    // que reprograme el countdown nativo y borre el marcador antes de tiempo.
    resolve(RooAlarmPendingLaunch.consume() as Any)
  }

  @objc
  func clearPendingAlarmLaunch(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    RooAlarmPendingLaunch.clear()
    resolve(true)
  }

  @objc
  func consumePendingDismissRetrigger(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      resolve(RooAlarmPendingDismissRetrigger.consume() as Any)
      return
    }
#endif
    resolve(nil)
  }

  @objc
  func syncWidgetStreak(
    _ streak: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if let defaults = UserDefaults(suiteName: "group.com.roo.alarm") {
      defaults.set(streak.intValue, forKey: "widget_streak")
      #if canImport(WidgetKit)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      #endif
      resolve(true)
    } else {
      reject("WIDGET_SYNC_ERROR", "Could not open App Group UserDefaults", nil)
    }
  }

  @objc
  func syncWidgetNextAlarm(
    _ nextAlarmTime: String?,
    nextAlarmLabel: String?,
    isDaily: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if let defaults = UserDefaults(suiteName: "group.com.roo.alarm") {
      defaults.set(nextAlarmTime, forKey: "widget_next_alarm_time")
      defaults.set(nextAlarmLabel, forKey: "widget_next_alarm_label")
      defaults.set(isDaily.boolValue, forKey: "widget_is_daily")
      #if canImport(WidgetKit)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      #endif
      resolve(true)
    } else {
      reject("WIDGET_SYNC_ERROR", "Could not open App Group UserDefaults", nil)
    }
  }

  @objc
  func cancelDismissRetrigger(
    _ alarmId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      Task {
        await RooAlarmDismissRetrigger.cancel(appAlarmId: alarmId)
        RooAlarmPendingDismissRetrigger.clear(appAlarmId: alarmId)
        let map = loadAlarmIdMap()
        let retriggerId = retriggerKey(for: alarmId)
        if let existing = map[retriggerId], let uuid = UUID(uuidString: existing) {
          try? AlarmManager.shared.cancel(id: uuid)
        }
        resolve(true)
      }
      return
    }
#endif
    RooAlarmPendingDismissRetrigger.clear(appAlarmId: alarmId)
    resolve(true)
  }

  @objc
  func getAlarmKitStatus(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      let manager = AlarmManager.shared
      let auth: String
      switch manager.authorizationState {
      case .authorized:
        auth = "authorized"
      case .denied:
        auth = "denied"
      case .notDetermined:
        auth = "notDetermined"
      @unknown default:
        auth = "notDetermined"
      }
      resolve([
        "available": true,
        "authorized": auth == "authorized",
        "authorization": auth,
      ])
      return
    }
    resolve([
      "available": false,
      "authorized": false,
      "authorization": "unsupported",
      "reason": "ios_version",
    ])
    return
#endif
    resolve([
      "available": false,
      "authorized": false,
      "authorization": "unsupported",
      "reason": "no_alarmkit",
    ])
  }

  @objc
  func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      Task {
        do {
          let manager = AlarmManager.shared
          if manager.authorizationState == .authorized {
            resolve("authorized")
            return
          }
          let state = try await manager.requestAuthorization()
          switch state {
          case .authorized:
            resolve("authorized")
          case .denied:
            resolve("denied")
          default:
            resolve("notDetermined")
          }
        } catch {
          reject("alarmkit_auth_error", error.localizedDescription, error)
        }
      }
      return
    }
#endif
    resolve("unsupported")
  }

  @objc
  func scheduleAlarm(
    _ alarmId: String,
    hour: NSNumber,
    minute: NSNumber,
    title: String,
    soundId: String,
    weekdays: [NSNumber],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      Task {
        do {
          let manager = AlarmManager.shared
          guard manager.authorizationState == .authorized else {
            resolve(false)
            return
          }
          saveSoundId(soundId, for: alarmId)
          RooAlarmDismissRetrigger.storeTitle(title, for: alarmId)
          let time = Alarm.Schedule.Relative.Time(hour: hour.intValue, minute: minute.intValue)
          let days = RooAlarmSoundCatalog.weekdays(fromMondayIndices: parseWeekdayIndices(weekdays))
          let relative = Alarm.Schedule.Relative(time: time, repeats: .weekly(days))
          let schedule = Alarm.Schedule.relative(relative)
          let uuid = alarmUUID(for: alarmId)
          try? manager.cancel(id: uuid)
          let (ok, _) = await scheduleConfigurations(
            manager,
            id: uuid,
            alarmId: alarmId,
            configurations: scheduledAlarmConfigurations(
              uuid: uuid,
              title: title,
              schedule: schedule,
              soundId: soundId,
              appAlarmId: alarmId
            )
          )
          resolve(ok)
        } catch let error {
          NSLog("[RooAlarm] scheduleAlarm failed for %@: %@", alarmId, String(describing: error))
          resolve(false)
        }
      }
      return
    }
#endif
    resolve(false)
  }

  @objc
  func scheduleAlarmAt(
    _ alarmId: String,
    fireAtMs: NSNumber,
    title: String,
    soundId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      Task {
        do {
          let manager = AlarmManager.shared
          guard manager.authorizationState == .authorized else {
            resolve(false)
            return
          }
          saveSoundId(soundId, for: alarmId)
          RooAlarmDismissRetrigger.storeTitle(title, for: alarmId)
          let fireDate = Date(timeIntervalSince1970: fireAtMs.doubleValue / 1000.0)
          let schedule = Alarm.Schedule.fixed(fireDate)
          let uuid = alarmUUID(for: alarmId)
          try? manager.cancel(id: uuid)
          let (ok, lastError) = await scheduleConfigurations(
            manager,
            id: uuid,
            alarmId: alarmId,
            configurations: scheduledAlarmConfigurations(
              uuid: uuid,
              title: title,
              schedule: schedule,
              soundId: soundId,
              appAlarmId: alarmId
            )
          )
          if ok {
            resolve(["ok": true])
          } else {
            resolve(["ok": false, "error": lastError ?? "Unknown native error"])
          }
        } catch let error {
          NSLog("[RooAlarm] scheduleAlarmAt failed for %@: %@", alarmId, String(describing: error))
          resolve(["ok": false, "error": String(describing: error)])
        }
      }
      return
    }
#endif
    resolve(["ok": false, "error": "unsupported"])
  }

  @objc
  func cancelAlarm(_ alarmId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      Task {
        do {
          let map = loadAlarmIdMap()
          let keys = [alarmId, "\(alarmId).next", retriggerKey(for: alarmId)]
          for key in keys {
            if let existing = map[key], let uuid = UUID(uuidString: existing) {
              try? AlarmManager.shared.cancel(id: uuid)
            }
          }
          await RooAlarmDismissRetrigger.cancel(appAlarmId: alarmId)
          resolve(true)
        } catch {
          resolve(false)
        }
      }
      return
    }
#endif
    resolve(false)
  }

  @objc
  func retriggerAlarm(
    _ alarmId: String,
    title: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      Task {
        RooAlarmDismissRetrigger.storeTitle(title, for: alarmId)
        // Mismo camino probado que al deslizar: one-shot AlarmKit completo en 30s.
        let ok = await RooAlarmDismissRetrigger.schedule(
          appAlarmId: alarmId,
          delaySeconds: RooAlarmConfigurationFactory.dismissRetriggerSeconds
        )
        resolve(ok)
      }
      return
    }
#endif
    resolve(false)
  }

  @objc
  func triggerSimulationNow(
    _ title: String,
    body: String,
    soundId: String,
    alarmId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      Task {
        do {
          let manager = AlarmManager.shared
          guard manager.authorizationState == .authorized else {
            resolve(false)
            return
          }
          let appAlarmId = alarmId.isEmpty ? "simulation" : alarmId
          saveSoundId(soundId, for: appAlarmId)
          RooAlarmDismissRetrigger.storeTitle(title, for: appAlarmId)
          let mapKey = appAlarmId == "simulation" ? "simulation" : retriggerKey(for: appAlarmId)
          let uuid = alarmUUID(for: mapKey)
          try? manager.cancel(id: uuid)
          let launchId = appAlarmId == "simulation" ? "simulation" : appAlarmId
          let configs: [AlarmManager.AlarmConfiguration<RooAlarmMetadata>] = [
            RooAlarmConfigurationFactory.makeOneShotConfiguration(
              uuid: uuid,
              title: title,
              soundId: soundId,
              appAlarmId: launchId,
              preAlertSeconds: 1
            ),
            RooAlarmConfigurationFactory.makeOneShotCountdownConfiguration(
              uuid: uuid,
              title: title,
              soundId: soundId,
              preAlertSeconds: 1
            ),
          ]
          let (ok, _) = await scheduleConfigurations(manager, id: uuid, alarmId: mapKey, configurations: configs)
          resolve(ok)
        } catch {
          reject("alarmkit_sim_error", error.localizedDescription, error)
        }
      }
      return
    }
#endif
    resolve(false)
  }

  /// Programa una alarma nativa como red de seguridad durante la misión.
  /// Si la app muere antes de que se cancele, la alarma volverá a sonar.
  @objc
  func scheduleMissionWatchdog(
    _ alarmId: String,
    title: String,
    delaySeconds: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
#if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      Task {
        RooAlarmDismissRetrigger.storeTitle(title, for: alarmId)
        let ok = await RooAlarmDismissRetrigger.schedule(
          appAlarmId: alarmId,
          delaySeconds: delaySeconds.intValue
        )
        NSLog("[RooAlarm] scheduleMissionWatchdog delay=%ds alarm=%@ ok=%@", delaySeconds.intValue, alarmId, ok ? "true" : "false")
        resolve(ok)
      }
      return
    }
#endif
    resolve(false)
  }
}
