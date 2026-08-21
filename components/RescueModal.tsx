import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import Icon from './Icon';

interface RescueModalProps {
  visible: boolean;
  onUseToken: () => void;
  onAcceptPunishment: () => void;
  tokensAvailable: number;
}

export default function RescueModal({ visible, onUseToken, onAcceptPunishment, tokensAvailable }: RescueModalProps) {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modalBox, { backgroundColor: colors.isDark ? colors.surface : '#FFF' }]}>
          <Icon name="bell" size={60} color="#FF3B30" variant="solid" />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
            <Text style={[styles.title, { color: colors.text, marginTop: 0, marginBottom: 0, marginRight: 8 }]}>{t('modals.streakDanger')}</Text>
            <TouchableOpacity onPress={() => {
              import('react-native').then(({ Alert }) => {
                Alert.alert(
                  t('settingsScreen.rescueTokensInfoTitle'),
                  t('settingsScreen.rescueTokensInfoBody')
                );
              });
            }}>
              <Icon name="info" size={24} color={colors.textDim} stroke={2} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.description, { color: colors.textDim }]}>
            {t('modals.streakDangerBody')} ({tokensAvailable})
          </Text>
          
          <View style={styles.btnRow}>
            <TouchableOpacity 
              style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]} 
              onPress={onAcceptPunishment}
            >
              <Text style={[styles.btnText, { color: colors.textDim }]}>{t('modals.acceptDrop')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.btn, styles.btnPrimary]} 
              onPress={onUseToken}
            >
              <Text style={styles.btnTextPrimary}>{t('modals.useToken')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  btnPrimary: {
    backgroundColor: '#FF3B30',
  },
  btnText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnTextPrimary: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  }
});
