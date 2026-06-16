import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import Icon from './Icon';
import { useLanguage } from '../constants/LanguageContext';

interface ConfirmDeleteModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({ visible, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: colors.bg, borderColor: colors.hairline }]}>
          
          <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 60, 60, 0.1)' }]}>
            <Icon name="trash" size={28} color="#ff4d4d" />
          </View>
          
          <Text style={[styles.title, { color: colors.text }]}>{t('deleteAlarmTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textDim }]}>
            {t('deleteAlarmBody')}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.btn, styles.btnCancel, { backgroundColor: colors.surface }]} onPress={onCancel}>
              <Text style={[styles.btnText, { color: colors.text }]}>{t('cancel')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={onConfirm}>
              <Text style={[styles.btnText, { color: '#ffffff' }]}>{t('delete')}</Text>
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
    backgroundColor: 'rgba(50,40,35,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 32,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  btnDelete: {
    backgroundColor: '#ff4d4d',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
