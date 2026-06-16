import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../constants/ThemeContext';
import { useLanguage, Language } from '../constants/LanguageContext';
import { languageOptions } from '../constants/i18n';
import { useAuth } from '../constants/AuthContext';
import { useSubscription } from '../constants/SubscriptionContext';
import { LEGAL_LINKS } from '../constants/LegalLinks';
import { supabase } from '../lib/supabase';
import { FONT, FONT_FAMILY, SIZES } from '../constants/theme';
import Icon from '../components/Icon';
import SquishyButton from '../components/SquishyButton';
import Switch from '../components/Switch';
import {
  DEFAULT_ENABLED_MISSIONS,
  DEFAULT_PERSONALIZED_MISSION,
  getMission,
  MISSION_LIST,
  MissionMode,
  normalizeMissionId,
} from '../constants/missions';
import { SOUND_ASSETS } from '../constants/sounds';
import { configurePlaybackAudio, createRooAudioPlayer, RooAudioPlayer, stopRooAudioPlayer } from '../lib/audioPlayer';

interface SettingsScreenProps {
  navigation: any;
}

const USER_SETTINGS_SELECT = 'name, language, default_mission, default_sound, snooze_enabled, protected_days, mission_mode, enabled_missions, personalized_mission';

function SettingsRow({
  icon,
  title,
  detail,
  control,
  last,
  onPress,
}: {
  icon: string;
  title: string;
  detail?: string;
  control?: React.ReactNode;
  last?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useColors();
  
  const content = (
    <View style={[rowStyles.row]}>
      <View style={[rowStyles.iconBox, { backgroundColor: colors.brandOrange ? colors.brandOrange + '20' : colors.surface2 }]}>
        <Icon name={icon} size={18} color={colors.brandOrange || colors.accSolid} variant="solid" />
      </View>
      <Text style={[rowStyles.title, { color: colors.text }]} numberOfLines={2}>{title}</Text>
      <View style={rowStyles.trailing}>
        {!!detail && (
          <Text style={[rowStyles.detail, { color: colors.textDim }]} numberOfLines={1}>
            {detail}
          </Text>
        )}
        {control}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <View style={rowStyles.cardWrap}>
        <SquishyButton
          onPress={onPress}
          color={colors.surface}
          shadowColor="rgba(0,0,0,0.06)"
          borderRadius={SIZES.rMd}
          contentStyle={rowStyles.buttonContent}
        >
          {content}
        </SquishyButton>
      </View>
    );
  }
  return (
    <View style={[rowStyles.cardWrap, rowStyles.staticCard, { backgroundColor: colors.surface }]}>
      {content}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  cardWrap: {
    marginHorizontal: SIZES.pad,
    marginBottom: 12,
  },
  staticCard: {
    borderRadius: SIZES.rMd,
    borderWidth: 1,
    borderBottomWidth: 6,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  buttonContent: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 82,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 15.5,
    lineHeight: 20,
    fontFamily: FONT_FAMILY.bold,
  },
  trailing: {
    maxWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  detail: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT_FAMILY.semiBold,
    textAlign: 'right',
  },
});

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, streak, setStreak, rescueTokens } = useColors();
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  const { restorePurchases } = useSubscription();
  const [snooze, setSnooze] = useState(false);

  const [name, setName] = useState('');
  const [tempName, setTempName] = useState('');
  const [tempStreak, setTempStreak] = useState(streak.toString());
  const [defMission, setDefMission] = useState(DEFAULT_PERSONALIZED_MISSION);
  const [missionMode, setMissionMode] = useState<MissionMode>('personalized');
  const [enabledMissions, setEnabledMissions] = useState<string[]>(DEFAULT_ENABLED_MISSIONS);
  const [defSound, setDefSound] = useState('radar_classic');
  const [audioObj, setAudioObj] = useState<RooAudioPlayer | null>(null);
  const [protectedDays, setProtectedDays] = useState([0, 1, 2, 3, 4]);

  const [activePopup, setActivePopup] = useState<'name'|'language'|'streak'|null>(null);

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from('user_settings')
      .select(USER_SETTINGS_SELECT)
      .eq('user_id', user!.id)
      .single();
    if (error) {
      console.log('Load settings failed', error);
      return;
    }
    if (data) {
      applySettingsRow(data);
    }
  };

  const normalizeProtectedDays = (days: unknown, fallback: number[]) => {
    if (!Array.isArray(days)) return fallback;
    const normalized = [...new Set(days
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
      .sort((a, b) => a - b);
    return normalized.length > 0 ? normalized : fallback;
  };

  const applySettingsRow = (data: any) => {
    if (data.name) setName(data.name);
    if (data.language) setLanguage(data.language as Language);
    if (data.mission_mode === 'roulette' || data.mission_mode === 'personalized') setMissionMode(data.mission_mode);
    if (data.personalized_mission || data.default_mission) setDefMission(normalizeMissionId(data.personalized_mission || data.default_mission));
    if (Array.isArray(data.enabled_missions) && data.enabled_missions.length > 0) setEnabledMissions(data.enabled_missions);
    if (data.default_sound) setDefSound(data.default_sound);
    if (data.snooze_enabled !== null && data.snooze_enabled !== undefined) setSnooze(data.snooze_enabled);
    setProtectedDays(normalizeProtectedDays(data.protected_days, protectedDays));
  };

  const updateSetting = async (field: string, value: any) => {
    await updateSettings({ [field]: value });
  };

  const updateSettings = async (values: Record<string, any>) => {
    if (!user) return;
    const payload = { ...values, updated_at: new Date().toISOString() };
    const updateResult = await supabase
      .from('user_settings')
      .update(payload)
      .eq('user_id', user.id)
      .select(USER_SETTINGS_SELECT)
      .single();

    if (!updateResult.error && updateResult.data) {
      applySettingsRow(updateResult.data);
      return;
    }

    const upsertResult = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, ...payload }, { onConflict: 'user_id' })
      .select(USER_SETTINGS_SELECT)
      .single();

    if (upsertResult.error) {
      console.log('Update settings failed', upsertResult.error);
      return;
    }
    if (upsertResult.data) applySettingsRow(upsertResult.data);
  };

  const selectMissionMode = (mode: MissionMode) => {
    setMissionMode(mode);
    updateSetting('mission_mode', mode);
  };

  const selectPersonalizedMission = (missionId: string) => {
    setDefMission(missionId);
    updateSettings({ personalized_mission: missionId, default_mission: missionId });
  };

  const toggleRouletteMission = (missionId: string) => {
    const next = enabledMissions.includes(missionId)
      ? enabledMissions.filter(id => id !== missionId)
      : [...enabledMissions, missionId];

    if (next.length === 0) return;
    setEnabledMissions(next);
    updateSetting('enabled_missions', next);
  };

  const playPreview = async (asset: any) => {
    try {
      stopRooAudioPlayer(audioObj);
      await configurePlaybackAudio(false);
      const sound = createRooAudioPlayer(asset.file, { loop: false, volume: 1.0 });
      setAudioObj(sound);
      sound.play();
    } catch (e) {
      console.log('Preview error', e);
    }
  };

  const closePopup = () => {
    setActivePopup(null);
    if (audioObj) {
      stopRooAudioPlayer(audioObj);
      setAudioObj(null);
    }
  };

  const openLegalLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('No se pudo abrir el enlace', 'Inténtalo de nuevo en unos segundos.');
    });
  };

  const handleRestorePurchase = async () => {
    const result = await restorePurchases();
    Alert.alert(
      result.success ? t('onboarding.purchaseRestored') : t('purchaseNotFound'),
      result.success ? t('premiumUpdated') : result.error || t('purchaseAppleIdHint')
    );
  };

  const handleDeleteAccountRequest = () => {
    Alert.alert(
      t('settingsScreen.deleteAccount'),
      t('deleteAccountBody'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('requestDeletion'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.functions.invoke('delete-account', {
                body: { user_id: user?.id, email: user?.email },
              });
              if (error) throw error;
              await signOut();
              Alert.alert(t('deletionReceived'), t('deletionReceivedBody'));
            } catch {
              const subject = encodeURIComponent('Eliminar cuenta RooAlarm');
              const body = encodeURIComponent(`Quiero eliminar mi cuenta RooAlarm.\n\nEmail: ${user?.email || ''}\nUser ID: ${user?.id || ''}`);
              Linking.openURL(`mailto:${LEGAL_LINKS.supportEmail}?subject=${subject}&body=${body}`);
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.gradientBottom]}
      style={[styles.screen, { paddingTop: insets.top }]}
    >
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pad}>
          <View style={styles.headerRow}>
            <Text style={[styles.pageTitle, { color: colors.text }]}>{t('settings')}</Text>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => navigation.goBack()}
              style={[styles.doneBtn, { backgroundColor: colors.surface2, borderColor: colors.hairline }]}
            >
              <Text style={[styles.doneText, { color: colors.text }]}>{t('done')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ACCOUNT */}
        <View style={styles.pad}>
          <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>{t('settingsScreen.account')}</Text>
        </View>
        <SettingsRow 
          icon="user" 
          title={t('settingsScreen.name')}
          detail={name} 
          onPress={() => { setTempName(name); setActivePopup('name'); }} 
        />
        <SettingsRow icon="mail" title={t('settingsScreen.email')} detail={user?.email || ''} />
        <SettingsRow 
          icon="lifesaver" 
          title={t('settingsScreen.rescueTokens')}
          detail={rescueTokens.toString()} 
          last 
        />

        {/* GENERAL & WAKE-UP */}
        <View style={styles.pad}>
          <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>{t('settingsScreen.general')}</Text>
        </View>
        <SettingsRow
          icon="globe"
          title={t('language')}
          detail={languageOptions.find(option => option.id === language)?.label || t('settingsScreen.languageName')}
          control={<Icon name="chevR" size={16} color={colors.textFaint} stroke={3} />}
          onPress={() => setActivePopup('language')}
          last
        />

        {/* SNOOZE EXPLANATION */}
        <View style={styles.pad}>
          <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>{t('settingsScreen.snooze')}</Text>
        </View>
        <SettingsRow
          icon="clock"
          title={t('settingsScreen.snoozeAlarms')}
          control={<Switch on={snooze} onToggle={() => { setSnooze(!snooze); updateSetting('snooze_enabled', !snooze); }} />}
          last
        />
        <View style={[styles.pad, { marginBottom: 18 }]}>
          <Text style={[styles.infoText, { color: colors.textFaint }]}>
            {t('settingsScreen.snoozeInfo')}
          </Text>
        </View>

        {/* ABOUT / PRIVACY */}
        <View style={styles.pad}>
          <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>{t('settingsScreen.about')}</Text>
        </View>
        <SettingsRow
          icon="fileText"
          title={t('settingsScreen.terms')}
          control={<Icon name="chevR" size={16} color={colors.textFaint} />}
          onPress={() => openLegalLink(LEGAL_LINKS.terms)}
        />
        <SettingsRow
          icon="shield"
          title={t('settingsScreen.privacy')}
          control={<Icon name="chevR" size={16} color={colors.textFaint} />}
          onPress={() => openLegalLink(LEGAL_LINKS.privacy)}
        />
        <SettingsRow
          icon="repeat"
          title={t('settingsScreen.restorePurchase')}
          control={<Icon name="chevR" size={16} color={colors.textFaint} />}
          onPress={handleRestorePurchase}
          last
        />

        {/* DEVELOPER */}
        <View style={styles.pad}>
          <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>{t('settingsScreen.developer')}</Text>
        </View>
        <SettingsRow
          icon="edit"
          title={t('settingsScreen.editStreak')}
          detail={streak.toString()}
          control={<Icon name="chevR" size={16} color={colors.textFaint} />}
          onPress={() => { setTempStreak(streak.toString()); setActivePopup('streak'); }}
        />
        <SettingsRow
          icon="play"
          title={t('settingsScreen.simulateAlarm')}
          control={<Icon name="chevR" size={16} color={colors.textFaint} />}
          onPress={() => {
            const d = new Date();
            let h = d.getHours();
            const m = d.getMinutes().toString().padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            if (h === 0) h = 12;
            navigation.navigate('AlarmUnlock', { 
              isDaily: false, 
              alarm: { time: `${h}:${m}`, ampm, mission: defMission, label: t('settingsScreen.testAlarm') } 
            });
          }}
          last
        />

        {/* DANGER ZONE */}
        <View style={[styles.pad, { marginTop: 24 }]}>
          <SquishyButton 
            color="#FF3B30"
            shadowColor="rgba(255, 59, 48, 0.4)"
            borderRadius={SIZES.rMd}
            onPress={() => {
              if (user && signOut) signOut();
            }}
            contentStyle={{ paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFF', fontSize: 16, fontFamily: FONT_FAMILY.bold }}>{t('settingsScreen.signOut')}</Text>
          </SquishyButton>
          <TouchableOpacity onPress={handleDeleteAccountRequest} activeOpacity={0.75} style={styles.deleteAccountBtn}>
            <Text style={[styles.deleteAccountText, { color: colors.textDim }]}>{t('settingsScreen.deleteAccount')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* POPUPS */}
      <Modal visible={activePopup !== null} transparent animationType="fade" onRequestClose={closePopup}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closePopup} />
          
          <View style={[styles.modalContent, { backgroundColor: colors.bg, borderColor: colors.hairline, paddingBottom: Math.max(insets.bottom, 18) + 34 }]}>
            <View style={styles.modalHandle} />
            
            {activePopup === 'name' && (
              <View style={styles.modalInner}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settingsScreen.editName')}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.hairline }]}
                  value={tempName}
                  onChangeText={setTempName}
                  autoFocus
                  placeholder={t('auth.yourName')}
                  placeholderTextColor={colors.textFaint}
                />
                <SquishyButton 
                  color={colors.brandOrange || colors.accSolid}
                  shadowColor="rgba(0,0,0,0.2)"
                  borderRadius={12}
                  contentStyle={styles.modalSaveContent}
                  onPress={() => { setName(tempName); updateSetting('name', tempName); closePopup(); }}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>{t('save')}</Text>
                </SquishyButton>
              </View>
            )}

            {activePopup === 'streak' && (
              <View style={styles.modalInner}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settingsScreen.editStreakDays')}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.hairline }]}
                  value={tempStreak}
                  onChangeText={setTempStreak}
                  autoFocus
                  keyboardType="numeric"
                  placeholder={t('settingsScreen.editStreak')}
                  placeholderTextColor={colors.textFaint}
                />
                <SquishyButton 
                  color={colors.brandOrange || colors.accSolid}
                  shadowColor="rgba(0,0,0,0.2)"
                  borderRadius={12}
                  contentStyle={styles.modalSaveContent}
                  onPress={() => { 
                    const parsed = parseInt(tempStreak, 10);
                    if (!isNaN(parsed)) setStreak(parsed);
                    closePopup(); 
                  }}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>{t('save')}</Text>
                </SquishyButton>
              </View>
            )}

            {activePopup === 'language' && (
              <View style={styles.modalInner}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settingsScreen.selectLanguage')}</Text>
                {languageOptions.map(lang => (
                  <SquishyButton 
                    key={lang.id} 
                    style={{ marginBottom: 8 }}
                    contentStyle={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16 }} 
                    color={colors.surface}
                    shadowColor="rgba(0,0,0,0.06)"
                    borderRadius={12}
                    onPress={() => { setLanguage(lang.id as Language); updateSetting('language', lang.id); closePopup(); }}
                  >
                    <Text style={[styles.optionText, { color: colors.text }]}>{lang.flag} {lang.label}</Text>
                    {language === lang.id && <Icon name="check" size={20} color={colors.accSolid} />}
                  </SquishyButton>
                ))}
              </View>
            )}

          </View>
        </View>
      </Modal>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  pad: { paddingHorizontal: SIZES.pad },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 20, marginBottom: 26 },
  pageTitle: { flex: 1, fontSize: 32, fontFamily: FONT_FAMILY.black, letterSpacing: -0.5 },
  doneBtn: { minWidth: 86, minHeight: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: 15, fontFamily: FONT_FAMILY.bold },
  card: { borderRadius: SIZES.rLg, marginHorizontal: SIZES.pad, overflow: 'hidden', borderWidth: 2, borderBottomWidth: 6, borderColor: 'rgba(0,0,0,0.05)' },
  sectionTitle: { fontSize: 12, fontFamily: FONT_FAMILY.extraBold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  infoText: { fontSize: 13, lineHeight: 18, marginLeft: 4, fontFamily: FONT_FAMILY.semiBold },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 24, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 20 },
  modalInner: { paddingBottom: 10 },
  modalTitle: { fontSize: 22, fontFamily: FONT_FAMILY.bold, marginBottom: 20 },
  input: { height: 52, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: 16, fontSize: 16, marginBottom: 20, fontFamily: FONT_FAMILY.semiBold },
  modalBtn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalSaveContent: { height: 58, alignItems: 'center', justifyContent: 'center', paddingVertical: 0 },
  modalBtnText: { fontSize: 16, lineHeight: 20, fontFamily: FONT_FAMILY.bold },
  daysPickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, width: '100%' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1 },
  optionText: { fontSize: 16, fontFamily: FONT_FAMILY.bold },
  optionSubText: { fontSize: 12, fontFamily: FONT_FAMILY.semiBold, marginTop: 3 },
  segmentWrap: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 16 },
  segmentBtn: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
  segmentText: { fontSize: 14, fontFamily: FONT_FAMILY.bold },
  emojiBubble: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 24, lineHeight: 30 },
  deleteAccountBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  deleteAccountText: { fontSize: 14, fontFamily: FONT_FAMILY.bold, textDecorationLine: 'underline' },
});
