import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import Icon from './Icon';
import SquishyButton from './SquishyButton';

import { useLanguage } from '../constants/LanguageContext';
import { Alarm } from '../constants/data';
import { HomeLayoutMetrics } from '../lib/homeLayout';

interface AlarmWidgetsProps {
  dailyTitle?: string;
  timeRemaining: string;
  missionName: string;
  dailyAlarmTime?: string;
  dailyAlarmAmpm?: string;
  dailyLocked?: boolean;
  dailyLockedSubtitle?: string;
  onPressLeft: () => void;
  onPressRight: () => void;
  otherAlarms?: Alarm[];
  layout: HomeLayoutMetrics;
}

export default function AlarmWidgets({ dailyTitle, timeRemaining, missionName, dailyAlarmTime, dailyAlarmAmpm, dailyLocked = false, dailyLockedSubtitle, onPressLeft, onPressRight, otherAlarms = [], layout }: AlarmWidgetsProps) {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <View style={[styles.container, { gap: layout.widgetGap }]}>
      <SquishyButton 
        onPress={onPressLeft}
        color={colors.accSolid}
        shadowColor="rgba(211, 73, 69, 0.14)"
        shadowDepth={9}
        borderRadius={layout.widgetBorderRadius}
        style={[styles.widgetButton, { opacity: dailyLocked ? 0.88 : 1 }]}
        contentStyle={[
          styles.dailyWidgetInner,
          {
            height: layout.widgetHeight,
            paddingHorizontal: layout.widgetPaddingH,
            paddingVertical: layout.widgetPaddingV,
          },
        ]}
      >
        <Text style={[styles.widgetTitle, { color: colors.bg, opacity: 0.78 }]} numberOfLines={1}>
          {dailyLocked ? t('dailyCompletedToday').toUpperCase() : (dailyTitle || t('dailyAlarm'))}
        </Text>
        <Text style={[styles.dailyMissionText, { color: colors.bg, opacity: dailyLocked ? 0.72 : 0.82 }]} numberOfLines={2}>
          {dailyLocked ? (dailyLockedSubtitle || t('dailyAlarmDoneToday')) : missionName}
        </Text>
        <View style={styles.timeRow}>
          <Text
            style={[
              styles.alarmTime,
              {
                color: colors.bg,
                fontSize: dailyLocked ? layout.alarmTimeLockedFontSize : layout.alarmTimeFontSize,
                lineHeight: (dailyLocked ? layout.alarmTimeLockedFontSize : layout.alarmTimeFontSize) + 4,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {dailyAlarmTime || timeRemaining}
          </Text>
          {dailyAlarmAmpm ? <Text style={[styles.alarmAmpm, { color: colors.bg }]}>{dailyAlarmAmpm}</Text> : null}
        </View>
      </SquishyButton>

      {/* Right Widget: Other Alarms */}
      <SquishyButton 
        onPress={onPressRight}
        color={colors.brandOrange || '#FFA000'}
        shadowColor="rgba(178, 128, 24, 0.14)"
        shadowDepth={9}
        borderRadius={layout.widgetBorderRadius}
        style={styles.widgetButton}
        contentStyle={[
          styles.otherWidgetInner,
          {
            height: layout.widgetHeight,
            paddingHorizontal: layout.widgetPaddingH,
            paddingVertical: layout.widgetPaddingV,
          },
        ]}
      >
        <View style={styles.otherTextBlock}>
          <Text style={[styles.missionText, { color: colors.bg }]} numberOfLines={1}>
            {t('otherAlarms')}
          </Text>
          {otherAlarms.length > 0 ? (
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.bg, opacity: 0.8, letterSpacing: -0.2 }} numberOfLines={1}>
              {otherAlarms[0].specificDate 
                ? `${new Date(otherAlarms[0].specificDate).getDate()} ${new Date(otherAlarms[0].specificDate).toLocaleString('default', { month: 'short' })} - ${otherAlarms[0].time}`
                : `${otherAlarms[0].time} ${otherAlarms[0].ampm}`}
              {otherAlarms.length > 1 ? ' ...' : ''}
            </Text>
          ) : (
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.bg, opacity: 0.8, letterSpacing: -0.2 }}>
              {t('manage')}
            </Text>
          )}
        </View>
        <View style={styles.otherIconWrap}>
          <Icon name="layers" size={Math.round(layout.alarmTimeFontSize)} color={colors.bg} variant="solid" />
        </View>
      </SquishyButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingBottom: 10,
  },
  widgetButton: {
    flex: 1,
    minWidth: 0,
  },
  dailyWidgetInner: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  otherWidgetInner: {
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  glassBg: {
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  missionText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  dailyMissionText: {
    alignSelf: 'stretch',
    textAlign: 'left',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  otherTextBlock: {
    gap: 5,
    paddingRight: 4,
  },
  otherIconWrap: {
    marginTop: 'auto',
    alignSelf: 'flex-end',
    marginRight: 4,
    marginBottom: 2,
  },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', maxWidth: '100%', flexShrink: 1 },
  alarmTime: { fontWeight: '900', letterSpacing: 0, flexShrink: 1 },
  alarmAmpm: { fontSize: 13, fontWeight: '900', marginLeft: 3, opacity: 0.82 },
  widgetTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
});
