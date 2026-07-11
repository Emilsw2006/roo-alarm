import Foundation

#if canImport(AlarmKit)
import AlarmKit
import SwiftUI

@available(iOS 26.0, *)
enum RooAlarmConfigurationFactory {
  static let rooRed = Color(red: 231 / 255, green: 71 / 255, blue: 60 / 255)
  /// Seconds before the alarm rings again after slide dismiss or 60s mission timeout.
  static let dismissRetriggerSeconds = 30

  static let unlockButton = AlarmButton(
    text: "Desbloquear",
    textColor: .white,
    systemImageName: "arrow.right.circle.fill"
  )

  static let slideStopButton = AlarmButton(
    text: "Posponer",
    textColor: .white,
    systemImageName: "clock.arrow.circlepath"
  )

  static var dismissSnoozeDuration: Alarm.CountdownDuration {
    Alarm.CountdownDuration(
      preAlert: nil,
      postAlert: TimeInterval(dismissRetriggerSeconds)
    )
  }

  /// Sin postAlert en la alarma programada: el re-disparo lo gestiona RooAlarmSlideDismissIntent
  /// (evita que iOS muestre solo una notificación/countdown al deslizar).
  static var scheduledAlarmCountdown: Alarm.CountdownDuration {
    Alarm.CountdownDuration(preAlert: nil, postAlert: nil)
  }

  /// Full UI: Desbloquear (rojo/blanco vía tintColor) + retrigger al cerrar/deslizar.
  static func makeAlertPresentation(title: String) -> AlarmPresentation.Alert {
    let alertTitle = LocalizedStringResource(stringLiteral: title.isEmpty ? "Roo Alarm" : title)
    if #available(iOS 26.1, *) {
      return AlarmPresentation.Alert(
        title: alertTitle,
        stopButton: slideStopButton,
        secondaryButton: unlockButton,
        secondaryButtonBehavior: .custom
      )
    }
    return AlarmPresentation.Alert(
      title: alertTitle,
      stopButton: slideStopButton,
      secondaryButton: unlockButton,
      secondaryButtonBehavior: .custom
    )
  }

  /// Minimal presentation used when the full config cannot be scheduled.
  static func makeSimpleAlertPresentation(title: String) -> AlarmPresentation.Alert {
    let alertTitle = LocalizedStringResource(stringLiteral: title.isEmpty ? "Roo Alarm" : title)
    if #available(iOS 26.1, *) {
      return AlarmPresentation.Alert(title: alertTitle)
    }
    return AlarmPresentation.Alert(
      title: alertTitle,
      stopButton: AlarmButton(
        text: "Detener",
        textColor: .white,
        systemImageName: "stop.circle.fill"
      ),
      secondaryButtonBehavior: .countdown
    )
  }

  static func makeAttributes(title: String, simple: Bool = false) -> AlarmAttributes<RooAlarmMetadata> {
    AlarmAttributes<RooAlarmMetadata>(
      presentation: AlarmPresentation(
        alert: simple ? makeSimpleAlertPresentation(title: title) : makeAlertPresentation(title: title)
      ),
      metadata: RooAlarmMetadata(),
      tintColor: rooRed
    )
  }

  static func makeScheduledConfiguration(
    uuid: UUID,
    title: String,
    schedule: Alarm.Schedule,
    soundId: String,
    appAlarmId: String
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    let attributes = makeAttributes(title: title)
    return AlarmManager.AlarmConfiguration(
      countdownDuration: scheduledAlarmCountdown,
      schedule: schedule,
      attributes: attributes,
      stopIntent: RooAlarmSlideDismissIntent(alarmKitID: appAlarmId),
      secondaryIntent: RooAlarmOpenIntent(alarmKitID: appAlarmId),
      sound: RooAlarmSoundCatalog.alertSound(for: soundId)
    )
  }

  /// Standard: Desbloquear; al deslizar, RooAlarmSlideDismissIntent programa re-disparo en 30s.
  static func makeStandardScheduledConfiguration(
    uuid: UUID,
    title: String,
    schedule: Alarm.Schedule,
    soundId: String,
    appAlarmId: String
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    let attributes = makeAttributes(title: title)
    return AlarmManager.AlarmConfiguration(
      countdownDuration: scheduledAlarmCountdown,
      schedule: schedule,
      attributes: attributes,
      stopIntent: RooAlarmSlideDismissIntent(alarmKitID: appAlarmId),
      secondaryIntent: RooAlarmOpenIntent(alarmKitID: appAlarmId),
      sound: RooAlarmSoundCatalog.alertSound(for: soundId)
    )
  }

  static func makeSimpleScheduledConfiguration(
    uuid: UUID,
    title: String,
    schedule: Alarm.Schedule,
    soundId: String,
    appAlarmId: String
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    makeStandardScheduledConfiguration(
      uuid: uuid,
      title: title,
      schedule: schedule,
      soundId: soundId,
      appAlarmId: appAlarmId
    )
  }

  /// Slide dismiss intent only — fallback when secondary intent fails validation.
  static func makeStopIntentOnlyConfiguration(
    uuid: UUID,
    title: String,
    schedule: Alarm.Schedule,
    soundId: String,
    appAlarmId: String
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    let attributes = makeAttributes(title: title)
    return AlarmManager.AlarmConfiguration(
      countdownDuration: scheduledAlarmCountdown,
      schedule: schedule,
      attributes: attributes,
      stopIntent: RooAlarmSlideDismissIntent(alarmKitID: appAlarmId),
      sound: RooAlarmSoundCatalog.alertSound(for: soundId)
    )
  }

  /// Built-in countdown retrigger without custom intents — most reliable fallback.
  static func makeCountdownOnlyScheduledConfiguration(
    uuid: UUID,
    title: String,
    schedule: Alarm.Schedule,
    soundId: String
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    let attributes = makeAttributes(title: title, simple: true)
    return AlarmManager.AlarmConfiguration(
      countdownDuration: scheduledAlarmCountdown,
      schedule: schedule,
      attributes: attributes,
      sound: RooAlarmSoundCatalog.alertSound(for: soundId)
    )
  }

  static func makeDismissRetriggerConfiguration(
    uuid: UUID,
    title: String,
    soundId: String,
    appAlarmId: String,
    fireDate: Date
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    let attributes = makeAttributes(title: title)
    return AlarmManager.AlarmConfiguration(
      countdownDuration: dismissSnoozeDuration,
      schedule: .fixed(fireDate),
      attributes: attributes,
      stopIntent: RooAlarmSlideDismissIntent(alarmKitID: appAlarmId),
      secondaryIntent: RooAlarmOpenIntent(alarmKitID: appAlarmId),
      sound: RooAlarmSoundCatalog.alertSound(for: soundId)
    )
  }

  static func makeDismissRetriggerCountdownConfiguration(
    uuid: UUID,
    title: String,
    soundId: String,
    fireDate: Date
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    let attributes = makeAttributes(title: title, simple: true)
    return AlarmManager.AlarmConfiguration(
      countdownDuration: dismissSnoozeDuration,
      schedule: .fixed(fireDate),
      attributes: attributes,
      sound: RooAlarmSoundCatalog.alertSound(for: soundId)
    )
  }

  /// Cuenta atrás + alarma completa (mismo patrón que la simulación, fiable en iOS 26).
  static func makeDelayedRetriggerOneShotConfiguration(
    uuid: UUID,
    title: String,
    soundId: String,
    appAlarmId: String,
    delaySeconds: Int
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    makeOneShotConfiguration(
      uuid: uuid,
      title: title,
      soundId: soundId,
      appAlarmId: appAlarmId,
      preAlertSeconds: delaySeconds
    )
  }

  static func makeDelayedRetriggerOneShotSimpleConfiguration(
    uuid: UUID,
    title: String,
    soundId: String,
    delaySeconds: Int
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    makeOneShotCountdownConfiguration(
      uuid: uuid,
      title: title,
      soundId: soundId,
      preAlertSeconds: delaySeconds
    )
  }

  static func makeOneShotConfiguration(
    uuid: UUID,
    title: String,
    soundId: String,
    appAlarmId: String,
    preAlertSeconds: Int = 1
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    let attributes = makeAttributes(title: title)
    let preAlert = TimeInterval(max(1, preAlertSeconds))
    return AlarmManager.AlarmConfiguration(
      countdownDuration: Alarm.CountdownDuration(preAlert: preAlert, postAlert: TimeInterval(dismissRetriggerSeconds)),
      schedule: nil,
      attributes: attributes,
      stopIntent: RooAlarmSlideDismissIntent(alarmKitID: appAlarmId),
      secondaryIntent: RooAlarmOpenIntent(alarmKitID: appAlarmId),
      sound: RooAlarmSoundCatalog.alertSound(for: soundId)
    )
  }

  static func makeOneShotCountdownConfiguration(
    uuid: UUID,
    title: String,
    soundId: String,
    preAlertSeconds: Int = 1
  ) -> AlarmManager.AlarmConfiguration<RooAlarmMetadata> {
    let attributes = makeAttributes(title: title, simple: true)
    let preAlert = TimeInterval(max(1, preAlertSeconds))
    return AlarmManager.AlarmConfiguration(
      countdownDuration: Alarm.CountdownDuration(preAlert: preAlert, postAlert: TimeInterval(dismissRetriggerSeconds)),
      schedule: nil,
      attributes: attributes,
      sound: RooAlarmSoundCatalog.alertSound(for: soundId)
    )
  }
}
#endif
