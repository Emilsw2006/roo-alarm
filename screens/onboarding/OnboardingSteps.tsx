import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Switch, TextInput, Image, Platform, ScrollView, Easing, ActivityIndicator, Linking } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColors } from '../../constants/ThemeContext';
import { FONT } from '../../constants/theme';
import { useOnboarding } from '../../constants/OnboardingContext';
import { SOUND_ASSETS, SOUND_CATEGORIES } from '../../constants/sounds';
import { LinearGradient } from 'expo-linear-gradient';
import SoundWave from '../../components/SoundWave';
import SquishyButton from '../../components/SquishyButton';
import Icon from '../../components/Icon';
import CustomTimePicker from '../../components/CustomTimePicker';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Text as SvgText } from 'react-native-svg';
import { DEFAULT_ENABLED_MISSIONS, DEFAULT_PERSONALIZED_MISSION, MISSION_LIST, getMission } from '../../constants/missions';
import MissionGlyph from '../../components/MissionGlyph';
import * as Haptics from 'expo-haptics';
import SignaturePad from '../../components/SignaturePad';
import ParticleExplosion from '../../components/ParticleExplosion';
import { supabase } from '../../lib/supabase';
import { configurePlaybackAudio, createRooAudioPlayer, RooAudioPlayer, stopRooAudioPlayer } from '../../lib/audioPlayer';
import { ROO_ASSETS } from '../../constants/RooAssets';
import { useAuth } from '../../constants/AuthContext';
import { useSubscription } from '../../constants/SubscriptionContext';
import { LEGAL_LINKS } from '../../constants/LegalLinks';
import { AppleIcon, GoogleIcon } from '../../components/BrandIcons';
import { useLanguage } from '../../constants/LanguageContext';

// Componente de botón de opción (estilo Duolingo)
export const OptionButton = ({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) => {
  const { colors } = useColors();
  // We use brandOrange or accSolid to give it that vibrant selected look
  const activeColor = colors.accSolid || '#FF3B30';
  const activeShadow = '#C62828'; // darker red/orange for depth
  const inactiveShadow = colors.border;
  
  return (
    <View style={{ width: '100%', marginBottom: 12 }}>
      <SquishyButton 
        onPress={onPress}
        color={selected ? activeColor : colors.surface} 
        shadowColor={selected ? activeShadow : inactiveShadow}
        shadowDepth={4}
        borderRadius={16}
        contentStyle={{
          paddingVertical: 14,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Text style={{ fontFamily: FONT.bold, fontWeight: '700', color: selected ? '#FFF' : colors.text, textAlign: 'center', fontSize: 16 }}>{label}</Text>
      </SquishyButton>
    </View>
  );
};

// Placeholder para las imágenes de Roo
export const RooPlaceholder = ({ action, small }: { action: string, small?: boolean }) => {
  const { colors } = useColors();
  const size = small ? 60 : 160;
  return (
    <Image 
      source={require('../../assets/entrevistador.png')} 
      style={{ width: size, height: size, resizeMode: 'contain' }} 
    />
  );
};

// Speech Bubble Component
export const SpeechBubble = ({ text }: { text: string }) => {
  const { colors } = useColors();
  const borderColor = colors.text;
  const bubbleColor = colors.isDark ? colors.surface : '#FFFFFF';

  return (
    <View style={styles.speechBubbleContainer}>
      <View style={[styles.speechBubblePointer, { borderColor, backgroundColor: bubbleColor }]} />
      <View style={[styles.speechBubble, { borderColor: borderColor, backgroundColor: bubbleColor }]}>
        <Text style={[styles.speechBubbleText, { color: colors.text }]}>{text}</Text>
      </View>
    </View>
  );
};

const DelayedContinueButton = ({
  onPress,
  label,
  delayMs = 2200,
  color,
  textColor,
  shadowColor,
  contentStyle,
}: {
  onPress: () => void;
  label?: string;
  delayMs?: number;
  color: string;
  textColor: string;
  shadowColor: string;
  contentStyle?: any;
}) => {
  const { t } = useLanguage();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  const handlePress = () => {
    if (!ready) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <SquishyButton
      color={ready ? color : '#F0EDE7'}
      shadowColor={ready ? shadowColor : '#E0DCD4'}
      shadowDepth={ready ? 6 : 4}
      onPress={handlePress}
      contentStyle={contentStyle}
    >
      <Text style={[styles.btnText, { color: ready ? textColor : '#B7B0A7' }]}>{label || t('onboarding.continue')}</Text>
    </SquishyButton>
  );
};

// Layout para preguntas estilo Duolingo
export const QuestionLayout = ({ 
  question, 
  rooAction, 
  options, 
  selectedOption, 
  onSelectOption, 
  onNext,
  isNextDisabled,
  children
}: { 
  question: string, 
  rooAction: string, 
  options?: string[], 
  selectedOption?: string | null, 
  onSelectOption?: (o: string) => void, 
  onNext: () => void,
  isNextDisabled?: boolean,
  children?: React.ReactNode
}) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  
  // Si no hay options pero hay children, el botón siempre activo
  const isActive = isNextDisabled !== undefined ? !isNextDisabled : (options ? selectedOption !== null && selectedOption !== undefined : true);
  
  return (
    <View style={styles.container}>
      <View style={{ flex: 1, paddingTop: 0 }}>
        <View style={styles.characterRow}>
          <RooPlaceholder action={rooAction} small />
          <SpeechBubble text={question} />
        </View>
        
        <View style={{ flex: 1, gap: 4, marginTop: 20, paddingHorizontal: 4 }}>
          {options && options.map(opt => (
            <OptionButton 
              key={opt} 
              label={opt} 
              selected={selectedOption === opt} 
              onPress={() => onSelectOption && onSelectOption(opt)} 
            />
          ))}
          {children}
        </View>
      </View>
      
      {/* Botón de Continuar en la parte inferior */}
      <View style={{ paddingBottom: 10 }}>
        <SquishyButton 
          color={isActive ? colors.accSolid : '#F5F5F5'} 
          shadowColor={isActive ? '#C62828' : '#E0E0E0'} 
          shadowDepth={isActive ? 6 : 4}
          onPress={() => {
            if (!isActive) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } else {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onNext();
            }
          }}
          contentStyle={{ paddingVertical: 14 }}
        >
        <Text style={[styles.btnText, { color: isActive ? '#FFF' : '#B0B0B0' }]}>{t('onboarding.continue')}</Text>
        </SquishyButton>
      </View>
    </View>
  );
};

// Pantalla 1: Carga
export const Step1_Loading = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const textSlide = useRef(new Animated.Value(30)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  // ZZZ animations - 3 letters with staggered delays
  const zzz1 = useRef(new Animated.Value(0)).current;
  const zzz2 = useRef(new Animated.Value(0)).current;
  const zzz3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.08, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Floating ZZZ with stagger
    const animateZ = (anim: Animated.Value, delay: number) => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        ).start();
      }, delay);
    };
    animateZ(zzz1, 0);
    animateZ(zzz2, 600);
    animateZ(zzz3, 1200);

    // Text slide-up
    Animated.parallel([
      Animated.timing(textSlide, { toValue: 0, duration: 800, delay: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(textOpacity, { toValue: 1, duration: 800, delay: 400, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(onNext, 3000);
    return () => clearTimeout(t);
  }, []);

  const renderZ = (anim: Animated.Value, size: number, offsetX: number, offsetY: number) => (
    <Animated.Text style={{
      position: 'absolute',
      fontSize: size,
      fontWeight: '900',
      color: colors.accSolid,
      opacity: anim.interpolate({ inputRange: [0, 0.3, 0.8, 1], outputRange: [0, 0.7, 0.7, 0] }),
      transform: [
        { translateX: offsetX },
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [offsetY, offsetY - 50] }) },
        { scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1, 0.8] }) },
      ],
    }}>Z</Animated.Text>
  );

  return (
    <View style={styles.centerContainer}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ transform: [{ scale: breatheAnim }] }}>
          <RooPlaceholder action="durmiendo con ZZ" />
        </Animated.View>
        {/* Floating ZZZ */}
        <View style={{ position: 'absolute', top: 10, right: -10, width: 60, height: 80 }}>
          {renderZ(zzz1, 20, 0, 40)}
          {renderZ(zzz2, 16, 20, 20)}
          {renderZ(zzz3, 12, 40, 0)}
        </View>
      </View>
      <Animated.Text style={[styles.title, { color: colors.text, marginTop: 40, opacity: textOpacity, transform: [{ translateY: textSlide }] }]}>
        {t('onboarding.preparing')}
      </Animated.Text>
    </View>
  );
};

// Pantalla 2: Valor
export const Step2_Value = ({ onNext, onSignIn }: { onNext: () => void; onSignIn?: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  const line1 = useRef(new Animated.Value(0)).current;
  const line2 = useRef(new Animated.Value(0)).current;
  const line3 = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(300, [
      Animated.timing(line1, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(line2, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(line3, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      Animated.spring(btnAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }).start();
    });
  }, []);

  const getLineStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [25, 0] }) }],
  });

  return (
    <View style={styles.container}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 }}>
        {/* Headline */}
        <Animated.Text style={[getLineStyle(line1), { fontSize: 44, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -1 }]}>
          {t('onboarding.heroTitle')}
        </Animated.Text>

        {/* Subhead */}
        <Animated.Text style={[getLineStyle(line2), { fontSize: 20, fontWeight: '500', color: colors.textDim, textAlign: 'center', marginTop: 16, lineHeight: 30 }]}>
          {t('onboarding.heroSubtitle')}
        </Animated.Text>

        {/* Social proof */}
        <Animated.View style={[getLineStyle(line3), { flexDirection: 'row', alignItems: 'center', marginTop: 32, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }]}>
          <Text style={{ fontSize: 14, color: colors.textDim, fontWeight: '600' }}>{t('onboarding.socialProof')}</Text>
        </Animated.View>
      </View>

      <Animated.View style={{ gap: 12, transform: [{ scale: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }], opacity: btnAnim }}>
        <SquishyButton
          color={colors.accSolid}
          shadowColor="#C62828"
          shadowDepth={6}
          contentStyle={{ paddingVertical: 16 }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onNext();
          }}
        >
          <Text style={[styles.btnText, { color: '#FFF', fontSize: 20 }]}>{t('onboarding.buildPlan')}</Text>
        </SquishyButton>

        <TouchableOpacity
          style={{ height: 54, borderRadius: 17, backgroundColor: '#EAEAEA', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSignIn?.();
          }}
          activeOpacity={0.82}
        >
          <Text style={{ color: '#6F6F6F', fontSize: 16, fontWeight: FONT.bold }}>{t('onboarding.haveAccount')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// Pantalla 3: Primer Pensamiento
export const Step3_Thought = ({ onNext }: { onNext: () => void }) => {
  const { updateData } = useOnboarding();
  const { t, ta } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const options = ta('onboarding.thoughtOptions');

  return (
    <QuestionLayout 
      question={t('onboarding.qThought')}
      rooAction="asomando la cabeza"
      options={options}
      selectedOption={selected}
      onSelectOption={setSelected}
      onNext={() => { updateData({ wakeUpThought: selected }); onNext(); }}
    />
  );
};

// Pantalla 4: Qué te mantiene en la cama
export const Step4_BedReason = ({ onNext }: { onNext: () => void }) => {
  const { updateData } = useOnboarding();
  const { t, ta } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const options = ta('onboarding.bedOptions');

  return (
    <QuestionLayout 
      question={t('onboarding.qBed')}
      rooAction="abrazado a almohada"
      options={options}
      selectedOption={selected}
      onSelectOption={setSelected}
      onNext={() => { updateData({ stayInBedReason: selected }); onNext(); }}
    />
  );
};

// Pantalla 5: Hora habitual
export const Step5_UsualTime = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { updateData } = useOnboarding();
  const { t } = useLanguage();
  const [time, setTime] = useState(new Date(new Date().setHours(7, 30, 0, 0)));
  
  return (
    <QuestionLayout 
      question={t('onboarding.qUsualTime')}
      rooAction="con libreta"
      onNext={() => { updateData({ usualWakeTime: time }); onNext(); }}
    >
      <View style={{ marginTop: 40, alignItems: 'center' }}>
        <CustomTimePicker
          value={time}
          onChange={setTime}
        />
      </View>
    </QuestionLayout>
  );
};

// Pantalla 6: Frecuencia de posponer
export const Step6_SnoozeFreq = ({ onNext }: { onNext: () => void }) => {
  const { updateData } = useOnboarding();
  const { t, ta } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const options = ta('onboarding.snoozeOptions');

  return (
    <QuestionLayout 
      question={t('onboarding.qSnooze')}
      rooAction="pensativo"
      options={options}
      selectedOption={selected}
      onSelectOption={setSelected}
      onNext={() => { updateData({ snoozeHabit: selected }); onNext(); }}
    />
  );
};

// Pantalla 7: Cantidad de alarmas
export const Step7_AlarmCount = ({ onNext }: { onNext: () => void }) => {
  const { updateData } = useOnboarding();
  const { t, ta } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const options = ta('onboarding.alarmCountOptions');

  return (
    <QuestionLayout 
      question={t('onboarding.qAlarmCount')}
      rooAction="sorprendido"
      options={options}
      selectedOption={selected}
      onSelectOption={setSelected}
      onNext={() => { updateData({ alarmCount: selected }); onNext(); }}
    />
  );
};

// Pantalla 8: Biología
export const Step8_Biology = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <View style={styles.centerContainer}>
        <Text style={{ fontSize: 80, marginBottom: 30, textAlign: 'center' }}>??</Text>
        <Text style={[styles.title, { color: colors.text, marginBottom: 20, fontSize: 32, fontFamily: FONT.extraBold }]}>
          {t('onboarding.biologyTitle')}
        </Text>
        
        <View style={{ paddingHorizontal: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: colors.textDim, textAlign: 'center', lineHeight: 24, fontFamily: FONT.medium }}>
            {t('onboarding.biologyBody')}
          </Text>
        </View>
      </View>
      
      <DelayedContinueButton color={colors.text} textColor={colors.bg} shadowColor="rgba(0,0,0,0.3)" onPress={onNext} contentStyle={{ paddingVertical: 14 }} />
    </View>
  );
};

// Pantalla 9: Chart 
export const Step9_Chart = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 3500, // 3.5 seconds total for slower, more deliberate sequential animation
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const getAnimStyle = (start: number, end: number) => ({
    opacity: anim.interpolate({
      inputRange: [start, end],
      outputRange: [0, 1],
      extrapolate: 'clamp' as const,
    }),
    transform: [{
      translateY: anim.interpolate({
        inputRange: [start, end],
        outputRange: [15, 0],
        extrapolate: 'clamp' as const,
      })
    }]
  });

  const getScaleStyle = (start: number, end: number) => ({
    opacity: anim.interpolate({
      inputRange: [start, end],
      outputRange: [0, 1],
      extrapolate: 'clamp' as const,
    }),
    transform: [{
      scale: anim.interpolate({
        inputRange: [start, end],
        outputRange: [0.5, 1],
        extrapolate: 'clamp' as const,
      })
    }]
  });
  
  return (
    <View style={[styles.container, { paddingHorizontal: 0, paddingTop: 10 }]}>
      <Text style={[styles.title, { color: colors.text, marginBottom: 30, paddingHorizontal: 16, fontSize: 28 }]}>
        {t('onboarding.chartOneMission')}
      </Text>
      
      <ScrollView style={{ flex: 1, marginBottom: 10 }} contentContainerStyle={{ paddingBottom: 20, flexGrow: 1, justifyContent: 'center' }}>
        
        <View style={{ marginHorizontal: 24, marginTop: 20 }}>
          {/* Headers */}
          <Animated.View style={[{ flexDirection: 'row', marginBottom: 30 }, getAnimStyle(0, 0.2)]}>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '800', color: colors.textDim, letterSpacing: 0.5 }}>{t('onboarding.typicalMorning')}</Text>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '800', color: '#34C759', letterSpacing: 0.5 }}>{t('onboarding.rooMorning')}</Text>
          </Animated.View>

          <View style={{ flexDirection: 'row', height: 280 }}>
            {/* Columna Izquierda: Mañana Típica */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 100, height: '100%', position: 'relative' }}>
                {/* Línea continua en zigzag de fondo */}
                <View style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 24 }}>
                  <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 100">
                    <Path d="M12,0 L6,33 L12,66 L6,100" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M12,0 L6,33" fill="none" stroke="#FFA000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>

                <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 0 }}>
                  
                  <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, getAnimStyle(0.2, 0.4)]}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', zIndex: 2, borderWidth: 2, borderColor: '#FFA000' }}>
                      <Icon name="bell" size={12} color="#FFA000" variant="solid" />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <Text style={{ fontWeight: '800', color: colors.text, fontSize: 12 }}>07:00</Text>
                      <Text style={{ fontSize: 10, color: colors.textDim }}>{t('alarmFlow.alarm')}</Text>
                    </View>
                  </Animated.View>

                  <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', marginLeft: -6 }, getAnimStyle(0.4, 0.6)]}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', zIndex: 2, borderWidth: 2, borderColor: '#FF3B30' }}>
                      <Text style={{ fontWeight: '900', color: '#FF3B30', fontSize: 10 }}>Zz</Text>
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <Text style={{ fontWeight: '800', color: colors.text, fontSize: 12 }}>07:09</Text>
                      <Text style={{ fontSize: 10, color: colors.textDim }}>{t('onboarding.snoozeLabel')}</Text>
                    </View>
                  </Animated.View>

                  <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, getAnimStyle(0.6, 0.8)]}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', zIndex: 2, borderWidth: 2, borderColor: '#FF3B30' }}>
                      <Text style={{ fontWeight: '900', color: '#FF3B30', fontSize: 10 }}>Zz</Text>
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <Text style={{ fontWeight: '800', color: colors.text, fontSize: 12 }}>07:18</Text>
                      <Text style={{ fontSize: 10, color: colors.textDim }}>{t('onboarding.snoozeLabel')}</Text>
                    </View>
                  </Animated.View>

                  <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', marginLeft: -6 }, getAnimStyle(0.8, 1.0)]}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', zIndex: 2, borderWidth: 2, borderColor: '#FF3B30' }}>
                      <Icon name="info" size={14} color="#FF3B30" variant="solid" />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <Text style={{ fontWeight: '800', color: colors.textDim, fontSize: 12 }}>07:27</Text>
                      <Text style={{ fontSize: 10, color: colors.textDim }}>{t('onboarding.panicLabel')}</Text>
                    </View>
                  </Animated.View>

                </View>
              </View>
            </View>

            {/* Columna Derecha: Mañana con Roo */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 100, height: '100%', position: 'relative' }}>
                {/* Línea recta continua de fondo */}
                <Animated.View style={[{ position: 'absolute', top: 12, bottom: 50, left: 11, width: 2, alignItems: 'center' }, getAnimStyle(0.2, 0.6)]}>
                  <Svg width="2" height="100%" preserveAspectRatio="none" viewBox="0 0 2 100">
                    <Path d="M1,0 L1,100" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" />
                  </Svg>
                </Animated.View>

              <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 0 }}>
                
                <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, getAnimStyle(0.2, 0.4)]}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', zIndex: 2, borderWidth: 2, borderColor: '#34C759' }}>
                    <Icon name="bell" size={12} color="#34C759" variant="solid" />
                  </View>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ fontWeight: '800', color: colors.text, fontSize: 12 }}>07:00</Text>
                    <Text style={{ fontSize: 10, color: colors.textDim }}>{t('alarmFlow.alarm')}</Text>
                  </View>
                </Animated.View>

                <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, getAnimStyle(0.4, 0.6)]}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center', zIndex: 2 }}>
                    <Icon name="check" size={14} color="#FFF" />
                  </View>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ fontWeight: '800', color: colors.text, fontSize: 12 }}>07:01</Text>
                    <Text style={{ fontSize: 10, color: colors.textDim }}>{t('mission')}</Text>
                  </View>
                </Animated.View>

                <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, getAnimStyle(0.6, 0.8)]}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', zIndex: 2, borderWidth: 2, borderColor: '#34C759' }}>
                    <Icon name="star" size={12} color="#34C759" />
                  </View>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ fontWeight: '800', color: colors.text, fontSize: 12 }}>07:02</Text>
                    <Text style={{ fontSize: 10, color: colors.textDim }}>{t('onboarding.fullEnergy')}</Text>
                  </View>
                </Animated.View>

                {/* Badge de 25 min alineado con la base */}
                <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', marginLeft: -16, marginTop: 10 }, getScaleStyle(0.8, 1.0)]}>
                  <View style={{ backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center', zIndex: 2, borderWidth: 1, borderColor: '#34C759' }}>
                    <Text style={{ color: '#28A745', fontWeight: '900', fontSize: 16 }}>25 MIN</Text>
                    <Text style={{ color: '#28A745', fontWeight: '800', fontSize: 10, marginTop: 2 }}>{t('onboarding.minutesGained')}</Text>
                  </View>
                </Animated.View>

                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 10 }}>
        <DelayedContinueButton color={colors.accSolid} textColor="#FFF" shadowColor="#C62828" onPress={onNext} contentStyle={{ paddingVertical: 14 }} />
      </View>
    </View>
  );
};

export const Step10_OneAlarm = ({ onNext }: { onNext: () => void }) => {
  const { updateData } = useOnboarding();
  const { t, ta } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const options = ta('onboarding.singleAlarmOptions');

  return (
    <QuestionLayout 
      question={t('onboarding.qSingleAlarm')}
      rooAction="serio"
      options={options}
      selectedOption={selected}
      onSelectOption={setSelected}
      onNext={() => { updateData({ singleAlarmConfidence: selected }); onNext(); }}
    />
  );
};

// Pantalla 11: Camino al Templo (21 Days Evolution Path)
export const Step11_Temple = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  const [phase, setPhase] = useState(1);
  const [wordsVisible, setWordsVisible] = useState(0);

  const phase1Text = t('onboarding.trialTimeline') + ' ' + t('oneSmallMission');
  const words = phase1Text.split(" ");

  const enterAnim = useRef(new Animated.Value(0)).current;

  const [showContinue, setShowContinue] = useState(false);

  useEffect(() => {
    if (phase === 1) {
      let currentWord = 0;
      const interval = setInterval(() => {
        currentWord++;
        setWordsVisible(currentWord);
        Haptics.selectionAsync(); // Haptic feedback for each word
        if (currentWord >= words.length) {
          clearInterval(interval);
          setTimeout(() => {
            setPhase(2);
            Animated.timing(enterAnim, {
              toValue: 1,
              duration: 3000,
              useNativeDriver: true,
            }).start(() => {
              setShowContinue(true);
            });
          }, 1200);
        }
      }, 300); // Ligeramente más rápido
      return () => clearInterval(interval);
    }
  }, [phase]);

  const TIERS = [
    { id: 'tier1', name: 'DORMIL?N', days: 0, color: '#CD7F32', image: ROO_ASSETS.level1.base },
    { id: 'tier2', name: 'DESPIERTO', days: 4, color: '#A9A9A9', image: ROO_ASSETS.level2.base },
    { id: 'tier3', name: 'ACTIVO', days: 8, color: '#FFD700', image: ROO_ASSETS.level3.base },
    { id: 'tier4', name: 'PRO', days: 13, color: '#50c8ff', image: ROO_ASSETS.level4.base },
    { id: 'tier5', name: 'LEYENDA', days: 18, color: '#FF3B30', image: ROO_ASSETS.level5.base },
    { id: 'endgame', name: 'SAL?N FAMA', days: 21, color: '#000000', image: ROO_ASSETS.level6.base },
  ];

  if (phase === 1) {
    const displayedText = words.slice(0, wordsVisible).join(" ");
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <View style={styles.characterRow}>
          <RooPlaceholder action="épico con antorcha frente al Templo" small />
          <SpeechBubble text={displayedText} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal: 0, paddingTop: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 }}>
        <RooPlaceholder action="épico con antorcha frente al Templo" small />
        <SpeechBubble text={t('evolutionPath')} />
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ alignItems: 'center', width: '100%', position: 'relative' }}>
          
          {/* Curvas de Fondo SVG */}
          <Svg width="100%" height={TIERS.length * 70} style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, elevation: 0 }}>
            {TIERS.map((tier, index) => {
              if (index === TIERS.length - 1) return null;
              
              // Curvas mucho más amplias para aprovechar el ancho ("ocupa la amplada")
              const S_OFFSETS = [0, 90, 45, -45, -90, 0];
              const x1 = (Dimensions.get('window').width / 2) + S_OFFSETS[index];
              const y1 = index * 70 + 24; // 24 es el centro del círculo de 48px
              const x2 = (Dimensions.get('window').width / 2) + S_OFFSETS[index + 1];
              const y2 = (index + 1) * 70 + 24;
              
              // Puntos de control para la curva Bezier (curva suave "con curbas")
              const cx1 = x1;
              const cy1 = y1 + 35;
              const cx2 = x2;
              const cy2 = y2 - 35;
              
              const pathData = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

              // We need an AnimatedComponent to interpolate opacity
              const AnimatedPath = Animated.createAnimatedComponent(Path);

              return (
                <AnimatedPath
                  key={`path-${tier.id}`}
                  d={pathData}
                  fill="none"
                  stroke={tier.color}
                  strokeWidth={4}
                  strokeLinecap="round"
                  opacity={enterAnim.interpolate({
                    inputRange: [(index + 0.5) * 0.15, (index + 1.5) * 0.15],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                  })}
                />
              );
            })}
          </Svg>

          {TIERS.map((tier, index) => {
            const itemScale = enterAnim.interpolate({
              inputRange: [index * 0.15, (index + 1) * 0.15 + 0.1],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            });
            const opacity = itemScale;
            
            const S_OFFSETS = [0, 90, 45, -45, -90, 0];
            const xOffset = S_OFFSETS[index];

            return (
              <View key={tier.id} style={{ alignItems: 'center', height: 70, width: '100%', position: 'relative', zIndex: 10, elevation: 2 }}>
                
                {/* Character Icon */}
                <Animated.View style={[{ 
                    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', zIndex: 10, elevation: 2,
                    backgroundColor: colors.surface, 
                    borderColor: tier.color, 
                    borderWidth: 3,
                    opacity,
                    transform: [{ translateX: xOffset }, { scale: itemScale }]
                  }]}
                >
                  <Image source={tier.image} style={{ width: 26, height: 26 }} resizeMode="contain" />
                </Animated.View>

                {/* Days Text */}
                <Animated.View style={{ marginTop: 2, backgroundColor: 'rgba(242, 242, 246, 0.8)', paddingHorizontal: 6, borderRadius: 4, opacity, transform: [{ translateX: xOffset }, { scale: itemScale }] }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textDim }}>{tier.days} {tier.days === 1 ? t('day') : t('days')}</Text>
                </Animated.View>

              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 10, height: 70, justifyContent: 'flex-end' }}>
        {showContinue && (
          <Animated.View style={{ opacity: 1 }}>
            <SquishyButton color={colors.accSolid} shadowColor="#C62828" onPress={onNext} contentStyle={{ paddingVertical: 14 }}>
              <Text style={[styles.btnText, { color: '#FFF' }]}>{t('onboarding.continue')}</Text>
            </SquishyButton>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

// Pantalla 12: Acción física
export const Step12_PhysicalAction = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  return (
    <View style={styles.container}>
      <View style={styles.centerContainer}>
        <Icon name="bolt" size={80} color={colors.accSolid} style={{ marginBottom: 30 }} variant="solid" />
        <Text style={[styles.title, { color: colors.text, marginBottom: 20, fontSize: 32, fontFamily: FONT.extraBold }]}>
          Por qué la acción te despierta.
        </Text>
        
        <View style={{ paddingHorizontal: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: colors.textDim, textAlign: 'center', lineHeight: 24, fontFamily: FONT.medium }}>
            Completar una tarea física interrumpe el bucle de sueño al instante y arranca tu cerebro.
          </Text>
        </View>
      </View>
      
      <DelayedContinueButton color={colors.text} textColor={colors.bg} shadowColor="rgba(0,0,0,0.3)" onPress={onNext} contentStyle={{ paddingVertical: 14 }} />
    </View>
  );
};

// Pantalla 13: Sensación
export const Step13_WakeFeeling = ({ onNext }: { onNext: () => void }) => {
  const { updateData } = useOnboarding();
  const { t, ta } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const options = ta('onboarding.feelingOptions');

  return (
    <QuestionLayout 
      question={t('onboarding.qFeeling')}
      rooAction="estirándose"
      options={options}
      selectedOption={selected}
      onSelectOption={setSelected}
      onNext={() => { updateData({ wakeUpFeeling: selected }); onNext(); }}
    />
  );
};

// Pantalla 14: Modo de misión
export const Step14_MissionMode = ({ onNext }: { onNext: () => void }) => {
  const { updateData } = useOnboarding();
  const { t, ta } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const options = ta('onboarding.missionModeOptions');
  const rouletteLabel = options[1] || 'Roo Roulette';

  return (
    <QuestionLayout 
      question={t('onboarding.qMissionMode')}
      rooAction="con ruleta"
      options={options}
      selectedOption={selected}
      onSelectOption={setSelected}
      onNext={() => { 
        updateData({ missionType: selected === rouletteLabel ? 'roulette' : 'personalized' }); 
        onNext(); 
      }}
    />
  );
};

// Pantalla 15: Configurar misiones
export const Step15_MissionConfig = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { data, updateData } = useOnboarding();
  const { t, missionCopy } = useLanguage();
  const isRoulette = data.missionType === 'roulette';
  const [selected, setSelected] = useState<string[]>(isRoulette ? DEFAULT_ENABLED_MISSIONS : [DEFAULT_PERSONALIZED_MISSION]);

  const toggleMission = (id: string) => {
    if (isRoulette) {
      if (selected.includes(id) && selected.length === 1) return;
      if (selected.includes(id)) setSelected(selected.filter(m => m !== id));
      else setSelected([...selected, id]);
    } else {
      setSelected([id]);
    }
  };

  const handleConfirm = () => {
    updateData({ selectedMissions: selected.length > 0 ? selected : [DEFAULT_PERSONALIZED_MISSION] });
    onNext();
  };

  return (
    <QuestionLayout 
      question={isRoulette ? t('onboarding.qMissionConfigRoulette') : t('onboarding.qMissionConfigPersonal')}
      rooAction="preparado"
      onNext={handleConfirm}
      options={[]}
      selectedOption={selected.length > 0 ? 'selected' : null}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {MISSION_LIST.map((m) => {
          const isSelected = selected.includes(m.id);
          return (
            <SquishyButton 
              key={m.id}
              style={{ marginBottom: 12 }}
              contentStyle={{ 
                flexDirection: 'column',
                alignItems: 'stretch',
                paddingVertical: 14, paddingHorizontal: 18,
                borderWidth: 2,
                borderColor: isSelected ? colors.accSolid : 'transparent',
              }}
              color={isSelected ? colors.surface : colors.surface}
              shadowColor={isSelected ? "rgba(229, 57, 53, 0.1)" : "rgba(0,0,0,0.04)"}
              borderRadius={20}
              onPress={() => toggleMission(m.id)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ marginRight: 16, width: 48, height: 48, borderRadius: 16, backgroundColor: isSelected ? '#FFF' : colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontFamily: FONT.bold, color: colors.text }}>{missionCopy(m.id).label}</Text>
                  <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 3 }} numberOfLines={1}>{missionCopy(m.id).hint}</Text>
                </View>
                {isSelected && <Icon name="check" size={20} color={colors.accSolid} />}
              </View>
            </SquishyButton>
          );
        })}
      </ScrollView>
    </QuestionLayout>
  );
};
// Pantalla 16: Tiempo en despertar
export const Step16_AwakeTime = ({ onNext }: { onNext: () => void }) => {
  const { updateData } = useOnboarding();
  const { t, ta } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const options = ta('onboarding.awakeTimeOptions');

  return (
    <QuestionLayout 
      question={t('onboarding.qAwakeTime')}
      rooAction="reloj"
      options={options}
      selectedOption={selected}
      onSelectOption={setSelected}
      onNext={() => { updateData({ wakeUpDuration: selected }); onNext(); }}
    />
  );
};

// Pantalla 17: Hora objetivo
export const Step17_TargetTime = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { updateData } = useOnboarding();
  const { t } = useLanguage();
  const [time, setTime] = useState(new Date(new Date().setHours(6, 30, 0, 0)));

  return (
    <QuestionLayout 
      question={t('onboarding.qTargetTime')}
      rooAction="con campana"
      onNext={() => { updateData({ targetWakeTime: time }); onNext(); }}
    >
      <View style={{ marginTop: 40, alignItems: 'center' }}>
        <CustomTimePicker
          value={time}
          onChange={setTime}
        />
      </View>
    </QuestionLayout>
  );
};

// Pantalla 18: Días a proteger
export const Step18_ProtectedDays = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { updateData } = useOnboarding();
  const { t, fullWeekdays } = useLanguage();
  const [days, setDays] = useState([0, 1, 2, 3, 4]); // 0=Lunes, 4=Viernes

  const toggleDay = (idx: number) => {
    if (days.includes(idx)) setDays(days.filter(d => d !== idx));
    else setDays([...days, idx]);
  };

  const handleSave = () => {
    updateData({ protectedDays: days });
    onNext();
  };

  return (
    <QuestionLayout 
      question={t('onboarding.qProtectedDays')}
      rooAction="con calendario"
      onNext={handleSave}
      options={[]}
      selectedOption={days.length > 0 ? 'selected' : null}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10, paddingBottom: 20 }}>
        {fullWeekdays.map((d, i) => {
          const isSelected = days.includes(i);
          return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleDay(i);
                }}
                style={{ 
                  width: '100%', 
                  height: 52, 
                  borderRadius: 20, 
                  backgroundColor: isSelected ? 'rgba(255, 160, 0, 0.05)' : colors.surface, 
                  flexDirection: 'row',
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  paddingHorizontal: 20,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? (colors.brandOrange || '#FFA000') : colors.border
                }}
              >
                <Text style={{ fontFamily: FONT.bold, fontWeight: '700', fontSize: 16, color: isSelected ? (colors.brandOrange || '#FFA000') : colors.text }}>{d}</Text>
                {isSelected && <Icon name="check" size={20} color={colors.brandOrange || '#FFA000'} />}
              </TouchableOpacity>
          );
        })}
      </ScrollView>
    </QuestionLayout>
  );
};

// Pantalla 18b: Resumen objetivo
export const Step18b_GoalSummary = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { data } = useOnboarding();
  const targetTime = data.targetWakeTime || new Date(new Date().setHours(7, 0, 0, 0));
  const daysCount = data.protectedDays?.length || 5;
  const hours = targetTime.getHours();
  const minutes = targetTime.getMinutes();
  const isPM = hours >= 12;
  const hour12 = hours % 12 || 12;
  const timeText = `${hour12}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
  const monthlyHours = Math.round(daysCount * 4.3 * 0.5);
  const accent = colors.brandOrange || colors.accSolid;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingHorizontal: 28 }]}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 14 }}>
        <Text style={{ color: colors.text, fontSize: 32, lineHeight: 39, fontWeight: '900', textAlign: 'center', maxWidth: 330 }}>
          Despertar a las <Text style={{ color: accent }}>{timeText}</Text> es tu objetivo.
        </Text>

        <View style={{ marginTop: 30, alignItems: 'center', gap: 8 }}>
          <Text style={{ color: accent, fontSize: 20, lineHeight: 26, fontWeight: '900', textAlign: 'center' }}>
            {daysCount} días a la semana
          </Text>
          <Text style={{ color: colors.textDim, fontSize: 18, lineHeight: 24, fontWeight: '900', textAlign: 'center' }}>
            +{monthlyHours} horas este mes
          </Text>
        </View>

        <Text style={{ marginTop: 42, color: colors.textDim, fontSize: 16, lineHeight: 24, fontWeight: FONT.semiBold, textAlign: 'center', maxWidth: 255 }}>
          Protege tus mañanas clave.
        </Text>
      </View>

      <DelayedContinueButton color={colors.accSolid} textColor="#FFFFFF" shadowColor="#C62828" onPress={onNext} contentStyle={{ paddingVertical: 14 }} />
    </View>
  );
};

// Pantalla 19: Sonidos
export const Step19_SoundSettings = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { updateData } = useOnboarding();
  const { t, soundName, soundCategory } = useLanguage();
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [audioObj, setAudioObj] = useState<RooAudioPlayer | null>(null);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopRooAudioPlayer(audioObj);
    };
  }, [audioObj]);

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
      newSound.addListener('playbackStatusUpdate', (status: any) => {
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

  const handleNext = () => {
    stopRooAudioPlayer(audioObj);
    updateData({ soundSettings: selectedSoundId });
    onNext();
  };

  return (
    <QuestionLayout 
      question={t('onboarding.qSound')}
      rooAction="con auriculares"
      onNext={handleNext}
      isNextDisabled={!selectedSoundId}
    >
      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {SOUND_CATEGORIES.map((cat) => {
            const catSounds = SOUND_ASSETS.filter(s => s.category === cat);
            if (catSounds.length === 0) return null;
            return (
              <View key={cat} style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 12, fontFamily: FONT.extraBold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4, color: colors.textFaint }}>{soundCategory(cat)}</Text>
                {catSounds.map((s) => {
                  const isSelected = selectedSoundId === s.id;
                  const isPlaying = playingSoundId === s.id;
                  const activeColor = colors.brandOrange || '#FFA000';
                  return (
                    <SquishyButton 
                      key={s.id}
                      style={{ marginBottom: 6 }}
                      contentStyle={{
                        flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? activeColor : 'transparent',
                      }}
                      color={isSelected ? colors.surface : 'transparent'}
                      shadowColor="rgba(0,0,0,0.06)"
                      borderRadius={12}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedSoundId(s.id);
                        playPreview(s);
                      }}
                    >
                      <LinearGradient colors={s.gradient} style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: FONT.bold, color: colors.text }}>{soundName(s.id, s.name)}</Text>
                      </View>
                      {isSelected && <View style={{ marginRight: 12 }}><Icon name="check" size={18} color={activeColor} /></View>}
                      <TouchableOpacity onPress={() => playPreview(s)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                        {isPlaying ? (
                          <SoundWave color={activeColor} />
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
      </View>
    </QuestionLayout>
  );
};

// Pantalla 20: El Pacto (Firma)
export const Step20_ThePact = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  const [hasSignature, setHasSignature] = useState(false);

  return (
    <View style={styles.container}>
      <View style={{ flex: 1, paddingTop: 10 }}>
        <View style={{ alignItems: 'center' }}>
          <RooPlaceholder action="tendiendo el ala" small />
        </View>
        <Text style={[styles.title, { color: colors.text, marginTop: 20, marginBottom: 12, textAlign: 'center' }]}>{t('onboarding.signatureTitle')}</Text>
        <Text style={{ fontSize: 16, color: colors.textDim, lineHeight: 24, marginBottom: 24, textAlign: 'center' }}>
          {t('onboarding.signatureBody')}
        </Text>
        
        <View style={{ flex: 1, minHeight: 200, marginBottom: 20 }}>
          <SignaturePad onOK={(exists) => setHasSignature(exists)} height={240} />
        </View>
      </View>
      
      <View style={{ paddingBottom: 10 }}>
        <SquishyButton 
          color={hasSignature ? colors.accSolid : '#F5F5F5'} 
          shadowColor={hasSignature ? '#C62828' : '#E0E0E0'} 
          shadowDepth={hasSignature ? 6 : 4}
          onPress={() => {
            if (!hasSignature) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onNext();
            }
          }}
          contentStyle={{ paddingVertical: 14 }}
        >
          <Text style={[styles.btnText, { color: hasSignature ? '#FFF' : colors.textFaint }]}>{t('onboarding.sealPact')}</Text>
        </SquishyButton>
      </View>
    </View>
  );
};

// Pantalla 21: Notificaciones
export const Step21_Notifications = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <View style={styles.centerContainer}>
        <Icon name="bell" size={64} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text, marginTop: 32, marginBottom: 16 }]}>{t('onboarding.notificationsTitle')}</Text>
        <Text style={{ fontSize: 18, color: colors.textDim, lineHeight: 28, textAlign: 'center' }}>
          {t('onboarding.notificationsBody')}
        </Text>
      </View>
      <DelayedContinueButton color={colors.accSolid} textColor="#FFFFFF" shadowColor="#C62828" onPress={onNext} label={t('onboarding.allowNotifications')} />
    </View>
  );
};

// Pantalla 22: Reseñas
export const Step22_Reviews = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t, ta } = useLanguage();
  const authors = ['- Laura T.', '- Carlos M.', '- Ana S.'];
  const reviews = ta('onboarding.reviewQuotes').map((text, index) => ({ text, author: authors[index] || '' }));

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text, marginBottom: 40, marginTop: 40 }]}>{t('onboarding.reviewsTitle')}</Text>
      
      <View style={{ gap: 16 }}>
        {reviews.map((r, i) => (
          <View key={i} style={{ backgroundColor: colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
              {[1,2,3,4,5].map(s => <Icon key={s} name="star" size={16} color="#FFD700" variant="solid" />)}
            </View>
            <Text style={{ fontSize: 16, color: colors.text, fontWeight: '600', fontStyle: 'italic', marginBottom: 8 }}>{r.text}</Text>
            <Text style={{ fontSize: 14, color: colors.textDim }}>{r.author}</Text>
          </View>
        ))}
      </View>
      
      <View style={{ flex: 1 }} />
      <SquishyButton color={colors.primary} shadowColor="rgba(255, 176, 0, 0.3)" onPress={onNext}>
        <Text style={styles.btnText}>{t('onboarding.continue')}</Text>
      </SquishyButton>
    </View>
  );
};

// Pantalla 23: Gráfico de Líneas - Morning Energy Levels
export const Step23_PaywallChart = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  
  return (
    <View style={[styles.container, { paddingHorizontal: 0 }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 10 }}>
        <Text style={[styles.title, { color: colors.text, marginBottom: 20, fontSize: 32, textAlign: 'center' }]}>
          {t('onboarding.chartTitle')}
        </Text>
        
        <View style={{ width: '100%', paddingVertical: 16 }}>
          
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 30, textAlign: 'center' }}>{t('onboarding.energyLevels')}</Text>
          
          <View style={{ height: 180, width: '100%', position: 'relative' }}>
            <Svg width="100%" height="100%" viewBox="0 0 300 180" preserveAspectRatio="none">
              
              {/* Light Red background for Groggy Zone covering the bottom area */}
              <Path d="M 0,130 L 300,130 L 300,180 L 0,180 Z" fill="rgba(255, 59, 48, 0.08)" />
              <SvgText x="290" y="170" fill="rgba(255, 59, 48, 0.5)" fontSize="9" fontWeight="800" textAnchor="end" letterSpacing="0.5">{t('onboarding.groggyZone')}</SvgText>

              {/* Snooze Cycle Line (Red) */}
              <Path d="M 10,145 Q 25,75 40,145 Q 60,95 80,150 Q 105,115 130,155 L 300,155" fill="none" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <SvgText x="140" y="170" fill="#FF3B30" fontSize="10" fontWeight="800" opacity="0.6">{t('onboarding.snoozeCycle')}</SvgText>

              {/* Roo Protocol Line (Black/Dark) */}
              <Path d="M 10,145 C 80,145 130,30 280,30" fill="none" stroke={colors.text} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              
              {/* Dot at the end of Roo Protocol */}
              <Circle cx="280" cy="30" r="5" fill={colors.surface} stroke={colors.text} strokeWidth="2" />

              {/* Small red circle at the end of groggy line */}
              <Circle cx="295" cy="155" r="3" fill="none" stroke="#FF3B30" strokeWidth="2" />
            </Svg>

            {/* Absolute positioned badge for Roo Protocol following the curve */}
            <View style={{ position: 'absolute', top: 35, left: 110, backgroundColor: colors.text, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="star" size={10} color={colors.surface} variant="solid" />
              <Text style={{ color: colors.surface, fontSize: 10, fontWeight: '800', marginLeft: 6 }}>{t('onboarding.rooProtocol')}</Text>
            </View>
          </View>
          
          <View style={{ paddingHorizontal: 16, marginTop: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: colors.textDim, textAlign: 'center', lineHeight: 22, maxWidth: 280 }}>
              {t('onboarding.chartBody')}
            </Text>
          </View>
        </View>
      </ScrollView>
      
      <View style={{ paddingHorizontal: 24, paddingBottom: 10 }}>
        <SquishyButton color={colors.text} shadowColor="rgba(0,0,0,0.3)" onPress={onNext} contentStyle={{ paddingVertical: 14 }}>
          <Text style={[styles.btnText, { color: colors.bg }]}>{t('onboarding.continue')}</Text>
        </SquishyButton>
      </View>
    </View>
  );
};

// Pantalla 24: Soft Paywall
export const Step24_SoftPaywall = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  return (
    <View style={[styles.container, { backgroundColor: '#F9F9FB', margin: -24, padding: 24 }]}>
      <View style={styles.centerContainer}>
        <RooPlaceholder action="abriendo el Templo" />
        <Text style={[styles.title, { color: '#000', marginTop: 32, marginBottom: 16, fontSize: 36 }]}>{t('onboarding.unlockTemple')}</Text>
        <Text style={{ fontSize: 18, color: '#666', textAlign: 'center' }}>{t('oneSmallMission')}</Text>
      </View>
      
      <View style={{ gap: 16 }}>
        <SquishyButton color={colors.primary} shadowColor="rgba(255, 176, 0, 0.3)" onPress={onNext} contentStyle={{ height: 64 }}>
          <Text style={[styles.btnText, { fontSize: 22 }]}>{t('onboarding.trialStart')}</Text>
        </SquishyButton>
        <Text style={{ textAlign: 'center', color: '#888', fontSize: 14 }}>{t('onboarding.cancelAnytime')}</Text>
      </View>
    </View>
  );
};

// Pantalla 25: Timeline de Transparencia
export const Step25_TransparencyTimeline = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text, marginBottom: 40, marginTop: 40 }]}>{t('onboarding.trialTimeline')}</Text>
      
      <View style={{ paddingLeft: 20 }}>
        {/* Hoy */}
        <View style={{ flexDirection: 'row', marginBottom: 40 }}>
          <View style={{ alignItems: 'center', marginRight: 20 }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accSolid, zIndex: 2 }} />
            <View style={{ width: 2, height: 60, backgroundColor: colors.accSolid, position: 'absolute', top: 16 }} />
          </View>
          <View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('today')}</Text>
            <Text style={{ color: colors.textDim }}>{t('onboarding.todayUnlock')}</Text>
          </View>
        </View>

        {/* Día 5 */}
        <View style={{ flexDirection: 'row', marginBottom: 40 }}>
          <View style={{ alignItems: 'center', marginRight: 20 }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, zIndex: 2 }} />
            <View style={{ width: 2, height: 60, backgroundColor: colors.border, position: 'absolute', top: 16 }} />
          </View>
          <View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('onboarding.day5')}</Text>
            <Text style={{ color: colors.textDim }}>{t('onboarding.day5Reminder')}</Text>
          </View>
        </View>

        {/* Día 7 */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ alignItems: 'center', marginRight: 20 }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.border, zIndex: 2 }} />
          </View>
          <View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('onboarding.day7')}</Text>
            <Text style={{ color: colors.textDim }}>{t('onboarding.day7Plan')}</Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }} />
      <SquishyButton color={colors.primary} shadowColor="rgba(255, 176, 0, 0.3)" onPress={onNext}>
        <Text style={styles.btnText}>{t('onboarding.understood')}</Text>
      </SquishyButton>
    </View>
  );
};

// Pantalla 26: Hard Paywall
export const Step26_HardPaywall = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  const [showPlans, setShowPlans] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text, marginBottom: 40, marginTop: 40 }]}>{t('onboarding.investMorning')}</Text>
      
      <View style={{ padding: 24, borderRadius: 24, backgroundColor: 'rgba(255, 176, 0, 0.1)', borderWidth: 2, borderColor: colors.primary, marginBottom: 16 }}>
        <View style={{ position: 'absolute', top: -14, left: '50%', transform: [{ translateX: -40 }], backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{t('onboarding.popular')}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, textAlign: 'center' }}>{t('onboarding.annualPlan')}</Text>
        <Text style={{ fontSize: 16, color: colors.textDim, textAlign: 'center', marginTop: 8 }}>{t('onboarding.savePercent')}</Text>
        <Text style={{ fontSize: 32, fontWeight: '900', color: colors.primary, textAlign: 'center', marginTop: 16 }}>39,99€ / año</Text>
      </View>

      {!showPlans ? (
        <TouchableOpacity onPress={() => setShowPlans(true)} style={{ padding: 16 }}>
          <Text style={{ color: colors.textDim, textAlign: 'center', fontWeight: 'bold', textDecorationLine: 'underline' }}>{t('onboarding.seePlans')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ padding: 20, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, textAlign: 'center' }}>{t('onboarding.weeklyPlan')}</Text>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.textDim, textAlign: 'center', marginTop: 8 }}>{t('onboarding.weeklyPrice')}</Text>
        </View>
      )}

      <View style={{ flex: 1 }} />
      <SquishyButton color={colors.primary} shadowColor="rgba(255, 176, 0, 0.3)" onPress={onNext}>
        <Text style={styles.btnText}>{t('onboarding.subscribe')}</Text>
      </SquishyButton>
    </View>
  );
};

// Pantalla 27: Auth
export const Step27_Auth = ({ onNext, onSignIn }: { onNext: () => void; onSignIn?: () => void }) => {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const { colors } = useColors();
  const { t } = useLanguage();
  const [showEmail, setShowEmail] = useState(false);
  const emailAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(emailAnim, {
      toValue: showEmail ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [showEmail]);

  const emailHeight = emailAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 70] });
  const emailOpacity = emailAnim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] });
  const emailTranslate = emailAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[styles.title, { color: '#050505', marginBottom: 34, textAlign: 'left', fontSize: 39, lineHeight: 45 }]}>{t('auth.saveProgress')}</Text>

        <View style={{ width: '100%', gap: 12 }}>
          <TouchableOpacity
            style={{ height: 58, flexDirection: 'row', backgroundColor: '#050505', borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 12 }}
            onPress={signInWithApple}
            activeOpacity={0.86}
          >
            <AppleIcon />
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: FONT.bold }} numberOfLines={1}>{t('auth.continueApple')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ height: 58, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1.5, borderColor: '#E9E6DF' }}
            onPress={signInWithGoogle}
            activeOpacity={0.86}
          >
            <GoogleIcon />
            <Text style={{ color: '#373737', fontSize: 17, fontWeight: FONT.bold }} numberOfLines={1}>{t('auth.continueGoogle')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ height: 52, borderRadius: 16, backgroundColor: '#FFF8F8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}
            onPress={() => setShowEmail(prev => !prev)}
            activeOpacity={0.75}
          >
            <Icon name="mail" size={18} color="#E53935" variant="outline" />
            <Text style={{ color: '#E53935', fontSize: 16, fontWeight: FONT.bold }} numberOfLines={1}>{t('auth.continueEmail')}</Text>
            <Icon name={showEmail ? 'chevDown' : 'chevR'} size={17} color="#A09E9B" />
          </TouchableOpacity>

          <Animated.View style={{ height: emailHeight, opacity: emailOpacity, overflow: 'hidden', transform: [{ translateY: emailTranslate }] }}>
            <View style={{ gap: 10, paddingTop: 8 }}>
              <TouchableOpacity
                style={{ height: 54, borderRadius: 17, backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center' }}
                onPress={onNext}
                activeOpacity={0.86}
              >
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: FONT.bold }}>{t('onboarding.createWithEmail')}</Text>
              </TouchableOpacity>
              <Text style={{ color: '#A09E9B', fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: FONT.semiBold }}>
                {t('onboarding.emailNextStep')}
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>

      <TouchableOpacity onPress={onSignIn} activeOpacity={0.75} style={{ paddingVertical: 14, alignItems: 'center' }}>
        <Text style={{ color: '#A09E9B', fontSize: 14, fontWeight: FONT.bold }}>{t('onboarding.haveAccount')}</Text>
      </TouchableOpacity>
    </View>
  );
};

// Pantalla 28: Formulario Nombre
export const Step28_FinalForm = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { data, updateData } = useOnboarding();
  const { t, ta } = useLanguage();
  const [name, setName] = useState(data.userName || '');
  const genderOptions = ta('onboarding.genderOptions');

  const handleSave = async () => {
    updateData({ userName: name });
    const selectedMissions = data.selectedMissions && data.selectedMissions.length > 0
      ? data.selectedMissions
      : [DEFAULT_PERSONALIZED_MISSION];
    const missionMode = data.missionType === 'roulette' ? 'roulette' : 'personalized';
    const personalizedMission = missionMode === 'roulette'
      ? selectedMissions[0]
      : selectedMissions[0] || DEFAULT_PERSONALIZED_MISSION;

    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      await supabase
        .from('user_settings')
        .update({
          name,
          mission_mode: missionMode,
          enabled_missions: missionMode === 'roulette' ? selectedMissions : DEFAULT_ENABLED_MISSIONS,
          personalized_mission: personalizedMission,
          default_mission: personalizedMission,
          wake_up_thought: data.wakeUpThought,
          stay_in_bed_reason: data.stayInBedReason,
          usual_wake_time: data.usualWakeTime?.toISOString(),
          snooze_habit: data.snoozeHabit,
          alarm_count: data.alarmCount,
          single_alarm_confidence: data.singleAlarmConfidence,
          wake_up_feeling: data.wakeUpFeeling,
          wake_up_duration: data.wakeUpDuration,
          target_wake_time: data.targetWakeTime?.toISOString(),
          protected_days: data.protectedDays,
          alarm_sound: data.soundSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', authData.user.id);
    }
    onNext();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text, marginBottom: 40, marginTop: 40 }]}>{t('onboarding.finalNameTitle')}</Text>
      
      <View>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textDim, marginBottom: 8 }}>{t('onboarding.yourName')}</Text>
        <TextInput 
          style={{ backgroundColor: colors.surface, padding: 20, borderRadius: 16, fontSize: 18, color: colors.text, borderWidth: 1, borderColor: colors.border }}
          placeholder="Ej. Emil"
          placeholderTextColor={colors.textDim}
          value={name}
          onChangeText={setName}
        />
      </View>

      <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textDim, marginBottom: 8, marginTop: 24 }}>{t('onboarding.gender')}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {genderOptions.map(g => (
          <TouchableOpacity key={g} onPress={() => updateData({ gender: g })} style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: data.gender === g ? colors.primary : colors.surface, alignItems: 'center' }}>
            <Text style={{ color: data.gender === g ? '#fff' : colors.text, fontWeight: 'bold' }}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <SquishyButton color={colors.accSolid} shadowColor="rgba(76, 175, 80, 0.3)" onPress={handleSave}>
        <Text style={[styles.btnText, { color: '#fff' }]}>{t('onboarding.finish')}</Text>
      </SquishyButton>
    </View>
  );
};

// Pantalla 28b: Tu Plan de Mañana
export const Step28b_MorningPlan = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { data } = useOnboarding();
  const { t, missionCopy, soundName: translatedSoundName } = useLanguage();
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const targetTime = data.targetWakeTime || new Date(new Date().setHours(6, 30, 0, 0));
  const hours = targetTime.getHours().toString().padStart(2, '0');
  const minutes = targetTime.getMinutes().toString().padStart(2, '0');

  const soundId = data.soundSettings;
  const soundObj = soundId ? SOUND_ASSETS.find(s => s.id === soundId) : null;
  const soundName = translatedSoundName(soundId, soundObj?.name || 'Classic Radar');

  const missionIds = data.selectedMissions || ['make_bed'];
  const missionMode = data.missionType || 'personalized';
  const mainMission = getMission(missionIds[0]);
  const isRoulette = missionMode === 'roulette';
  const activeDays = data.protectedDays || [0, 1, 2, 3, 4];
  const daysLabel = activeDays.length === 7 ? t('onboarding.allDays') : t('onboarding.daysPerWeek', { count: activeDays.length });

  const rows = [
    { icon: 'bell', label: t('alarmFlow.alarm'), value: hours + ':' + minutes },
    { icon: isRoulette ? 'repeat' : 'check', label: t('mission'), value: isRoulette ? t('onboarding.rouletteShort') : missionCopy(mainMission.id).label },
    { icon: 'volume', label: t('sound'), value: soundName },
  ];

  const getAnimDelay = (index: number) => ({
    opacity: enterAnim.interpolate({ inputRange: [index * 0.12, (index + 1) * 0.12 + 0.1], outputRange: [0, 1], extrapolate: 'clamp' as const }),
    transform: [{ translateY: enterAnim.interpolate({ inputRange: [index * 0.12, (index + 1) * 0.12 + 0.1], outputRange: [16, 0], extrapolate: 'clamp' as const }) }],
  });

  return (
    <View style={[styles.container, { paddingHorizontal: 28 }]}> 
      <View style={{ flex: 1, justifyContent: 'center', paddingTop: 12 }}>
        <Animated.Text style={[styles.title, { color: colors.text, marginBottom: 6, fontSize: 24, lineHeight: 30 }, getAnimDelay(0)]}>
          {t('onboarding.planReadyTitle')}
        </Animated.Text>
        <Animated.Text style={[{ fontSize: 14, color: colors.textDim, textAlign: 'center', marginBottom: 24, fontWeight: FONT.semiBold }, getAnimDelay(0)]}>
          {t('onboarding.planReadySubtitle')}
        </Animated.Text>

        <Animated.View style={[{ alignItems: 'center', marginBottom: 22 }, getAnimDelay(1)]}>
          <Text style={{ fontSize: 50, lineHeight: 58, fontWeight: '900', color: colors.text }}>
            {hours}:{minutes}
          </Text>
          <Text style={{ color: colors.textDim, fontSize: 15, lineHeight: 21, fontWeight: FONT.bold, marginTop: 2 }}>
            {daysLabel}
          </Text>
        </Animated.View>

        {rows.map((item, index) => (
          <Animated.View key={item.label} style={[{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 18,
            backgroundColor: colors.surface,
            marginBottom: 10,
          }, getAnimDelay(index + 2)]}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
              <Icon name={item.icon} size={19} color={colors.textDim} />
            </View>
            <Text style={{ color: colors.textDim, fontSize: 14, fontWeight: FONT.bold, width: 72 }}>
              {item.label}
            </Text>
            <Text style={{ color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '900', flex: 1, textAlign: 'right' }} numberOfLines={1}>
              {item.value}
            </Text>
          </Animated.View>
        ))}
      </View>

      <SquishyButton
        color={colors.accSolid}
        shadowColor="#C62828"
        shadowDepth={6}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onNext(); }}
        contentStyle={{ paddingVertical: 14 }}
      >
        <Text style={[styles.btnText, { color: '#FFF' }]}>{t('onboarding.readyLetsGo')}</Text>
      </SquishyButton>
    </View>
  );
};

// Pantalla 29: Procesando - con datos reales y barra de progreso
export const Step29_Processing = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { data } = useOnboarding();
  const { t, ta } = useLanguage();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [stepIndex, setStepIndex] = useState(0);
  const textOpacity = useRef(new Animated.Value(1)).current;

  const targetTime = data.targetWakeTime || new Date(new Date().setHours(6, 30, 0, 0));
  const timeStr = `${targetTime.getHours().toString().padStart(2, '0')}:${targetTime.getMinutes().toString().padStart(2, '0')}`;
  const missionMode = data.missionType === 'roulette' ? t('onboarding.rouletteShort') : t('custom');

  const steps = ta('onboarding.processingSteps').map(step => step.replace('{time}', timeStr).replace('{mode}', missionMode));

  useEffect(() => {
    // Animate progress bar over total duration
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 4500,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();

    // Step through messages
    let current = 0;
    const interval = setInterval(() => {
      // Fade out
      Animated.timing(textOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        current++;
        if (current >= steps.length) {
          clearInterval(interval);
          setTimeout(onNext, 600);
          return;
        }
        setStepIndex(current);
        // Fade in
        Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <RooPlaceholder action="volando o caminando rápido" />

      <Animated.Text style={[styles.title, {
        color: colors.text, marginTop: 40, marginBottom: 40, fontSize: 20, fontWeight: '700',
        opacity: textOpacity,
      }]}>
        {steps[stepIndex]}
      </Animated.Text>

      {/* Progress Bar */}
      <View style={{ width: '80%', height: 14, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 7, overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', backgroundColor: colors.accSolid, borderRadius: 7, width: progressWidth }} />
      </View>

      <Text style={{ marginTop: 16, fontSize: 13, color: colors.textDim, fontWeight: '600' }}>
        {t('onboarding.processing')}
      </Text>
    </View>
  );
};


// Arrays de exportación
export const Step30_TrialIntro = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingHorizontal: 24, paddingTop: 8 }]}> 
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 31, lineHeight: 37, fontWeight: '900', textAlign: 'center', marginBottom: 28, maxWidth: 330 }}>
          {t('onboarding.tryRooFree')}
        </Text>

        <View style={{ width: '100%', maxWidth: 330, borderRadius: 26, borderWidth: 2, borderColor: colors.hairline2, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <View style={{ paddingTop: 24, paddingHorizontal: 22, paddingBottom: 22, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22 }}>
              <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(229,57,53,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="bell" size={25} color={colors.accSolid} />
              </View>
              <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(229,57,53,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={25} color={colors.accSolid} stroke={3} />
              </View>
            </View>
            <Text style={{ color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: '900', textAlign: 'center', maxWidth: 250 }}>
              {t('onboarding.alarmMissionsUnlocked')}
            </Text>
          </View>

          <View style={{ backgroundColor: colors.surface2, paddingVertical: 15, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={16} color={colors.accSolid} variant="outline" stroke={3} />
            </View>
            <Text style={{ color: colors.text, fontSize: 16, lineHeight: 20, fontWeight: '900', textAlign: 'center', flexShrink: 1 }}>{t('onboarding.noPaymentNow')}</Text>
          </View>
        </View>
      </View>

      <View style={{ paddingBottom: 4 }}>
        <DelayedContinueButton color="#050505" textColor="#FFFFFF" shadowColor="rgba(0,0,0,0.18)" onPress={onNext} label={t('onboarding.tryForZero')} contentStyle={{ paddingVertical: 17, minWidth: '100%' }} />
      </View>
    </View>
  );
};

export const Step31_TrialReminder = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingHorizontal: 24, paddingTop: 8 }]}> 
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: '900', textAlign: 'center', maxWidth: 335, marginBottom: 54 }}>
          {t('onboarding.trialReminderTitle')}
        </Text>

        <View style={{ width: 156, height: 156, alignItems: 'center', justifyContent: 'center', marginBottom: 64 }}>
          <Svg width={146} height={146} viewBox="0 0 146 146">
            <Path d="M73 23 C53 23 39 39 39 61 L39 82 C39 89 34 95 28 99 L28 108 L118 108 L118 99 C112 95 107 89 107 82 L107 61 C107 39 93 23 73 23 Z" fill="#DDE8E7" />
            <Path d="M60 115 C62 123 67 128 73 128 C79 128 84 123 86 115 Z" fill="#DDE8E7" />
            <Path d="M64 22 C64 15 69 11 73 11 C77 11 82 15 82 22" fill="#DDE8E7" />
          </Svg>
          <View style={{ position: 'absolute', top: 22, right: 8, width: 66, height: 66, borderRadius: 33, backgroundColor: colors.accSolid, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 38, lineHeight: 44, fontWeight: '900' }}>1</Text>
          </View>
        </View>
      </View>

      <View style={{ alignItems: 'center', paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon name="check" size={24} color={colors.text} variant="outline" stroke={3} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{t('onboarding.noPaymentNow')}</Text>
        </View>
        <DelayedContinueButton color="#050505" textColor="#FFFFFF" shadowColor="rgba(0,0,0,0.18)" onPress={onNext} label={t('onboarding.continueFree')} contentStyle={{ paddingVertical: 14, minWidth: '100%' }} />
        <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: FONT.bold, textAlign: 'center', marginTop: 12 }}>
          {t('onboarding.annualSmallPrice')}
        </Text>
      </View>
    </View>
  );
};

export const Step32_FinalPaywall = ({ onNext, onSignIn }: { onNext: () => void; onSignIn?: () => void }) => {
  const { colors } = useColors();
  const { session } = useAuth();
  const { t } = useLanguage();
  const { annualPackage, monthlyPackage, purchasePlan, restorePurchases, loading: subscriptionLoading, error: subscriptionError } = useSubscription();
  const [showPlans, setShowPlans] = useState(false);
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const euro = String.fromCharCode(8364);
  const isAnnual = plan === 'annual';
  const annualPrice = annualPackage?.product.priceString || `30,99 ${euro}`;
  const monthlyPrice = monthlyPackage?.product.priceString || `4,99 ${euro}`;
  const legalTextColor = colors.textDim;

  const handlePay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!session) {
      onSignIn?.();
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await purchasePlan(plan);
    setBusy(false);
    if (!result.success && result.error) {
      setMessage(result.error);
    }
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!session) {
      onSignIn?.();
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await restorePurchases();
    setBusy(false);
    setMessage(result.success ? t('onboarding.purchaseRestored') : result.error);
  };

  const openLegalLink = (url: string) => {
    Linking.openURL(url).catch(() => setMessage(t('onboarding.linkOpenError')));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingHorizontal: 24, paddingTop: 8 }]}>
      <ScrollView
        style={{ flex: 1, marginHorizontal: -24 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 6, paddingBottom: 22, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '900', textAlign: 'center' }}>
          {t('onboarding.threeDaysFree')}
        </Text>
        <Text style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '900', textAlign: 'center', marginTop: 12 }}>
          {t('onboarding.thenMonthly')}
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 14, lineHeight: 21, fontWeight: FONT.bold, textAlign: 'center', marginTop: 5, maxWidth: 300 }}>
          {t('onboarding.billedAfterTrial', { price: annualPrice })}
        </Text>

        <View style={{ width: '100%', maxWidth: 330, borderRadius: 24, borderWidth: 2, borderColor: colors.hairline2, backgroundColor: colors.surface, paddingVertical: 24, paddingHorizontal: 20, marginTop: 42, alignItems: 'center' }}>
          <Text style={{ color: colors.accSolid, fontSize: 34, lineHeight: 40, fontWeight: '900' }}>{t('onboarding.monthlyTimeSaved')}</Text>
          <Text style={{ color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900', textAlign: 'center', marginTop: 4 }}>
            {t('onboarding.timeSavedBody')}
          </Text>
          <View style={{ height: 1, backgroundColor: colors.hairline2, alignSelf: 'stretch', marginVertical: 18 }} />
          <Text style={{ color: colors.textDim, fontSize: 14, lineHeight: 20, fontWeight: FONT.bold, textAlign: 'center' }}>
            {t('onboarding.alarmMissionStreak')}
          </Text>
        </View>

        {showPlans && (
          <View style={{ width: '100%', gap: 10, marginTop: 18 }}>
            {[
              { id: 'annual' as const, title: t('onboarding.annual'), subtitle: t('onboarding.annualPlanSubtitle', { price: annualPrice }), badge: t('onboarding.best') },
              { id: 'monthly' as const, title: t('onboarding.monthly'), subtitle: t('onboarding.monthlyPlanSubtitle', { price: monthlyPrice }), badge: null },
            ].map(item => {
              const selected = plan === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.84}
                  onPress={() => setPlan(item.id)}
                  style={{
                    minHeight: 58,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: selected ? colors.accSolid : colors.hairline2,
                    backgroundColor: selected ? 'rgba(229,57,53,0.06)' : colors.surface,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 9,
                  }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? colors.accSolid : colors.hairline2, alignItems: 'center', justifyContent: 'center' }}>
                    {selected && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accSolid }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ color: colors.textDim, fontSize: 12, lineHeight: 16, fontWeight: FONT.bold, marginTop: 1 }} numberOfLines={2}>{item.subtitle}</Text>
                  </View>
                  {item.badge && (
                    <View style={{ backgroundColor: colors.accSolid, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon name="check" size={24} color={colors.text} variant="outline" stroke={3} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{t('onboarding.noPayment')}</Text>
        </View>
        <SquishyButton color="#050505" shadowColor="rgba(0,0,0,0.18)" shadowDepth={5} onPress={handlePay} contentStyle={{ paddingVertical: 14, minWidth: '100%' }}>
          {busy || subscriptionLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.btnText, { color: '#FFFFFF', fontSize: 17 }]}> 
              {isAnnual ? t('onboarding.startFreeTrial') : t('onboarding.continue')}
            </Text>
          )}
        </SquishyButton>
        {!!(message || subscriptionError) && (
          <Text style={{ color: colors.accSolid, fontSize: 12, lineHeight: 17, fontWeight: FONT.bold, textAlign: 'center', marginTop: 8, maxWidth: 310 }}>
            {message || subscriptionError}
          </Text>
        )}
        <TouchableOpacity onPress={() => setShowPlans(prev => !prev)} activeOpacity={0.72} style={{ paddingVertical: 13 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', textDecorationLine: 'underline' }}>
            {showPlans ? t('onboarding.hidePlans') : t('onboarding.seePlans')}
          </Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <TouchableOpacity onPress={handleRestore} activeOpacity={0.72} disabled={busy}>
            <Text style={{ color: legalTextColor, fontSize: 12, fontWeight: FONT.bold, textDecorationLine: 'underline' }}>{t('settingsScreen.restorePurchase')}</Text>
          </TouchableOpacity>
          <Text style={{ color: legalTextColor, fontSize: 12 }}>•</Text>
          <TouchableOpacity onPress={() => openLegalLink(LEGAL_LINKS.privacy)} activeOpacity={0.72}>
            <Text style={{ color: legalTextColor, fontSize: 12, fontWeight: FONT.bold, textDecorationLine: 'underline' }}>{t('settingsScreen.privacy')}</Text>
          </TouchableOpacity>
          <Text style={{ color: legalTextColor, fontSize: 12 }}>•</Text>
          <TouchableOpacity onPress={() => openLegalLink(LEGAL_LINKS.terms)} activeOpacity={0.72}>
            <Text style={{ color: legalTextColor, fontSize: 12, fontWeight: FONT.bold, textDecorationLine: 'underline' }}>{t('settingsScreen.terms')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const ONBOARDING_STEPS = [
  Step1_Loading, Step2_Value, Step3_Thought, Step4_BedReason, Step5_UsualTime,
  Step6_SnoozeFreq, Step7_AlarmCount, Step8_Biology, Step9_Chart, Step10_OneAlarm, Step11_Temple,
  Step12_PhysicalAction, Step13_WakeFeeling, Step14_MissionMode, Step15_MissionConfig, Step16_AwakeTime,
  Step17_TargetTime, Step18_ProtectedDays, Step18b_GoalSummary, Step19_SoundSettings, Step20_ThePact,
  Step29_Processing, Step28b_MorningPlan, Step30_TrialIntro, Step31_TrialReminder, Step32_FinalPaywall
];

export const PAYWALL_START_STEP = ONBOARDING_STEPS.findIndex(Component => Component.name === 'Step30_TrialIntro');

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, justifyContent: 'space-between' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rooPlaceholder: { justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: '#ccc' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  optionBtn: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, borderWidth: 2, alignItems: 'center', marginHorizontal: 8 },
  optionText: { fontSize: 16, fontWeight: '700' },
  btnText: { fontSize: 18, fontWeight: '800', color: '#000' },
  
  characterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 0,
  },
  speechBubbleContainer: {
    flex: 1,
    position: 'relative',
    marginLeft: 2,
    minHeight: 76,
    justifyContent: 'center',
  },
  speechBubble: {
    borderWidth: 2.5,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  speechBubbleText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 23,
    textAlign: 'left',
  },
  speechBubblePointer: {
    position: 'absolute',
    left: -9,
    top: 26,
    width: 18,
    height: 18,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    zIndex: 1,
  },
  speechBubbleTail: {
    position: 'absolute',
    left: -23,
    top: 19,
    zIndex: 4,
  },
  speechBubbleTailMask: {
    position: 'absolute',
    left: -1,
    top: 20,
    width: 7,
    height: 28,
    zIndex: 5,
  },
  speechBubbleTriangle: {
    position: 'absolute',
    left: -12,
    top: 24,
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderTopColor: 'transparent',
    borderBottomWidth: 10,
    borderBottomColor: 'transparent',
    borderRightWidth: 12,
  },
  speechBubbleTriangleInner: {
    position: 'absolute',
    left: -8,
    top: 26,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: 'transparent',
    borderBottomWidth: 8,
    borderBottomColor: 'transparent',
    borderRightWidth: 10,
  }
});
