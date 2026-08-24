import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, Image, Animated } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { FONT_FAMILY } from '../constants/theme';
import { ROO_ASSETS } from '../constants/RooAssets';
import Icon from './Icon';

interface EvolutionTimelineSheetProps {
  visible: boolean;
  streak: number;
  onClose: () => void;
}

const TIERS = [
  { id: 'tier1', name: 'DORMILÓN', required: 0, target: 4, color: '#CD7F32', image: ROO_ASSETS.level1.base },
  { id: 'tier2', name: 'DESPIERTO', required: 4, target: 8, color: '#A9A9A9', image: ROO_ASSETS.level2.base },
  { id: 'tier3', name: 'ACTIVO', required: 8, target: 13, color: '#FFD700', image: ROO_ASSETS.level3.base },
  { id: 'tier4', name: 'PRO', required: 13, target: 18, color: '#50c8ff', image: ROO_ASSETS.level4.base },
  { id: 'tier5', name: 'LEYENDA', required: 18, target: 21, color: '#FF3B30', image: ROO_ASSETS.level5.base },
  { id: 'endgame', name: 'SALÓN DE LA FAMA', required: 21, target: 21, color: '#FF9500', image: ROO_ASSETS.level6.base },
];

// Nodo "próximamente" al final del camino
const COMING_SOON_NODE = { color: 'rgba(150,150,150,0.4)' };



export default function EvolutionTimelineSheet({ visible, streak, onClose }: EvolutionTimelineSheetProps) {
  const { colors } = useColors();
  const { t, evolutionName } = useLanguage();
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      enterAnim.setValue(0);
      Animated.timing(enterAnim, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('evolutionPath')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={24} color={colors.textDim} />
            </TouchableOpacity>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60, paddingTop: 20 }}>
            {TIERS.map((tier, index) => {
              const isUnlocked = streak >= tier.required;
              const isCurrent = streak >= tier.required && (index === TIERS.length - 1 || streak < TIERS[index + 1].required);
              
              let progress = 0;
              if (isUnlocked) {
                if (index === TIERS.length - 1 || streak >= tier.target) {
                  progress = 100;
                } else {
                  progress = Math.floor(((streak - tier.required) / (tier.target - tier.required)) * 100);
                }
              }

              const popInScale = enterAnim.interpolate({
                inputRange: [Math.max(0, index * 0.2 - 0.1), index * 0.2],
                outputRange: [0.3, 1],
                extrapolate: 'clamp'
              });

              const partialLineHeight = enterAnim.interpolate({
                inputRange: [index * 0.2, (index + 1) * 0.2],
                outputRange: [0, (progress / 100) * 40],
                extrapolate: 'clamp'
              });

              return (
                <View key={tier.id} style={styles.tierRow}>
                  {/* Timeline Line */}
                  {index < TIERS.length - 1 && (
                    <View style={[styles.line, { backgroundColor: colors.surface2 }]} />
                  )}
                  {index < TIERS.length - 1 && progress > 0 && (
                    <Animated.View style={[styles.line, { backgroundColor: tier.color, zIndex: 1, height: partialLineHeight }]} />
                  )}
                  {/* Línea punteada hacia el "próximamente" desde el último tier */}
                  {index === TIERS.length - 1 && (
                    <View style={[styles.line, { backgroundColor: 'transparent', borderLeftWidth: 3, borderLeftColor: colors.surface2, borderStyle: 'dashed' }]} />
                  )}

                  {/* Character Icon (Gamified Coin) */}
                  <Animated.View style={[
                    styles.imageContainer, 
                    { 
                      backgroundColor: isUnlocked ? tier.color + '15' : colors.surface, 
                      borderColor: isUnlocked ? tier.color : 'rgba(0,0,0,0.06)', 
                      borderWidth: 3,
                      borderBottomWidth: 8,
                      transform: [{ scale: popInScale }],
                      opacity: popInScale
                    }
                  ]}>
                    <Image 
                      source={tier.image} 
                      style={[styles.tierImage, { opacity: 1 }]} 
                      resizeMode="contain" 
                    />
                    {!isUnlocked && (
                      <View style={{ position: 'absolute', backgroundColor: colors.surface, padding: 6, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(0,0,0,0.06)', bottom: -10 }}>
                        <Icon name="lock" size={14} color={colors.textFaint} />
                      </View>
                    )}
                  </Animated.View>

                  {/* Details */}
                  <View style={styles.tierInfo}>
                    <Text style={[styles.tierName, { color: isUnlocked ? tier.color : colors.textFaint }]}>
                      {evolutionName(tier.id)}
                    </Text>
                    <Text style={[styles.tierSub, { color: colors.textDim }]}>
                      {tier.required} {tier.required === 1 ? t('day') : t('days')}
                    </Text>
                    
                    {isUnlocked && index < TIERS.length - 1 && progress < 100 && (
                      <View style={styles.progressContainer}>
                        <View style={[styles.progressBarBg, { backgroundColor: colors.surface }]}>
                          <View style={[styles.progressBarFill, { backgroundColor: tier.color, width: `${progress}%` }]} />
                          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 10, borderWidth: 2, borderColor: 'rgba(0,0,0,0.05)' }]} pointerEvents="none" />
                        </View>
                        <Text style={[styles.progressText, { color: tier.color }]}>{progress}%</Text>
                      </View>
                    )}
                    {isUnlocked && (index === TIERS.length - 1 || progress === 100) && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
                        <Icon name="check" size={16} color={tier.color} />
                        <Text style={{ fontSize: 12, fontFamily: FONT_FAMILY.bold, color: tier.color }}>{t('completed').toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Nodo "Próximamente" — el camino continúa */}
            <View style={styles.tierRow}>
              <View style={[styles.imageContainer, {
                backgroundColor: colors.surface,
                borderColor: colors.surface2,
                borderWidth: 3,
                borderBottomWidth: 8,
                borderStyle: 'dashed',
              }]}>
                <Text style={{ fontSize: 28 }}>🔮</Text>
              </View>
              <View style={[styles.tierInfo, { justifyContent: 'center' }]}>
                <Text style={[styles.tierName, { color: colors.textFaint, fontSize: 16 }]}>
                  {t('comingSoonTitle')}
                </Text>
                <Text style={[styles.tierSub, { color: colors.textFaint, fontSize: 13, fontFamily: FONT_FAMILY.regular, marginTop: 6 }]}>
                  {t('comingSoonSub')}
                </Text>
              </View>
            </View>
          </ScrollView>
          
          <View style={{ position: 'absolute', bottom: -500, left: 0, right: 0, height: 500, backgroundColor: colors.bg }} />
        </View>
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
    height: '80%',
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
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontFamily: FONT_FAMILY.black,
    letterSpacing: -0.5,
  },
  closeBtn: {
    padding: 4,
  },
  tierRow: {
    flexDirection: 'row',
    marginBottom: 40,
    alignItems: 'flex-start',
  },
  line: {
    position: 'absolute',
    left: 41, // half of image container width
    top: 90, // bottom of image container
    width: 8,
    height: 40, // gap size
    borderRadius: 4,
    zIndex: 0,
  },
  imageContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    zIndex: 2,
  },
  tierImage: {
    width: 64,
    height: 64,
    marginBottom: 4, // compensar el borderBottomWidth visualmente
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 20,
    fontFamily: FONT_FAMILY.black,
    letterSpacing: 1,
    marginBottom: 2,
  },
  tierSub: {
    fontSize: 15,
    fontFamily: FONT_FAMILY.bold,
    marginTop: 4,
  },
  progressContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 18,
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  progressText: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.black,
  }
});
