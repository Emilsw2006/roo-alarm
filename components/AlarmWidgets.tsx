import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import Icon from './Icon';
import SquishyButton from './SquishyButton';

import { useLanguage } from '../constants/LanguageContext';
import { Alarm } from '../constants/data';

interface AlarmWidgetsProps {
  dailyTitle?: string;
  timeRemaining: string;
  missionName: string;
  dailyAlarmTime?: string;
  dailyAlarmAmpm?: string;
  onPressLeft: () => void;
  onPressRight: () => void;
  otherAlarms?: Alarm[];
}

export default function AlarmWidgets({ dailyTitle, timeRemaining, missionName, dailyAlarmTime, dailyAlarmAmpm, onPressLeft, onPressRight, otherAlarms = [] }: AlarmWidgetsProps) {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <SquishyButton 
        onPress={onPressLeft}
        color={colors.accSolid}
        shadowColor="rgba(211, 73, 69, 0.14)"
        shadowDepth={9}
        borderRadius={34}
        style={{ flex: 1 }}
        contentStyle={styles.dailyWidgetInner}
      >
        <Text style={[styles.widgetTitle, { color: colors.bg, opacity: 0.78 }]} numberOfLines={1}>
          {dailyTitle || t('dailyAlarm')}
        </Text>
        <Text style={[styles.dailyMissionText, { color: colors.bg, opacity: 0.82 }]} numberOfLines={2}>
          {missionName}
        </Text>
        <View style={styles.timeRow}>
          <Text style={[styles.alarmTime, { color: colors.bg }]} numberOfLines={1}>
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
        borderRadius={34}
        style={{ flex: 1 }}
        contentStyle={styles.otherWidgetInner}
      >
        <View style={styles.otherTextBlock}>
          <Text style={[styles.missionText, { color: colors.bg }]} numberOfLines={1}>
            {t('otherAlarms')}
          </Text>
          {otherAlarms.length > 0 ? (
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.bg, opacity: 0.8, letterSpacing: -0.2 }}>
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
          <Icon name="layers" size={34} color={colors.bg} variant="solid" />
        </View>
      </SquishyButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 18,
    paddingBottom: 10,
  },
  widgetInner: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    height: 134,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dailyWidgetInner: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    height: 138,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  otherWidgetInner: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    height: 138,
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
  timeRow: { flexDirection: 'row', alignItems: 'baseline', maxWidth: '100%' },
  alarmTime: { fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: 0 },
  alarmAmpm: { fontSize: 13, fontWeight: '900', marginLeft: 3, opacity: 0.82 },
  widgetTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
});
