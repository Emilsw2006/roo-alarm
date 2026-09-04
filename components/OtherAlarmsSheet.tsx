import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT_FAMILY } from '../constants/theme';
import { Alarm } from '../constants/data';
import Icon from './Icon';
import Switch from './Switch';
import { useSwipeInteractive } from './useSwipeInteractive';
import * as Haptics from 'expo-haptics';

interface OtherAlarmsSheetProps {
  visible: boolean;
  alarms: Alarm[];
  onClose: () => void;
  onEdit: (alarm: Alarm) => void;
  onToggle: (id: number) => void;
  onAdd: () => void;
}

export default function OtherAlarmsSheet({ visible, alarms, onClose, onEdit, onToggle, onAdd }: OtherAlarmsSheetProps) {
  const { colors } = useColors();
  const { t } = useLanguage();
  
  React.useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [visible]);

  const swipe = useSwipeInteractive(visible, onClose);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay} {...swipe.panResponder.panHandlers}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <Animated.View style={[styles.sheet, { backgroundColor: colors.bg, transform: [{ translateY: swipe.panY }] }]}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('otherAlarms')}</Text>
            <TouchableOpacity onPress={onAdd} style={styles.addBtn}>
              <Icon name="plus" size={20} color={colors.accSolid} />
            </TouchableOpacity>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {alarms.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textDim }]}>{t('sheets.noAdditionalAlarms')}</Text>
            ) : (
              alarms.map((al) => (
                <TouchableOpacity 
                  key={al.id} 
                  style={[styles.alarmCard, { backgroundColor: colors.surface }]}
                  onPress={() => onEdit(al)}
                >
                  <View style={styles.alarmRight}>
                    <View style={styles.alarmTimeRow}>
                      <Text style={[styles.cardTime, { color: colors.text }]}>{al.time}</Text>
                    </View>
                    <Text style={[styles.cardLabel, { color: colors.textFaint }]}>
                      {al.specificDate && al.specificDate !== 'daily'
                        ? `${new Date(al.specificDate).getDate()} ${new Date(al.specificDate).toLocaleString('default', { month: 'short' })} • `
                        : `${t('sheets.dailyAlarm') || 'Diaria'} • `}
                      {al.label || al.mission}
                    </Text>
                  </View>
                  <Switch on={al.on} onToggle={() => onToggle(al.id)} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <View style={{ position: 'absolute', bottom: -500, left: 0, right: 0, height: 500, backgroundColor: colors.bg }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    height: '70%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: FONT_FAMILY.black,
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(231,71,60,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
    fontFamily: FONT_FAMILY.semiBold,
  },
  alarmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: 'rgba(0,0,0,0.06)',
    marginBottom: 8,
  },
  alarmRight: {
    flex: 1,
  },
  alarmTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  cardTime: {
    fontSize: 28,
    fontFamily: FONT_FAMILY.black,
    letterSpacing: -1,
  },
  cardAmpm: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.bold,
  },
  cardLabel: {
    fontSize: 13,
    marginTop: 4,
    fontFamily: FONT_FAMILY.semiBold,
  }
});
