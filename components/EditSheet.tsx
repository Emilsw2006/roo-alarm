import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Animated, TextInput, Alert } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import { FONT, FONT_FAMILY } from '../constants/theme';
import { DEFAULT_ENABLED_MISSIONS, DEFAULT_PERSONALIZED_MISSION, getMission, MISSION_LIST, MissionMode, normalizeMissionId } from '../constants/missions';
import { useLanguage } from '../constants/LanguageContext';
import { Alarm } from '../constants/data';
import Icon from './Icon';
import MissionGlyph from './MissionGlyph';
import AnimatedTimePicker from './AnimatedTimePicker';
import SquishyButton from './SquishyButton';
import { Calendar } from 'react-native-calendars';
import { useSwipeInteractive } from './useSwipeInteractive';
import * as Haptics from 'expo-haptics';
import { toDateOnlyIso, parseDateOnlyIso } from '../lib/dailyAlarm';

interface EditSheetProps {
  visible: boolean;
  alarm: Alarm;
  onClose: () => void;
  isNew?: boolean;
  isDaily?: boolean;
  onDelete?: (id: number) => void;
  onSave: (updated: Alarm) => void | Promise<void>;
  protectedDays?: number[];
  onProtectedDaysSave?: (days: number[]) => void | Promise<void>;
  missionMode?: MissionMode;
  enabledMissions?: string[];
  personalizedMission?: string;
  onMissionSettingsSave?: (next: { missionMode: MissionMode; enabledMissions: string[]; personalizedMission: string }) => void | Promise<void>;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function EditSheet({
  visible,
  alarm,
  onClose,
  onSave,
  isNew,
  isDaily = true,
  onDelete,
  protectedDays = [0, 1, 2, 3, 4],
  onProtectedDaysSave,
  missionMode = 'roulette',
  enabledMissions = DEFAULT_ENABLED_MISSIONS,
  personalizedMission = DEFAULT_PERSONALIZED_MISSION,
  onMissionSettingsSave,
}: EditSheetProps) {
  const { colors } = useColors();
  const { t, missionCopy, weekdays } = useLanguage();
  const [step, setStep] = useState(1);
  const [customMissionText, setCustomMissionText] = useState(alarm.customMission || '');
  const [expandedPicker, setExpandedPicker] = useState<'mission' | 'date' | null>(null);
  const [date, setDate] = useState<Date>(
    alarm.specificDate ? parseDateOnlyIso(alarm.specificDate) : new Date(),
  );
  const [localProtectedDays, setLocalProtectedDays] = useState<number[]>(protectedDays);
  const [localMissionMode, setLocalMissionMode] = useState<MissionMode>(
    isDaily ? missionMode : (alarm.missionMode || 'personalized'),
  );
  const [localEnabledMissions, setLocalEnabledMissions] = useState<string[]>(
    isDaily
      ? enabledMissions
      : (alarm.enabledMissions?.length ? alarm.enabledMissions : DEFAULT_ENABLED_MISSIONS),
  );
  const [localPersonalizedMission, setLocalPersonalizedMission] = useState(
    normalizeMissionId(isDaily ? personalizedMission : alarm.mission),
  );
  const [isSaving, setIsSaving] = useState(false);
  
  const [hour, setHour] = useState(() => {
    let [h] = alarm.time.split(':');
    let hourNum = parseInt(h, 10);
    if (alarm.ampm === 'PM' && hourNum < 12) hourNum += 12;
    if (alarm.ampm === 'AM' && hourNum === 12) hourNum = 0;
    return String(hourNum).padStart(2, '0');
  });
  
  const [minute, setMinute] = useState(() => {
    const [, m] = alarm.time.split(':');
    return m.padStart(2, '0');
  });

  useEffect(() => {
    if (visible) {
      setStep(1);
      setLocalProtectedDays(protectedDays.length > 0 ? protectedDays : [0, 1, 2, 3, 4]);
      setLocalMissionMode(isDaily ? missionMode : (alarm.missionMode || 'personalized'));
      setLocalEnabledMissions(
        isDaily
          ? (enabledMissions.length > 0 ? enabledMissions : DEFAULT_ENABLED_MISSIONS)
          : (alarm.enabledMissions?.length ? alarm.enabledMissions : DEFAULT_ENABLED_MISSIONS),
      );
      setLocalPersonalizedMission(normalizeMissionId(isDaily ? personalizedMission : alarm.mission));
      setCustomMissionText(alarm.customMission || '');
      
      let [h] = alarm.time.split(':');
      let hourNum = parseInt(h, 10);
      if (alarm.ampm === 'PM' && hourNum < 12) hourNum += 12;
      if (alarm.ampm === 'AM' && hourNum === 12) hourNum = 0;
      setHour(String(hourNum).padStart(2, '0'));
      
      const [, m] = alarm.time.split(':');
      setMinute(m.padStart(2, '0'));
      setDate(alarm.specificDate ? parseDateOnlyIso(alarm.specificDate) : new Date());
      setExpandedPicker(null);
    }
    // Solo reinicia el estado al abrir la hoja o al cambiar de alarma. Depender de
    // los arrays/objetos (protectedDays, enabledMissions, alarm…) hace que cada
    // re-render del padre reinicie la selección del usuario a make_bed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, alarm?.id, isDaily]);

  const mainSwipe = useSwipeInteractive(visible, onClose);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const hourNum = parseInt(hour, 10);
      const computedAmpm = hourNum >= 12 ? 'PM' : 'AM';
      // Guardamos la hora en formato 24H directamente para que la UI la muestre en 24H
      const timeStr = `${hour}:${minute}`;

      const savedMission = localMissionMode === 'personalized'
        ? localPersonalizedMission
        : (localEnabledMissions[0] || DEFAULT_PERSONALIZED_MISSION);
      const payload = {
        ...alarm,
        time: timeStr,
        ampm: computedAmpm,
        mission: savedMission,
        missionMode: localMissionMode,
        enabledMissions: localEnabledMissions,
        sound: alarm.sound || 'radar_classic',
        label: alarm.label || 'Wake up',
        customMission: localPersonalizedMission === 'custom' ? customMissionText : alarm.customMission,
        specificDate: isDaily ? undefined : toDateOnlyIso(date),
      };

      if (isDaily) {
        try {
          await onProtectedDaysSave?.(localProtectedDays);
        } catch (settingsError) {
          console.log('Daily protected days sync failed before alarm save', settingsError);
        }
        try {
          await onMissionSettingsSave?.({
            missionMode: localMissionMode,
            enabledMissions: localEnabledMissions,
            personalizedMission: localPersonalizedMission,
          });
        } catch (settingsError) {
          console.log('Daily mission settings sync failed before alarm save', settingsError);
        }
        await onSave({ ...payload, on: true });
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (error: any) {
      console.log('Save alarm failed', error);
      const detail = error?.message || error?.details || '';
      Alert.alert(
        t('sheets.saveFailedTitle'),
        detail ? `${t('sheets.saveFailedBody')}\n\n${detail}` : t('sheets.saveFailedBody'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const selectedMissionData = getMission(localPersonalizedMission);
  const missionTitle = localMissionMode === 'roulette'
    ? t('rooRoulette')
    : (localPersonalizedMission === 'custom'
      ? (customMissionText || t('custom'))
      : missionCopy(selectedMissionData.id).label);
  const missionEmoji = localMissionMode === 'roulette' ? '🎰' : selectedMissionData.emoji;

  useEffect(() => {
    if (visible && isNew && !isDaily && step === 2) {
      setExpandedPicker('date');
    }
  }, [visible, isNew, isDaily, step]);

  const togglePicker = (picker: 'mission' | 'date') => {
    Haptics.selectionAsync();
    setExpandedPicker((prev) => (prev === picker ? null : picker));
  };

  const renderModeToggle = () => (
    <View style={[styles.modeToggle, { backgroundColor: colors.surface }]}>
      {([
        { id: 'personalized' as MissionMode, label: t('sheets.personalized') },
        { id: 'roulette' as MissionMode, label: `🎰 ${t('rooRoulette')}` },
      ]).map(option => {
        const selected = localMissionMode === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.selectionAsync();
              setLocalMissionMode(option.id);
            }}
            style={[
              styles.modeToggleBtn,
              { backgroundColor: selected ? (colors.brandOrange || colors.accSolid) : 'transparent' },
            ]}
          >
            <Text style={[styles.modeToggleText, { color: selected ? '#fff' : colors.textDim }]} numberOfLines={1}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderMissionPicker = () => (
    <View style={[styles.inlinePicker, { backgroundColor: colors.surface2, borderColor: colors.hairline2 }]}>
      {renderModeToggle()}
      {MISSION_LIST.map((m) => {
        const isSelected = localMissionMode === 'roulette'
          ? localEnabledMissions.includes(m.id)
          : localPersonalizedMission === m.id;
        return (
          <TouchableOpacity
            key={m.id}
            activeOpacity={0.82}
            onPress={() => {
              Haptics.selectionAsync();
              if (localMissionMode === 'roulette') {
                toggleLocalRouletteMission(m.id);
              } else {
                setLocalPersonalizedMission(m.id);
                if (m.id !== 'custom') setExpandedPicker(null);
              }
            }}
            style={[
              styles.inlinePickerItem,
              {
                backgroundColor: isSelected ? colors.surface : 'transparent',
                borderColor: isSelected ? colors.accSolid : colors.hairline2,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ marginRight: 12, width: 40, height: 40, borderRadius: 12, backgroundColor: isSelected ? '#FFF' : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
              </View>
              <Text style={[styles.missionListLabel, { color: colors.text, flex: 1 }]}>{missionCopy(m.id).label}</Text>
              {isSelected && <Icon name="check" size={18} color={colors.accSolid} />}
            </View>
            {isSelected && m.id === 'custom' && (
              <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 8 }}>
                <TextInput
                  style={{ flex: 1, color: colors.text, padding: 12, fontSize: 16 }}
                  placeholder={t('typeCustomMission')}
                  placeholderTextColor={colors.textFaint}
                  value={customMissionText}
                  onChangeText={setCustomMissionText}
                  returnKeyType="done"
                  onSubmitEditing={() => setExpandedPicker(null)}
                />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const onDateSelected = (day: { year: number; month: number; day: number }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDate(new Date(day.year, day.month - 1, day.day));
    setExpandedPicker(null);
  };

  const renderDateCalendar = () => {
    const dateKey = toDateOnlyIso(date);
    return (
    <View style={[styles.inlinePicker, { backgroundColor: colors.surface2, borderColor: colors.hairline2, paddingHorizontal: 4, paddingVertical: 4 }]}>
      <Calendar
        current={dateKey}
        onDayPress={onDateSelected}
        theme={{
          backgroundColor: colors.surface2,
          calendarBackground: colors.surface2,
          textSectionTitleColor: colors.textFaint,
          selectedDayBackgroundColor: colors.accSolid,
          selectedDayTextColor: colors.bg,
          todayTextColor: colors.accSolid,
          dayTextColor: colors.text,
          textDisabledColor: colors.textFaint,
          arrowColor: colors.accSolid,
          monthTextColor: colors.text,
          textDayFontWeight: '600',
          textMonthFontWeight: '800',
          textDayHeaderFontWeight: '700',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14,
        }}
        markedDates={{
          [dateKey]: { selected: true, selectedColor: colors.accSolid, selectedTextColor: '#fff' },
        }}
        style={{ borderRadius: 12 }}
      />
    </View>
    );
  };

  const renderDatePill = () => (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => togglePicker('date')}
        style={[
          styles.simpleSelectPill,
          {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: expandedPicker === 'date' ? colors.accSolid : colors.hairline2,
          },
        ]}
      >
        <View style={styles.pillLeft}>
          <Icon name="calendar" size={18} color={colors.textDim} />
          <Text style={[styles.pillLabel, { color: colors.textDim }]}>{t('sheets.date')}</Text>
        </View>
        <View style={styles.pillRight}>
          <Text style={[styles.pillValue, { color: colors.text }]}>{date.toLocaleDateString()}</Text>
          <Icon name={expandedPicker === 'date' ? 'chevDown' : 'chevR'} size={14} color={colors.textFaint} />
        </View>
      </TouchableOpacity>
      {expandedPicker === 'date' && renderDateCalendar()}
    </View>
  );

  const renderSelectPill = (
    iconName: string,
    label: string,
    valueContent: React.ReactNode,
  ) => (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => togglePicker('mission')}
        style={[styles.simpleSelectPill, { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: expandedPicker === 'mission' ? colors.accSolid : colors.hairline2 }]}
      >
        <View style={styles.pillLeft}>
          <Icon name={iconName} size={18} color={colors.textDim} />
          <Text style={[styles.pillLabel, { color: colors.textDim }]}>{label}</Text>
        </View>
        <View style={styles.pillRight}>
          {valueContent}
          <Icon name={expandedPicker === 'mission' ? 'chevDown' : 'chevR'} size={14} color={colors.textFaint} />
        </View>
      </TouchableOpacity>
      {expandedPicker === 'mission' && renderMissionPicker()}
    </View>
  );

  const toggleLocalProtectedDay = (day: number) => {
    const next = localProtectedDays.includes(day)
      ? localProtectedDays.filter(d => d !== day)
      : [...localProtectedDays, day].sort((a, b) => a - b);
    if (next.length === 0) return;
    setLocalProtectedDays(next);
  };

  const toggleLocalRouletteMission = (missionId: string) => {
    const next = localEnabledMissions.includes(missionId)
      ? localEnabledMissions.filter(id => id !== missionId)
      : [...localEnabledMissions, missionId];
    if (next.length === 0) return;
    setLocalEnabledMissions(next);
  };

  const getSheetTitle = () => {
    if (isDaily) return t('sheets.dailyAlarm');
    if (!isNew) return t('sheets.editAlarm');
    if (step === 1) return `${t('sheets.newAlarm')} (1/3)`;
    if (step === 2) return `${t('sheets.date')} (2/3)`;
    if (step === 3) return t('sheets.selectMissionStep');
    return t('sheets.newAlarm');
  };

  const renderWizardContent = () => {
    if (step === 1) {
      return (
        <View style={styles.timePickerStep}>
          <View style={[styles.timePickerContainer, styles.timePickerContainerExpanded]}>
            <View style={styles.wheelsRow}>
              <AnimatedTimePicker
                values={HOURS}
                selectedValue={hour}
                onSelect={setHour}
                accentColor={colors.accSolid}
              />
              <Text style={[styles.colon, { color: colors.textDim }]}>:</Text>
              <AnimatedTimePicker
                values={MINUTES}
                selectedValue={minute}
                onSelect={setMinute}
                accentColor={colors.accSolid}
              />
            </View>
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={{ marginTop: 8, marginBottom: 20 }}>
          {renderDatePill()}
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={{ marginTop: 8 }}>
          {renderModeToggle()}
          {MISSION_LIST.map((m) => {
            const isSelected = localMissionMode === 'roulette'
              ? localEnabledMissions.includes(m.id)
              : localPersonalizedMission === m.id;
            return (
              <SquishyButton 
                key={m.id}
                style={{ marginBottom: 8 }}
                contentStyle={{ 
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  paddingVertical: 12, paddingHorizontal: 16,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.accSolid : 'transparent',
                }}
                color={isSelected ? colors.surface : 'transparent'}
                shadowColor="rgba(0,0,0,0.06)"
                borderRadius={16}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (localMissionMode === 'roulette') {
                    toggleLocalRouletteMission(m.id);
                  } else {
                    setLocalPersonalizedMission(m.id);
                  }
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ marginRight: 16, width: 44, height: 44, borderRadius: 14, backgroundColor: isSelected ? '#FFF' : colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 26 }}>{m.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.missionListLabel, { color: colors.text }]}>{missionCopy(m.id).label}</Text>
                  </View>
                  {isSelected && <Icon name="check" size={18} color={colors.accSolid} />}
                </View>
                {isSelected && m.id === 'custom' && localMissionMode === 'personalized' && (
                  <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 8 }}>
                    <TextInput
                      style={{ flex: 1, color: colors.text, padding: 12, fontSize: 16 }}
                      placeholder={t('typeCustomMission')}
                      placeholderTextColor={colors.textFaint}
                      value={customMissionText}
                      onChangeText={setCustomMissionText}
                      returnKeyType="done"
                    />
                  </View>
                )}
              </SquishyButton>
            );
          })}
        </View>
      );
    }
  };

  const renderEditContent = () => {
    return (
      <>
        <View style={{ alignItems: 'center' }}>
          <View style={[styles.timePickerContainer, styles.timePickerContainerExpanded]}>
            <View style={styles.wheelsRow}>
              <AnimatedTimePicker
                values={HOURS}
                selectedValue={hour}
                onSelect={setHour}
                accentColor={colors.accSolid}
              />
              <Text style={[styles.colon, { color: colors.textDim }]}>:</Text>
              <AnimatedTimePicker
                values={MINUTES}
                selectedValue={minute}
                onSelect={setMinute}
                accentColor={colors.accSolid}
              />
            </View>
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          {isDaily && (
            <View style={styles.daysEditorWrap}>
              {weekdays.map((day, index) => {
                const selected = localProtectedDays.includes(index);
                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.82}
                    onPress={() => {
                      Haptics.selectionAsync();
                      toggleLocalProtectedDay(index);
                    }}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: selected ? (colors.brandOrange || colors.accSolid) : colors.surface,
                        borderColor: selected ? (colors.brandOrange || colors.accSolid) : colors.hairline2,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.dayChipText, { color: selected ? '#fff' : colors.textDim }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {!isDaily && renderDatePill()}
          {renderSelectPill(
            'gear',
            t('mission'),
            <>
              <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: colors.accSolid, alignItems: 'center', justifyContent: 'center' }}>
                {localMissionMode === 'roulette' ? (
                  <Text style={{ fontSize: 16, lineHeight: 20 }}>{missionEmoji}</Text>
                ) : (
                  <MissionGlyph icon={selectedMissionData?.icon || 'star'} size={14} active={true} />
                )}
              </View>
              <Text style={[styles.pillValue, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                {missionTitle}
              </Text>
            </>
          )}
        </View>
      </>
    );
  };

  const isTimePickerStep = isNew && !isDaily && step === 1;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
          <Animated.View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.hairline, transform: [{ translateY: mainSwipe.panY }] }]}>
            <View style={styles.sheetHeader} {...mainSwipe.panResponder.panHandlers}>
              <View style={styles.handleBar} />
              <Text style={[styles.sheetTitle, { fontFamily: FONT_FAMILY.black, fontSize: 22, color: colors.accSolid, opacity: 1, letterSpacing: -0.5 }]}>
                {getSheetTitle()}
              </Text>
            </View>
            
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24, flexGrow: isTimePickerStep ? 1 : undefined }}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              scrollEnabled={!isTimePickerStep}
              bounces={!isTimePickerStep}
              onScroll={(e) => { if (e && e.nativeEvent && e.nativeEvent.contentOffset) mainSwipe.scrollY.current = e.nativeEvent.contentOffset.y; }}
            >
              {isNew && !isDaily ? renderWizardContent() : renderEditContent()}
            </ScrollView>
            
            <View style={styles.footer}>
              {!isNew && !isDaily && onDelete && (
                <View style={{ width: 60, marginRight: 12 }}>
                  <SquishyButton 
                    color="rgba(255,60,60,0.1)"
                    shadowColor="rgba(255,60,60,0.2)"
                    borderRadius={16}
                    onPress={() => {
                      onDelete(alarm.id);
                      onClose();
                    }}
                    contentStyle={{ height: 58, alignItems: 'center', justifyContent: 'center', paddingVertical: 0, paddingHorizontal: 8, overflow: 'visible' }}
                  >
                    <Icon name="trash" size={20} color="#ff4444" variant="solid" />
                  </SquishyButton>
                </View>
              )}
              
              {isNew && !isDaily && step > 1 && (
                <View style={{ width: 80, marginRight: 12 }}>
                  <SquishyButton 
                    color={colors.surface}
                    shadowColor="rgba(0,0,0,0.1)"
                    borderRadius={16}
                    onPress={() => setStep(step - 1)}
                    contentStyle={{ height: 58, alignItems: 'center', justifyContent: 'center', paddingVertical: 0, paddingHorizontal: 8, overflow: 'visible' }}
                  >
                    <Text style={[styles.saveBtnText, { color: colors.text }]}>{t('back')}</Text>
                  </SquishyButton>
                </View>
              )}
              
              <View style={{ flex: 1 }}>
                {isNew && !isDaily && step < 3 ? (
                  <SquishyButton 
                    color={colors.isDark ? colors.accSolid : '#fff'}
                    shadowColor="rgba(0,0,0,0.1)"
                    borderRadius={16}
                    onPress={() => setStep(step + 1)}
                    contentStyle={{ height: 58, alignItems: 'center', justifyContent: 'center', paddingVertical: 0, paddingHorizontal: 12, overflow: 'visible' }}
                  >
                    <Text style={[styles.saveBtnText, { color: colors.isDark ? '#111' : colors.text }]} numberOfLines={1}>{t('next')}</Text>
                  </SquishyButton>
                ) : (
                  <SquishyButton 
                    color={colors.isDark ? colors.accSolid : '#fff'}
                    shadowColor="rgba(0,0,0,0.1)"
                    borderRadius={16}
                    onPress={handleSave}
                    contentStyle={{ height: 58, alignItems: 'center', justifyContent: 'center', paddingVertical: 0, paddingHorizontal: 12, overflow: 'visible' }}
                  >
                    <Text style={[styles.saveBtnText, { color: colors.isDark ? '#111' : colors.text }]} numberOfLines={1}>
                      {isSaving ? t('saving') : t('saveAlarm')}
                    </Text>
                  </SquishyButton>
                )}
              </View>
            </View>
            <View style={{ position: 'absolute', bottom: -500, left: 0, right: 0, height: 500, backgroundColor: colors.bg }} />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(50,40,35,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 36, borderTopRightRadius: 36, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 24, paddingTop: 12, maxHeight: '92%' },
  sheetHeader: { width: '100%', paddingTop: 4, paddingBottom: 8, alignItems: 'center' },
  handleBar: { width: 36, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '500', letterSpacing: 0, opacity: 0.5, marginBottom: 4 },
  headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
  closeBtn: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  
  timePickerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 4, paddingHorizontal: 20, marginBottom: 0 },
  timePickerContainerExpanded: { paddingVertical: 28, minHeight: 340, alignSelf: 'stretch' },
  timePickerStep: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  wheelsRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  colon: { fontSize: 32, fontWeight: FONT.bold, marginHorizontal: 4, marginTop: -4 },
  ampmContainer: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  ampmBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  ampmText: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
  ampmHint: { fontSize: 11, fontFamily: FONT_FAMILY.semiBold, marginTop: 2 },
  
  // Clean pill selector design
  simpleSelectPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 18, 
    paddingVertical: 14, 
  },
  pillLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pillThumbnail: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  pillLabel: { fontSize: 14, fontFamily: FONT_FAMILY.bold },
  pillRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  pillValue: { fontSize: 14, fontFamily: FONT_FAMILY.bold, flexShrink: 1 },
  daysEditorWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
    marginBottom: 12,
  },
  dayChip: {
    flex: 1,
    minWidth: 42,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  dayChipText: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.black,
    textAlign: 'center',
    includeFontPadding: false,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  modeToggleBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  modeToggleText: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.black,
  },
  inlinePicker: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  inlinePickerItem: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  missionSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 12, maxHeight: '60%' },
  missionSheetTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bold, marginBottom: 16, textAlign: 'center' },
  categoryTitle: { fontSize: 12, fontFamily: FONT_FAMILY.extraBold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4, marginTop: 4 },
  missionListItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, marginBottom: 6 },
  missionSimpleIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  missionListLabel: { fontSize: 15, fontFamily: FONT_FAMILY.bold },
  detailThumbnail: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  footer: { flexDirection: 'row', marginTop: 12, marginBottom: 38, alignItems: 'center', overflow: 'visible' },
  saveBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, lineHeight: 22, fontFamily: FONT_FAMILY.bold, includeFontPadding: false },
  playBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
