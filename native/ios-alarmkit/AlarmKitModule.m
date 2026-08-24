#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AlarmKitModule, NSObject)

RCT_EXTERN_METHOD(consumePendingAlarmLaunch:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getAlarmKitStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(scheduleAlarm:(NSString *)alarmId
                  hour:(nonnull NSNumber *)hour
                  minute:(nonnull NSNumber *)minute
                  title:(NSString *)title
                  soundId:(NSString *)soundId
                  weekdays:(NSArray<NSNumber *> *)weekdays
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(scheduleAlarmAt:(NSString *)alarmId
                  fireAtMs:(nonnull NSNumber *)fireAtMs
                  title:(NSString *)title
                  soundId:(NSString *)soundId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancelAlarm:(NSString *)alarmId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(retriggerAlarm:(NSString *)alarmId
                  title:(NSString *)title
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPendingAlarmLaunch:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(consumePendingDismissRetrigger:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancelDismissRetrigger:(NSString *)alarmId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(triggerSimulationNow:(NSString *)title
                  body:(NSString *)body
                  soundId:(NSString *)soundId
                  alarmId:(NSString *)alarmId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(scheduleMissionWatchdog:(NSString *)alarmId
                  title:(NSString *)title
                  delaySeconds:(nonnull NSNumber *)delaySeconds
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(syncWidgetStreak:(nonnull NSNumber *)streak
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(syncWidgetNextAlarm:(NSString *)nextAlarmTime
                  nextAlarmLabel:(NSString *)nextAlarmLabel
                  isDaily:(nonnull NSNumber *)isDaily
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
