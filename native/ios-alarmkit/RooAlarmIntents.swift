import Foundation

#if canImport(AlarmKit)
import AlarmKit
import AppIntents

/// System slide / stop: re-schedule the alarm; opening the app makes intent execution reliable.
@available(iOS 26.0, *)
public struct RooAlarmSlideDismissIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Posponer alarma"
  public static var description = IntentDescription("Vuelve a sonar la alarma si no completas la misión")
  public static var openAppWhenRun: Bool { false }
  public static var supportedModes: IntentModes { .background }

  @Parameter(title: "alarmKitID")
  public var alarmKitID: String

  public init() {
    self.alarmKitID = ""
  }

  public init(alarmKitID: String) {
    self.alarmKitID = alarmKitID
  }

  public func perform() async throws -> some IntentResult {
    let delay = RooAlarmConfigurationFactory.dismissRetriggerSeconds
    // Deja el marcador pendiente SIEMPRE: la app lo consume al abrir (openAppWhenRun)
    // y vuelve a sonar la alarma COMPLETA vía triggerSimulationNow (no notificación).
    // El schedule nativo queda solo como respaldo por si la app no llega a abrirse;
    // la app lo cancela antes de disparar para no sonar dos veces.
    RooAlarmPendingDismissRetrigger.store(appAlarmId: alarmKitID, delaySeconds: delay)
    _ = await RooAlarmDismissRetrigger.schedule(appAlarmId: alarmKitID, delaySeconds: delay)
    return .result()
  }
}

@available(iOS 26.0, *)
public struct RooAlarmOpenIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Desbloquear misión"
  public static var description = IntentDescription("Abre Roo Alarm para completar la misión")
  public static var openAppWhenRun: Bool { true }
  public static var supportedModes: IntentModes { .foreground(.immediate) }

  @Parameter(title: "alarmKitID")
  public var alarmKitID: String

  public init() {
    self.alarmKitID = ""
  }

  public init(alarmKitID: String) {
    self.alarmKitID = alarmKitID
  }

  public func perform() async throws -> some IntentResult {
    RooAlarmPendingLaunch.storeAppAlarmId(alarmKitID)
    await RooAlarmDismissRetrigger.cancel(appAlarmId: alarmKitID)
    return .result()
  }
}
#endif
