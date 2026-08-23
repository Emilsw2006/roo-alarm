import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT_FAMILY } from '../constants/theme';
import SquishyButton from './SquishyButton';

const ROO_IMAGE = require('../assets/entrevistador.png');
const BRAND_RED = '#E64235';

interface MissionRescuePromptProps {
  visible: boolean;
  tokens: number;
  variant: 'fail' | 'timeout';
  onUseToken: () => void;
  onDecline: () => void;
}

export default function MissionRescuePrompt({
  visible,
  tokens,
  variant,
  onUseToken,
  onDecline,
}: MissionRescuePromptProps) {
  const { colors } = useColors();
  const { t } = useLanguage();

  if (!visible) return null;

  const title = variant === 'timeout' ? t('camera.timeoutTitle') : t('camera.secondFail');
  const body = variant === 'timeout' ? t('camera.timeoutBody') : t('camera.failBody');
  const declineLabel = variant === 'timeout' ? t('camera.repeatAlarm') : t('camera.repeatPhoto');

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.iconWrap}>
          <Image source={ROO_IMAGE} style={styles.rooImage} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textDim }]}>{body}</Text>

        <View style={styles.actions}>
          <SquishyButton
            color={BRAND_RED}
            shadowColor="rgba(179, 45, 35, 0.42)"
            onPress={onUseToken}
            contentStyle={{ height: 56, alignItems: 'center', justifyContent: 'center', paddingVertical: 0 }}
          >
            <Text style={styles.primaryBtnText}>{t('camera.useToken', { count: tokens })}</Text>
          </SquishyButton>

          <TouchableOpacity onPress={onDecline} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryBtnText, { color: colors.textDim }]}>{declineLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 32,
    borderRadius: 36,
    width: '100%',
    alignItems: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  rooImage: {
    width: 96,
    height: 96,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 26,
    fontFamily: FONT_FAMILY.black,
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.medium,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: FONT_FAMILY.bold,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.bold,
  },
});
