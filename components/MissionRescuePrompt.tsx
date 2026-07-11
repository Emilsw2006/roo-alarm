import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import Icon from './Icon';
import SquishyButton from './SquishyButton';

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
          <Icon name="sparkle" size={32} color="#FFB000" variant="solid" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textDim }]}>{body}</Text>

        <View style={styles.actions}>
          <SquishyButton
            color="#FFB000"
            shadowColor="rgba(255, 176, 0, 0.3)"
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 176, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
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
    fontWeight: '700',
    color: '#000',
  },
  secondaryBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
