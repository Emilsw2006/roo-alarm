import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ScrollView, PanResponder, Animated, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../constants/ThemeContext';
import { FONT, FONT_FAMILY } from '../constants/theme';
import { DEFAULT_ENABLED_MISSIONS, DEFAULT_PERSONALIZED_MISSION, getMission, MISSION_LIST, MissionMode, normalizeMissionId } from '../constants/missions';
import { SOUND_ASSETS, SOUND_CATEGORIES } from '../constants/sounds';
import { useLanguage } from '../constants/LanguageContext';
import { Alarm } from '../constants/data';
import Icon from './Icon';
import MissionGlyph from './MissionGlyph';
import SoundWave from './SoundWave';
import AnimatedTimePicker from './AnimatedTimePicker';
import SquishyButton from './SquishyButton';
import { Calendar } from 'react-native-calendars';
import { useSwipeInteractive } from './useSwipeInteractive';
import * as Haptics from 'expo-haptics';
import { configurePlaybackAudio, createRooAudioPlayer, RooAudioPlayer, stopRooAudioPlayer } from '../lib/audioPlayer';

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

const SOUNDS = ['Ocean Waves', 'Rainforest Rain', 'Dawn Chorus', 'Zen Piano', 'Wind Chimes'];

const SOUND_GRADIENTS: Record<string, [string, string, ...string[]]> = {
  'Ocean Waves': ['#5c8b93', '#b4e6a8', '#e7f0fd'],
  'Rainforest Rain': ['#3a6073', '#3a7bd5', '#3a6073'],
  'Dawn Chorus': ['#ff7e5f', '#feb47b', '#2c3e50'],
  'Zen Piano': ['#8e9eab', '#eef2f3', '#8e9eab'],
  'Wind Chimes': ['#a8c0ff', '#3f2b96', '#a8c0ff'],
};

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function AmPmToggle({ value, onChange, accentColor, textColor, isDaily }: { value: 'AM'|'PM', onChange: (v: 'AM'|'PM')=>void, accentColor: string, textColor: string, isDaily?: boolean }) {
  return (
    <View style={styles.ampmContainer}>
      <TouchableOpacity 
        style={[styles.ampmBtn, value === 'AM' ? { backgroundColor: accentColor + '20' } : { backgroundColor: 'transparent' }]} 
        onPress={() => onChange('AM')}
      >
        <Text style={[styles.ampmText, value === 'AM' ? { color: accentColor } : { color: textColor + '40' }]}>AM</Text>
      </TouchableOpacity>
      {!isDaily && (
        <TouchableOpacity 
          style={[styles.ampmBtn, value === 'PM' ? { backgroundColor: accentColor + '20' } : { backgroundColor: 'transparent' }]} 
          onPress={() => onChange('PM')}
        >
          <Text style={[styles.ampmText, value === 'PM' ? { color: accentColor } : { color: textColor + '40' }]}>PM</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

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
  missionMode = 'personalized',
  enabledMissions = DEFAULT_ENABLED_MISSIONS,
  personalizedMission = DEFAULT_PERSONALIZED_MISSION,
  onMissionSettingsSave,
}: EditSheetProps) {
  const { colors } = useColors();
  const { t, missionCopy, soundName, soundCategory, weekdays } = useLanguage();
  const [step, setStep] = useState(1);
  const [mission, setMission] = useState(normalizeMissionId(alarm.mission));
  const [customMissionText, setCustomMissionText] = useState(alarm.customMission || '');
  const [sound, setSound] = useState(alarm.sound || 'digital_local');
  const [soundSearch, setSoundSearch] = useState('');
  const [audioObj, setAudioObj] = useState<RooAudioPlayer | null>(null);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const [missionModalVisible, setMissionModalVisible] = useState(false);
  const [soundModalVisible, setSoundModalVisible] = useState(false);
  const [date, setDate] = useState<Date>(alarm.specificDate ? new Date(alarm.specificDate) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [localProtectedDays, setLocalProtectedDays] = useState<number[]>(protectedDays);
  const [localMissionMode, setLocalMissionMode] = useState<MissionMode>(missionMode);
  const [localEnabledMissions, setLocalEnabledMissions] = useState<string[]>(enabledMissions);
  const [localPersonalizedMission, setLocalPersonalizedMission] = useState(normalizeMissionId(personalizedMission));
  const [isSaving, setIsSaving] = useState(false);
  
  const [hour, setHour] = useState(() => {
    let [h] = alarm.time.split(':');
    if (h === '0') h = '12';
    return h;
  });
  
  const [minute, setMinute] = useState(() => {
    const [, m] = alarm.time.split(':');
    return m.padStart(2, '0');
  });

  const [ampm, setAmpm] = useState<'AM'|'PM'>(isDaily ? 'AM' : (alarm.ampm || 'AM'));

  useEffect(() => {
    if (visible) {
      setStep(1);
      setLocalProtectedDays(protectedDays.length > 0 ? protectedDays : [0, 1, 2, 3, 4]);
      setLocalMissionMode(missionMode);
      setLocalEnabledMissions(enabledMissions.length > 0 ? enabledMissions : DEFAULT_ENABLED_MISSIONS);
      setLocalPersonalizedMission(normalizeMissionId(personalizedMission));
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      stopRooAudioPlayer(audioObj);
    };
  }, [audioObj]);

  const mainSwipe = useSwipeInteractive(visible, onClose);
  const missionSwipe = useSwipeInteractive(missionModalVisible, () => setMissionModalVisible(false));
  const soundSwipe = useSwipeInteractive(soundModalVisible, () => setSoundModalVisible(false));

  // Stop sound if sound modal is closed
  useEffect(() => {
    if (!soundModalVisible && audioObj) {
      audioObj.pause();
      setPlayingSoundId(null);
    }
  }, [soundModalVisible]);

  // Stop sound if main sheet is closed
  useEffect(() => {
    if (!visible && audioObj) {
      audioObj.pause();
      setPlayingSoundId(null);
    }
  }, [visible]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      stopRooAudioPlayer(audioObj);
      const timeStr = `${hour}:${minute}`;
      if (isDaily) {
        await onProtectedDaysSave?.(localProtectedDays);
        await onMissionSettingsSave?.({
          missionMode: localMissionMode,
          enabledMissions: localEnabledMissions,
          personalizedMission: localPersonalizedMission,
        });
      }
      const savedMission = isDaily ? localPersonalizedMission : mission;
      await onSave({ ...alarm, time: timeStr, ampm, mission: savedMission, sound, specificDate: isDaily ? undefined : date.toISOString() });
      onClose();
    } catch (error) {
      console.log('Save alarm failed', error);
    } finally {
      setIsSaving(false);
    }
  };

  const playPreview = async (soundAsset: any) => {
    if (audioObj) {
      stopRooAudioPlayer(audioObj);
      setAudioObj(null);
      if (playingSoundId === soundAsset.id) {
        setPlayingSoundId(null);
        return;
      }
    }
    try {
      await configurePlaybackAudio(false);
      const newSound = createRooAudioPlayer(soundAsset.file);
      setAudioObj(newSound);
      setPlayingSoundId(soundAsset.id);
      newSound.play();
      newSound.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          stopRooAudioPlayer(newSound);
          setAudioObj(null);
          setPlayingSoundId(null);
        }
      });
    } catch (e) {
      console.log('Error playing sound', e);
    }
  };

  const selectedMissionData = getMission(isDaily ? localPersonalizedMission : mission);
  const dailyMissionTitle = localMissionMode === 'roulette' ? t('rooRoulette') : missionCopy(selectedMissionData.id).label;
  const dailyMissionEmoji = localMissionMode === 'roulette' ? '🎰' : selectedMissionData.emoji;
  const activeMissionList = localMissionMode === 'roulette' ? localEnabledMissions : [localPersonalizedMission];

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
    if (step === 1) return `${t('sheets.newAlarm')} (1/4)`;
    if (step === 2) return `${t('sheets.date')} (2/4)`;
    if (step === 3) return t('sheets.selectMissionStep');
    if (step === 4) return t('sheets.selectSoundStep');
    return t('sheets.newAlarm');
  };

  const renderWizardContent = () => {
    if (step === 1) {
      return (
        <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 20 }}>
          <View style={[styles.timePickerContainer]}>
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
            <AmPmToggle value={ampm} onChange={setAmpm} accentColor={colors.accSolid} textColor={colors.text} isDaily={isDaily} />
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={{ marginTop: 8, marginBottom: 20 }}>
          <Calendar
            current={date.toISOString().split('T')[0]}
            onDayPress={(day: any) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const selected = new Date(day.year, day.month - 1, day.day);
              setDate(selected);
            }}
            theme={{
              backgroundColor: colors.bg,
              calendarBackground: colors.bg,
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
              [date.toISOString().split('T')[0]]: { selected: true, selectedColor: colors.accSolid, selectedTextColor: '#fff' }
            }}
            style={{ borderRadius: 16 }}
          />
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={{ marginTop: 8 }}>
          {MISSION_LIST.map((m) => {
            const isSelected = mission === m.id;
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
                  setMission(m.id);
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
                {isSelected && m.id === 'custom' && (
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

    if (step === 4) {
      return (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 }}>
            <Icon name="search" size={16} color={colors.textFaint} />
            <TextInput
              style={{ flex: 1, color: colors.text, padding: 12, fontSize: 16 }}
              placeholder={t('searchSounds')}
              placeholderTextColor={colors.textFaint}
              value={soundSearch}
              onChangeText={setSoundSearch}
            />
          </View>
          {SOUND_CATEGORIES.map((cat) => {
            const catSounds = SOUND_ASSETS.filter(s => s.category === cat && soundName(s.id, s.name).toLowerCase().includes(soundSearch.toLowerCase()));
            if (catSounds.length === 0) return null;
            return (
              <View key={cat} style={{ marginBottom: 20 }}>
                <Text style={[styles.categoryTitle, { color: colors.textFaint }]}>{soundCategory(cat)}</Text>
                {catSounds.map((s) => {
                  const isSelected = sound === s.id;
                  const isPlaying = playingSoundId === s.id;
                  return (
                    <SquishyButton 
                      key={s.id}
                      style={{ marginBottom: 8 }}
                      contentStyle={{
                        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.accSolid : 'transparent',
                      }}
                      color={isSelected ? colors.surface : 'transparent'}
                      shadowColor="rgba(0,0,0,0.06)"
                      borderRadius={16}
                      onPress={() => {
                        setSound(s.id);
                        playPreview(s);
                      }}
                    >
                      <LinearGradient colors={s.gradient} style={styles.detailThumbnail} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.missionListLabel, { color: colors.text }]}>{soundName(s.id, s.name)}</Text>
                      </View>
                      {isSelected && <View style={{ marginRight: 12 }}><Icon name="check" size={18} color={colors.accSolid} /></View>}
                      <TouchableOpacity onPress={() => playPreview(s)} style={[styles.playBtn, { backgroundColor: 'transparent' }]}>
                        {isPlaying ? (
                          <SoundWave color={colors.accSolid} />
                        ) : (
                          <Icon name="volume" size={16} color={colors.textFaint} />
                        )}
                      </TouchableOpacity>
                    </SquishyButton>
                  );
                })}
              </View>
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
          <View style={[styles.timePickerContainer]}>
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
            <AmPmToggle value={ampm} onChange={setAmpm} accentColor={colors.accSolid} textColor={colors.text} isDaily={isDaily} />
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
          {!isDaily && (
            <SquishyButton 
              style={{ marginBottom: 12 }}
              contentStyle={styles.simpleSelectPill}
              color={colors.surface}
              shadowColor="rgba(0,0,0,0.06)"
              borderRadius={16}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.pillLeft}>
                <Icon name="calendar" size={18} color={colors.textDim} />
                <Text style={[styles.pillLabel, { color: colors.textDim }]}>{t('sheets.date')}</Text>
              </View>
              <View style={styles.pillRight}>
                <Text style={[styles.pillValue, { color: colors.text }]}>{date.toLocaleDateString()}</Text>
              </View>
            </SquishyButton>
          )}
          <SquishyButton 
            style={{ marginBottom: 12 }}
            contentStyle={styles.simpleSelectPill}
            color={colors.surface}
            shadowColor="rgba(0,0,0,0.06)"
            borderRadius={16}
            onPress={() => setMissionModalVisible(true)}
          >
            <View style={styles.pillLeft}>
              <Icon name="gear" size={18} color={colors.textDim} />
              <Text style={[styles.pillLabel, { color: colors.textDim }]}>{t('mission')}</Text>
            </View>
            <View style={styles.pillRight}>
              <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: colors.accSolid, alignItems: 'center', justifyContent: 'center' }}>
                {isDaily ? (
                  <Text style={{ fontSize: 16, lineHeight: 20 }}>{dailyMissionEmoji}</Text>
                ) : (
                  <MissionGlyph icon={selectedMissionData?.icon || 'star'} size={14} active={true} />
                )}
              </View>
              <Text 
                style={[styles.pillValue, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {isDaily ? dailyMissionTitle : (mission === 'custom' ? (customMissionText || t('custom')) : (missionCopy(selectedMissionData?.id).label || mission))}
              </Text>
              <Icon name="chevR" size={14} color={colors.textFaint} />
            </View>
          </SquishyButton>
          <SquishyButton 
            style={{ marginBottom: 12 }}
            contentStyle={styles.simpleSelectPill}
            color={colors.surface}
            shadowColor="rgba(0,0,0,0.06)"
            borderRadius={16}
            onPress={() => setSoundModalVisible(true)}
          >
            <View style={styles.pillLeft}>
              <Icon name="volume" size={18} color={colors.textDim} />
              <Text style={[styles.pillLabel, { color: colors.textDim }]}>{t('sound')}</Text>
            </View>
            <View style={styles.pillRight}>
              {(() => {
                const s = SOUND_ASSETS.find(s => s.id === sound);
                return (
                  <>
                    {s?.gradient && (
                      <LinearGradient colors={s.gradient} style={styles.pillThumbnail} />
                    )}
                    <Text style={[styles.pillValue, { color: colors.text }]}>{soundName(s?.id, s?.name || sound)}</Text>
                  </>
                );
              })()}
              <Icon name="chevR" size={16} color="rgba(255,255,255,0.4)" />
            </View>
          </SquishyButton>
        </View>
      </>
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay} {...mainSwipe.panResponder.panHandlers}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
          <Animated.View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.hairline, transform: [{ translateY: mainSwipe.panY }] }]}>
            <View style={{ width: '100%', paddingVertical: 12, alignItems: 'center' }}>
              <View style={styles.handleBar} />
              <Text style={[styles.sheetTitle, { fontFamily: FONT_FAMILY.black, fontSize: 22, color: colors.accSolid, opacity: 1, letterSpacing: -0.5 }]}>
                {getSheetTitle()}
              </Text>
            </View>
            
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
              scrollEventThrottle={16}
              onScroll={(e) => { if (e && e.nativeEvent && e.nativeEvent.contentOffset) mainSwipe.scrollY.current = e.nativeEvent.contentOffset.y; }}
            >
              {isNew ? renderWizardContent() : renderEditContent()}
            </ScrollView>
            
            <View style={styles.footer}>
              {!isNew && !isDaily && onDelete && (
                <View style={{ width: 60, marginRight: 12 }}>
                  <SquishyButton 
                    color="rgba(255,60,60,0.1)"
                    shadowColor="rgba(255,60,60,0.2)"
                    borderRadius={16}
                    onPress={() => {
                      stopRooAudioPlayer(audioObj);
                      onDelete(alarm.id);
                      onClose();
                    }}
                    contentStyle={{ height: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 }}
                  >
                    <Icon name="trash" size={20} color="#ff4444" variant="solid" />
                  </SquishyButton>
                </View>
              )}
              
              {isNew && step > 1 && (
                <View style={{ width: 80, marginRight: 12 }}>
                  <SquishyButton 
                    color={colors.surface}
                    shadowColor="rgba(0,0,0,0.1)"
                    borderRadius={16}
                    onPress={() => {
                      if (audioObj) {
                        audioObj.pause();
                        setPlayingSoundId(null);
                      }
                      setStep(step - 1);
                    }}
                    contentStyle={{ height: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 }}
                  >
                    <Text style={[styles.saveBtnText, { color: colors.text }]}>{t('back')}</Text>
                  </SquishyButton>
                </View>
              )}
              
              <View style={{ flex: 1 }}>
                {isNew && step < 4 ? (
                  <SquishyButton 
                    color={colors.isDark ? colors.accSolid : '#fff'}
                    shadowColor="rgba(0,0,0,0.1)"
                    borderRadius={16}
                    onPress={() => setStep(step + 1)}
                    contentStyle={{ height: 58, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={[styles.saveBtnText, { color: colors.isDark ? '#111' : colors.text }]} numberOfLines={1}>{t('next')}</Text>
                  </SquishyButton>
                ) : (
                  <SquishyButton 
                    color={colors.isDark ? colors.accSolid : '#fff'}
                    shadowColor="rgba(0,0,0,0.1)"
                    borderRadius={16}
                    onPress={handleSave}
                    contentStyle={{ height: 58, alignItems: 'center', justifyContent: 'center' }}
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

      {/* Modals for non-new edit mode */}
      <Modal visible={missionModalVisible} transparent animationType="fade" onRequestClose={() => setMissionModalVisible(false)}>
        <View style={styles.overlay} {...missionSwipe.panResponder.panHandlers}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setMissionModalVisible(false)} />
          <Animated.View style={[styles.missionSheet, { backgroundColor: colors.bg, borderColor: colors.hairline, borderWidth: 1, transform: [{ translateY: missionSwipe.panY }] }]}>
            <View style={{ width: '100%', paddingVertical: 12, alignItems: 'center' }}>
              <View style={styles.handleBar} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} scrollEventThrottle={16} onScroll={(e) => { if (e && e.nativeEvent && e.nativeEvent.contentOffset) missionSwipe.scrollY.current = e.nativeEvent.contentOffset.y; }}>
              {isDaily && (
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
              )}
              {MISSION_LIST.map((m) => {
                const isSelected = isDaily
                  ? (localMissionMode === 'roulette' ? localEnabledMissions.includes(m.id) : localPersonalizedMission === m.id)
                  : mission === m.id;
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
                      if (isDaily) {
                        if (localMissionMode === 'roulette') {
                          toggleLocalRouletteMission(m.id);
                        } else {
                          setLocalPersonalizedMission(m.id);
                        }
                      } else {
                        setMission(m.id);
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
                    {!isDaily && isSelected && m.id === 'custom' && (
                      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 8 }}>
                        <TextInput
                          style={{ flex: 1, color: colors.text, padding: 12, fontSize: 16 }}
                          placeholder={t('typeCustomMission')}
                          placeholderTextColor={colors.textFaint}
                          value={customMissionText}
                          onChangeText={setCustomMissionText}
                          returnKeyType="done"
                          onSubmitEditing={() => setMissionModalVisible(false)}
                          autoFocus
                        />
                        <TouchableOpacity 
                          style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, marginLeft: 8 }}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setMissionModalVisible(false);
                          }}
                        >
                          <Text style={{ color: colors.accSolid, fontWeight: '700' }}>OK</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </SquishyButton>
                );
              })}
            </ScrollView>
            <View style={{ position: 'absolute', bottom: -500, left: 0, right: 0, height: 500, backgroundColor: colors.bg }} />
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={soundModalVisible} transparent animationType="fade" onRequestClose={() => setSoundModalVisible(false)}>
        <View style={styles.overlay} {...soundSwipe.panResponder.panHandlers}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSoundModalVisible(false)} />
          <Animated.View style={[styles.missionSheet, { backgroundColor: colors.bg, borderColor: colors.hairline, borderWidth: 1, transform: [{ translateY: soundSwipe.panY }] }]}>
            <View style={{ width: '100%', paddingVertical: 12, alignItems: 'center' }}>
              <View style={styles.handleBar} />
            </View>
            <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12 }}>
                <Icon name="search" size={16} color={colors.textFaint} />
                <TextInput
                  style={{ flex: 1, color: colors.text, padding: 12, fontSize: 16 }}
                  placeholder={t('searchSounds')}
                  placeholderTextColor={colors.textFaint}
                  value={soundSearch}
                  onChangeText={setSoundSearch}
                />
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} scrollEventThrottle={16} onScroll={(e) => { if (e && e.nativeEvent && e.nativeEvent.contentOffset) soundSwipe.scrollY.current = e.nativeEvent.contentOffset.y; }}>
              {SOUND_CATEGORIES.map((cat) => {
                const catSounds = SOUND_ASSETS.filter(s => s.category === cat && soundName(s.id, s.name).toLowerCase().includes(soundSearch.toLowerCase()));
                if (catSounds.length === 0) return null;
                return (
                  <View key={cat} style={{ marginBottom: 20 }}>
                    <Text style={[styles.categoryTitle, { color: colors.textFaint }]}>{soundCategory(cat)}</Text>
                    {catSounds.map((s) => {
                      const isSelected = sound === s.id;
                      const isPlaying = playingSoundId === s.id;
                      return (
                        <SquishyButton 
                          key={s.id}
                          style={{ marginBottom: 8 }}
                          contentStyle={{
                            flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16,
                            borderWidth: 2,
                            borderColor: isSelected ? colors.accSolid : 'transparent',
                          }}
                          color={isSelected ? colors.surface : 'transparent'}
                          shadowColor="rgba(0,0,0,0.06)"
                          borderRadius={16}
                          onPress={() => {
                            setSound(s.id);
                            playPreview(s);
                          }}
                        >
                          <LinearGradient colors={s.gradient} style={styles.detailThumbnail} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.missionListLabel, { color: colors.text }]}>{soundName(s.id, s.name)}</Text>
                          </View>
                          {isSelected && <View style={{ marginRight: 12 }}><Icon name="check" size={18} color={colors.accSolid} /></View>}
                          <TouchableOpacity onPress={() => playPreview(s)} style={[styles.playBtn, { backgroundColor: 'transparent' }]}>
                            {isPlaying ? (
                              <SoundWave color={colors.accSolid} />
                            ) : (
                              <Icon name="volume" size={16} color={colors.textFaint} />
                            )}
                          </TouchableOpacity>
                        </SquishyButton>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ position: 'absolute', bottom: -500, left: 0, right: 0, height: 500, backgroundColor: colors.bg }} />
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowDatePicker(false)} />
          <View style={[styles.missionSheet, { backgroundColor: colors.bg, borderColor: colors.hairline, borderWidth: 1, paddingBottom: 32 }]}>
            <View style={{ width: '100%', paddingVertical: 12, alignItems: 'center' }}>
              <View style={styles.handleBar} />
            </View>
            <Calendar
              current={date.toISOString().split('T')[0]}
              onDayPress={(day: any) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // Ensure local timezone adjustment to match the selected day
                const selected = new Date(day.year, day.month - 1, day.day);
                setDate(selected);
                setTimeout(() => setShowDatePicker(false), 350);
              }}
              theme={{
                backgroundColor: colors.bg,
                calendarBackground: colors.bg,
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
                [date.toISOString().split('T')[0]]: { selected: true, selectedColor: colors.accSolid, selectedTextColor: '#fff' }
              }}
              style={{
                borderRadius: 16,
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(50,40,35,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 36, borderTopRightRadius: 36, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 24, paddingTop: 12, maxHeight: '92%' },
  handleBar: { width: 36, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '500', letterSpacing: 0, opacity: 0.5, marginBottom: 4 },
  headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
  closeBtn: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  
  timePickerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 4, paddingHorizontal: 20, marginBottom: 0 },
  wheelsRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  colon: { fontSize: 32, fontWeight: FONT.bold, marginHorizontal: 4, marginTop: -4 },
  ampmContainer: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  ampmBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  ampmText: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
  
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

  missionSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 12, maxHeight: '60%' },
  missionSheetTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bold, marginBottom: 16, textAlign: 'center' },
  categoryTitle: { fontSize: 12, fontFamily: FONT_FAMILY.extraBold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4, marginTop: 4 },
  missionListItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, marginBottom: 6 },
  missionSimpleIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  missionListLabel: { fontSize: 15, fontFamily: FONT_FAMILY.bold },
  detailThumbnail: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  footer: { flexDirection: 'row', marginTop: 12, marginBottom: 38, alignItems: 'center' },
  saveBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, lineHeight: 20, fontFamily: FONT_FAMILY.bold },
  playBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
