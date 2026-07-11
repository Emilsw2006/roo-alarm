import Foundation

#if canImport(AlarmKit)
import AlarmKit
import ActivityKit

enum RooAlarmSoundCatalog {
  @available(iOS 26.0, *)
  static func alertSound(for soundId: String) -> AlertConfiguration.AlertSound {
    _ = soundId
    return .default
  }

  /// protectedDays uses Monday=0 … Sunday=6 (same as JS getMondayDayIndex mapping).
  @available(iOS 26.0, *)
  static func weekdays(fromMondayIndices indices: [Int]) -> [Locale.Weekday] {
    let ordered: [Locale.Weekday] = [
      .monday, .tuesday, .wednesday, .thursday, .friday, .saturday, .sunday,
    ]
    let selected = indices.compactMap { idx -> Locale.Weekday? in
      guard idx >= 0, idx < ordered.count else { return nil }
      return ordered[idx]
    }
    return selected.isEmpty ? ordered : selected
  }
}
#endif
