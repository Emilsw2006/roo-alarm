import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Switch, TextInput, Image, Platform, ScrollView, Easing, ActivityIndicator, Linking, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColors } from '../../constants/ThemeContext';
import { FONT, FONT_FAMILY, SIZES } from '../../constants/theme';
import { useOnboarding } from '../../constants/OnboardingContext';
import SquishyButton from '../../components/SquishyButton';
import Icon from '../../components/Icon';
import CustomTimePicker from '../../components/CustomTimePicker';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Text as SvgText } from 'react-native-svg';
import { DEFAULT_ENABLED_MISSIONS, DEFAULT_PERSONALIZED_MISSION, MISSION_LIST, getMission } from '../../constants/missions';
import MissionGlyph from '../../components/MissionGlyph';
import * as Haptics from 'expo-haptics';
import SignaturePad from '../../components/SignaturePad';
import ParticleExplosion from '../../components/ParticleExplosion';
import { applyOnboardingSetup } from '../../lib/persistOnboarding';
import { requestAuthNavigationRefresh } from '../../lib/authNavigationRefresh';
import { hasUserProfileName } from '../../lib/onboardingStatus';
import { supabase } from '../../lib/supabase';
import { ROO_ASSETS } from '../../constants/RooAssets';
import { useAuth } from '../../constants/AuthContext';
import { useSubscription } from '../../constants/SubscriptionContext';
import { LEGAL_LINKS } from '../../constants/LegalLinks';
import { AppleIcon, GoogleIcon } from '../../components/BrandIcons';
import { useLanguage } from '../../constants/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatGoalWakeTime, getMonthlyHoursSaved } from '../../lib/onboardingGoalSummary';
import { isAnnualTrialPurchase, resolveAnnualPlanSubtitle, resolveAnnualPriceString } from '../../lib/subscriptionPricing';
import { PurchasesPackage } from 'react-native-purchases';

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
  const { colors } = useColors();
  const [ready, setReady] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setReady(false);
    progressAnim.setValue(0);
    const fillAnim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: delayMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    fillAnim.start();
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => {
      fillAnim.stop();
      clearTimeout(timer);
    };
  }, [delayMs, progressAnim]);

  const handlePressIn = () => {
    if (!ready) return;
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 10 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 12 }).start();
  };

  const handlePress = () => {
    if (!ready) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const fillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const translateY = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, ready ? 6 : 4] });
  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });
  const borderRadius = SIZES.rXl;

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} style={{ alignSelf: 'stretch' }}>
      <Animated.View
        style={[
          {
            overflow: 'hidden',
            backgroundColor: ready ? color : colors.surface2,
            borderRadius,
            borderBottomWidth: ready ? 6 : 4,
            borderBottomColor: ready ? shadowColor : colors.hairline2,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderTopWidth: 1,
            borderColor: ready ? shadowColor : colors.hairline2,
            transform: [{ scale }, { translateY }],
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          },
          contentStyle,
        ]}
      >
        {!ready ? (
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: fillWidth,
              backgroundColor: color,
            }}
          />
        ) : null}
        <Text style={[styles.btnText, { color: ready ? textColor : colors.textFaint, zIndex: 1 }]}>
          {label || t('onboarding.continue')}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

const READING_TITLE_FONT_SIZE = 30;
const READING_TITLE_LINE_HEIGHT = 38;
const READING_BODY_FONT_SIZE = 19;
const READING_BODY_LINE_HEIGHT = 28;
const READING_CHAR_DELAY_MS = 34;
const READING_END_HOLD_MS = 900;

function ReadingPhraseScreen({
  icon,
  title,
  body,
  onNext,
  buttonColor,
  buttonTextColor,
  buttonShadowColor,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onNext: () => void;
  buttonColor: string;
  buttonTextColor: string;
  buttonShadowColor: string;
}) {
  const { colors } = useColors();
  const fullText = title + body;
  const totalLength = fullText.length;
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!totalLength) return;

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setVisibleCount(current);
      const char = fullText[current - 1];
      if (char === ' ' || char === '.' || char === ',') {
        Haptics.selectionAsync();
      }
      if (current >= totalLength) clearInterval(interval);
    }, READING_CHAR_DELAY_MS);

    return () => clearInterval(interval);
  }, [totalLength, fullText]);

  const titleVisible = title.slice(0, Math.min(visibleCount, title.length));
  const bodyVisible = body.slice(0, Math.max(0, visibleCount - title.length));

  const titleStyle = {
    fontSize: READING_TITLE_FONT_SIZE,
    lineHeight: READING_TITLE_LINE_HEIGHT,
    color: colors.text,
    textAlign: 'center' as const,
    fontFamily: FONT_FAMILY.extraBold,
    fontWeight: FONT.bold,
    letterSpacing: -0.4,
  };

  const bodyStyle = {
    fontSize: READING_BODY_FONT_SIZE,
    lineHeight: READING_BODY_LINE_HEIGHT,
    color: colors.textDim,
    textAlign: 'center' as const,
    fontFamily: FONT_FAMILY.medium,
    fontWeight: FONT.medium,
    paddingHorizontal: 8,
  };

  return (
    <View style={styles.container}>
      <View style={styles.readingPhraseBody}>
        <View style={styles.readingPhraseIcon}>{icon}</View>

        {/* Reserva el espacio del título completo para evitar saltos */}
        <View style={{ width: '100%' }}>
          <Text style={[titleStyle, { opacity: 0 }]}>{title}</Text>
          <Text style={[titleStyle, { position: 'absolute', left: 0, right: 0, top: 0 }]}>
            {titleVisible}
          </Text>
        </View>

        <View style={{ width: '100%', marginTop: 18 }}>
          <Text style={[bodyStyle, { opacity: 0 }]}>{body}</Text>
          <Text style={[bodyStyle, { position: 'absolute', left: 0, right: 0, top: 0 }]}>
            {bodyVisible}
          </Text>
        </View>
      </View>

      <DelayedContinueButton
        color={buttonColor}
        textColor={buttonTextColor}
        shadowColor={buttonShadowColor}
        onPress={onNext}
        delayMs={totalLength * READING_CHAR_DELAY_MS + READING_END_HOLD_MS}
        contentStyle={{ paddingVertical: 14 }}
      />
    </View>
  );
}

function paywallAccent(colors: ReturnType<typeof useColors>['colors']) {
  return colors.brandOrange || colors.accSolid;
}

function paywallButtonShadow(colors: ReturnType<typeof useColors>['colors']) {
  return colors.accGlow || colors.hairline2;
}

function PaywallTrialTimeline({
  colors,
  t,
}: {
  colors: ReturnType<typeof useColors>['colors'];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const accent = paywallAccent(colors);
  const steps = [
    {
      icon: 'lock' as const,
      title: t('onboarding.timelineToday'),
      body: t('onboarding.todayUnlock'),
    },
    {
      icon: 'bell' as const,
      title: t('onboarding.timelineIn2Days'),
      body: t('onboarding.timelineIn2DaysBody'),
    },
  ];

  return (
    <View style={{ width: '100%', maxWidth: 320, alignSelf: 'center', paddingHorizontal: 4 }}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <View key={step.title} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ alignItems: 'center', width: 44, marginRight: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={step.icon} size={19} color={colors.surface3} variant="solid" />
              </View>
              {!isLast ? (
                <View
                  style={{
                    width: 5,
                    flex: 1,
                    minHeight: 54,
                    backgroundColor: accent,
                    opacity: 0.28,
                    borderRadius: 3,
                    marginTop: 6,
                    marginBottom: 2,
                  }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1, paddingTop: 8, paddingBottom: isLast ? 6 : 24, paddingRight: 4 }}>
              <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.text, textAlign: 'left' }}>{step.title}</Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textDim, marginTop: 4, fontWeight: '500', textAlign: 'left' }}>{step.body}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PaywallLegalRow({
  colors,
  busy,
  onRestore,
  onPrivacy,
  onTerms,
  restoreLabel,
  privacyLabel,
  termsLabel,
}: {
  colors: ReturnType<typeof useColors>['colors'];
  busy: boolean;
  onRestore: () => void;
  onPrivacy: () => void;
  onTerms: () => void;
  restoreLabel: string;
  privacyLabel: string;
  termsLabel: string;
}) {
  const linkStyle = { fontSize: 10, lineHeight: 13, fontWeight: '600' as const, color: colors.textDim, textDecorationLine: 'underline' as const };
  const dotStyle = { fontSize: 10, lineHeight: 13, color: colors.textFaint };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 8, flexWrap: 'wrap', alignSelf: 'center' }}>
      <TouchableOpacity onPress={onRestore} activeOpacity={0.72} disabled={busy}>
        <Text style={linkStyle}>{restoreLabel}</Text>
      </TouchableOpacity>
      <Text style={dotStyle}>·</Text>
      <TouchableOpacity onPress={onPrivacy} activeOpacity={0.72}>
        <Text style={linkStyle}>{privacyLabel}</Text>
      </TouchableOpacity>
      <Text style={dotStyle}>·</Text>
      <TouchableOpacity onPress={onTerms} activeOpacity={0.72}>
        <Text style={linkStyle}>{termsLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PaywallLegalFooter({
  colors,
  onSignIn,
}: {
  colors: ReturnType<typeof useColors>['colors'];
  onSignIn?: () => void;
}) {
  const { t } = useLanguage();
  const { session } = useAuth();
  const { restorePurchases } = useSubscription();
  const [busy, setBusy] = useState(false);

  const openLegalLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!session) {
      onSignIn?.();
      return;
    }
    setBusy(true);
    await restorePurchases();
    setBusy(false);
  };

  return (
    <PaywallLegalRow
      colors={colors}
      busy={busy}
      onRestore={handleRestore}
      onPrivacy={() => openLegalLink(LEGAL_LINKS.privacy)}
      onTerms={() => openLegalLink(LEGAL_LINKS.terms)}
      restoreLabel={t('onboarding.restoreShort')}
      privacyLabel={t('onboarding.privacyShort')}
      termsLabel={t('onboarding.termsShort')}
    />
  );
}

function PaywallBottomPanel({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>['colors'];
}) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);

  return (
    <View
      style={{
        flexShrink: 0,
        alignSelf: 'stretch',
        marginHorizontal: -24,
        marginBottom: -bottomInset,
        borderTopWidth: 2,
        borderTopColor: colors.hairline2,
        backgroundColor: colors.surface,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: bottomInset + 18,
        alignItems: 'center',
      }}
    >
      <View style={{ width: '100%', maxWidth: 360, alignItems: 'center' }}>
        {children}
      </View>
    </View>
  );
}

function PaywallScreenContainer({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>['colors'];
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.paywallScreen,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      {children}
    </View>
  );
}

function PaywallTitleTwoLines({
  line1,
  line2,
  colors,
}: {
  line1: string;
  line2: string;
  colors: ReturnType<typeof useColors>['colors'];
}) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4, paddingHorizontal: 8 }}>
      <Text style={{ color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '600', textAlign: 'center' }}>
        {line1}
      </Text>
      <Text style={{ color: colors.accSolid, fontSize: 28, lineHeight: 34, fontWeight: '700', textAlign: 'center', marginTop: 2 }}>
        {line2}
      </Text>
    </View>
  );
}

function AnimatedTrialBell({ colors }: { colors: ReturnType<typeof useColors>['colors'] }) {
  const bellRotate = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const swing = Animated.loop(
      Animated.sequence([
        Animated.timing(bellRotate, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: -1, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: 0.6, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: -0.4, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: 0, duration: 120, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(1800),
      ])
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(badgeScale, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(badgeScale, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    );

    swing.start();
    pulse.start();
    return () => {
      swing.stop();
      pulse.stop();
    };
  }, [badgeScale, bellRotate]);

  const rotate = bellRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-14deg', '0deg', '14deg'],
  });

  return (
    <View style={{ width: 156, height: 156, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={146} height={146} viewBox="0 0 146 146">
          <Path d="M73 23 C53 23 39 39 39 61 L39 82 C39 89 34 95 28 99 L28 108 L118 108 L118 99 C112 95 107 89 107 82 L107 61 C107 39 93 23 73 23 Z" fill={colors.surface2} />
          <Path d="M60 115 C62 123 67 128 73 128 C79 128 84 123 86 115 Z" fill={colors.surface2} />
          <Path d="M64 22 C64 15 69 11 73 11 C77 11 82 15 82 22" fill={colors.surface2} />
        </Svg>
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          top: 22,
          right: 8,
          width: 66,
          height: 66,
          borderRadius: 33,
          backgroundColor: colors.accSolid,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: badgeScale }],
        }}
      >
        <Text style={{ color: colors.surface3, fontSize: 38, lineHeight: 44, fontWeight: '700' }}>1</Text>
      </Animated.View>
    </View>
  );
}

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
  useEffect(() => {
    const timer = setTimeout(onNext, 3000);
    return () => clearTimeout(timer);
  }, [onNext]);

  return (
    <View style={styles.centerContainer}>
      <Image
        source={require('../../assets/logo.jpeg')}
        style={{ width: 132, height: 132, borderRadius: 30 }}
        resizeMode="cover"
      />
    </View>
  );
};

// Pantalla 2: Valor
export const Step2_Value = ({ onNext, onSignIn }: { onNext: () => void; onSignIn?: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  const line1 = useRef(new Animated.Value(0)).current;
  const line2 = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(300, [
      Animated.timing(line1, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(line2, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, paddingTop: 64 }}>
        {/* Logo */}
        <Animated.Image
          source={require('../../assets/logo.jpeg')}
          style={[getLineStyle(line1), { width: 104, height: 104, borderRadius: 26, marginBottom: 30 }]}
          resizeMode="cover"
        />

        {/* Headline */}
        <Animated.Text style={[getLineStyle(line1), { fontSize: 44, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -1 }]}>
          {t('onboarding.heroTitle')}
        </Animated.Text>

        {/* Subhead */}
        <Animated.Text style={[getLineStyle(line2), { fontSize: 20, fontWeight: '500', color: colors.textDim, textAlign: 'center', marginTop: 16, lineHeight: 30 }]}>
          {t('onboarding.heroSubtitle')}
        </Animated.Text>
      </View>

      <Animated.View style={{ transform: [{ scale: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }], opacity: btnAnim }}>
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

        {onSignIn ? (
          <TouchableOpacity onPress={onSignIn} activeOpacity={0.7} style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 4 }}>
            <Text style={{ color: colors.textDim, fontSize: 15, fontWeight: FONT.bold }}>{t('onboarding.haveAccount')}</Text>
          </TouchableOpacity>
        ) : null}
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
      onNext={() => { updateData({ wakeUpThought: selected ?? undefined }); onNext(); }}
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
      onNext={() => { updateData({ stayInBedReason: selected ?? undefined }); onNext(); }}
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
      onNext={() => { updateData({ snoozeHabit: selected ?? undefined }); onNext(); }}
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
      onNext={() => { updateData({ alarmCount: selected ?? undefined }); onNext(); }}
    />
  );
};

// Pantalla 8: Biología
export const Step8_Biology = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <ReadingPhraseScreen
      icon={<Text style={{ fontSize: 68, lineHeight: 76 }}>🧠</Text>}
      title={t('onboarding.biologyTitle')}
      body={t('onboarding.biologyBody')}
      onNext={onNext}
      buttonColor={colors.text}
      buttonTextColor={colors.bg}
      buttonShadowColor="rgba(0,0,0,0.3)"
    />
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
  
  const DOT = 28;
  const DOT_R = DOT / 2;
  const ROW_GAP = 36;
  const BADGE_GAP = 26;
  const LABEL_W = 78;
  const TRACK_W = DOT + 10 + LABEL_W;
  const TIMELINE_ROW_STEP = DOT + ROW_GAP;
  const TYPICAL_LINE_H = TIMELINE_ROW_STEP * 3 + DOT_R;
  const ROO_LINE_H = TIMELINE_ROW_STEP * 2 + DOT + BADGE_GAP;

  const renderTimelineRow = (
    icon: React.ReactNode,
    time: string,
    label: string,
    animStart: number,
    animEnd: number,
    muted = false,
  ) => (
    <Animated.View style={[styles.chartTrackRow, getAnimStyle(animStart, animEnd)]}>
      <View style={styles.chartDotCol}>{icon}</View>
      <View style={styles.chartLabelCol}>
        <Text style={{ fontWeight: '800', color: muted ? colors.textDim : colors.text, fontSize: 14 }}>{time}</Text>
        <Text style={{ fontSize: 11, color: colors.textDim }}>{label}</Text>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, styles.chartScreen]}>
      <Text style={[styles.title, styles.chartTitle, { color: colors.text }]}>
        {t('onboarding.chartOneMission')}
      </Text>

      <View style={styles.chartBody}>
        <View style={styles.chartCompareWrap}>
          <Animated.View style={[styles.chartHeadersRow, getAnimStyle(0, 0.2)]}>
            <Text style={[styles.chartHeaderLabel, { color: colors.textDim }]}>{t('onboarding.typicalMorning')}</Text>
            <Text style={[styles.chartHeaderLabel, { color: '#34C759' }]}>{t('onboarding.rooMorning')}</Text>
          </Animated.View>

          <View style={styles.chartColumnsRow}>
            {/* Columna Izquierda: Mañana Típica */}
            <View style={styles.chartColumn}>
              <View style={[styles.chartTrack, { width: TRACK_W }]}>
                <View style={[styles.chartZigzagLine, { height: TYPICAL_LINE_H }]}>
                  <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 32 100">
                    <Path
                      d="M16,0 L27,6 L4,11 L22,18 L8,23 L30,31 L3,37 L19,43 L9,50 L28,57 L6,63 L25,70 L12,75 L30,83 L5,89 L18,94 L16,100"
                      fill="none"
                      stroke="#FF3B30"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M16,0 L27,6 L4,11 L22,18 L8,23"
                      fill="none"
                      stroke="#FFA000"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>

                {renderTimelineRow(
                  <View style={[styles.chartDot, { backgroundColor: colors.surface, borderColor: '#FFA000' }]}>
                    <Icon name="bell" size={14} color="#FFA000" variant="solid" />
                  </View>,
                  '07:00',
                  t('alarmFlow.alarm'),
                  0.2,
                  0.4,
                )}
                {renderTimelineRow(
                  <View style={[styles.chartDot, { backgroundColor: colors.surface, borderColor: '#FF3B30' }]}>
                    <View style={{ transform: [{ rotate: '-14deg' }, { translateX: -1 }] }}>
                      <Text style={{ fontWeight: '900', color: '#FF3B30', fontSize: 10, letterSpacing: -0.5 }}>Zz</Text>
                    </View>
                  </View>,
                  '07:09',
                  t('onboarding.snoozeLabel'),
                  0.4,
                  0.6,
                )}
                {renderTimelineRow(
                  <View style={[styles.chartDot, { backgroundColor: colors.surface, borderColor: '#FF3B30' }]}>
                    <View style={{ transform: [{ rotate: '11deg' }, { translateX: 2 }, { translateY: 1 }] }}>
                      <Text style={{ fontWeight: '900', color: '#FF3B30', fontSize: 12, letterSpacing: 1 }}>zZ</Text>
                    </View>
                  </View>,
                  '07:18',
                  t('onboarding.snoozeLabel'),
                  0.6,
                  0.8,
                )}
                <Animated.View style={[styles.chartTrackRow, { marginBottom: 0 }, getAnimStyle(0.8, 1.0)]}>
                  <View style={styles.chartDotCol}>
                    <View style={[styles.chartDot, { backgroundColor: colors.surface, borderColor: '#FF3B30' }]}>
                      <Icon name="info" size={16} color="#FF3B30" variant="solid" />
                    </View>
                  </View>
                  <View style={styles.chartLabelCol}>
                    <Text style={{ fontWeight: '800', color: colors.textDim, fontSize: 14 }}>07:27</Text>
                    <Text style={{ fontSize: 11, color: colors.textDim }}>{t('onboarding.panicLabel')}</Text>
                  </View>
                </Animated.View>
                <View style={[styles.chartLeftSpacer, { height: BADGE_GAP - 6 }]} />
              </View>
            </View>

            {/* Columna Derecha: Mañana con Roo */}
            <View style={styles.chartColumn}>
              <View style={[styles.chartTrack, { width: TRACK_W }]}>
                <Animated.View style={[styles.chartRooLine, { height: ROO_LINE_H + 12 }, getAnimStyle(0.2, 0.85)]} />

                {renderTimelineRow(
                  <View style={[styles.chartDot, { backgroundColor: colors.surface, borderColor: '#34C759' }]}>
                    <Icon name="bell" size={14} color="#34C759" variant="solid" />
                  </View>,
                  '07:00',
                  t('alarmFlow.alarm'),
                  0.2,
                  0.4,
                )}
                {renderTimelineRow(
                  <View style={[styles.chartDot, { backgroundColor: '#34C759', borderWidth: 0 }]}>
                    <Icon name="check" size={16} color="#FFF" />
                  </View>,
                  '07:01',
                  t('mission'),
                  0.4,
                  0.6,
                )}
                <Animated.View style={[styles.chartTrackRow, { marginBottom: BADGE_GAP }, getAnimStyle(0.6, 0.8)]}>
                  <View style={styles.chartDotCol}>
                    <View style={[styles.chartDot, { backgroundColor: colors.surface, borderColor: '#34C759' }]}>
                      <Icon name="star" size={14} color="#34C759" />
                    </View>
                  </View>
                  <View style={styles.chartLabelCol}>
                    <Text style={{ fontWeight: '800', color: colors.text, fontSize: 14 }}>07:02</Text>
                    <Text style={{ fontSize: 11, color: colors.textDim }}>{t('onboarding.fullEnergy')}</Text>
                  </View>
                </Animated.View>

                <Animated.View style={[styles.chartBadgeSection, getScaleStyle(0.8, 1.0)]}>
                  <View style={styles.chartBadgeSpine}>
                    <View style={styles.chartBadge}>
                      <View style={styles.chartBadgeTopRow}>
                        <Text style={styles.chartBadgeNumber}>25</Text>
                        <Text style={styles.chartBadgeMin}>MIN</Text>
                      </View>
                      <Text style={styles.chartBadgeLabel}>{t('onboarding.minutesGained')}</Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.chartFooter}>
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
      onNext={() => { updateData({ singleAlarmConfidence: selected ?? undefined }); onNext(); }}
    />
  );
};

// Pantalla 11: Camino al Templo (21 Days Evolution Path)
export const Step11_Temple = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();
  const [phase, setPhase] = useState<1 | 2>(1);
  const [charsVisible, setCharsVisible] = useState(0);
  const [phasesRevealed, setPhasesRevealed] = useState(false);

  const typewriterText =
    phase === 1 ? t('onboarding.habitIntroText') : t('onboarding.phasesTitle');

  const enterAnim = useRef(new Animated.Value(0)).current;
  const [showContinue, setShowContinue] = useState(false);

  useEffect(() => {
    setCharsVisible(0);
    setShowContinue(false);
    if (phase === 2) {
      setPhasesRevealed(false);
      enterAnim.setValue(0);
    }

    let currentChar = 0;
    const CHAR_DELAY_MS = 72;
    const interval = setInterval(() => {
      currentChar++;
      setCharsVisible(currentChar);
      const char = typewriterText[currentChar - 1];
      if (char === ' ' || char === '.' || char === ',') {
        Haptics.selectionAsync();
      }
      if (currentChar >= typewriterText.length) {
        clearInterval(interval);
        setTimeout(() => {
          if (phase === 1) {
            setPhase(2);
          } else {
            setPhasesRevealed(true);
            Animated.timing(enterAnim, {
              toValue: 1,
              duration: 3000,
              useNativeDriver: true,
            }).start(() => {
              setShowContinue(true);
            });
          }
        }, 1200);
      }
    }, CHAR_DELAY_MS);

    return () => clearInterval(interval);
  }, [phase, typewriterText]);

  const TIERS = [
    { id: 'tier1', name: 'DORMILÓN', days: 0, color: '#CD7F32', image: ROO_ASSETS.level1.base },
    { id: 'tier2', name: 'DESPIERTO', days: 4, color: '#A9A9A9', image: ROO_ASSETS.level2.base },
    { id: 'tier3', name: 'ACTIVO', days: 8, color: '#FFD700', image: ROO_ASSETS.level3.base },
    { id: 'tier4', name: 'PRO', days: 13, color: '#50c8ff', image: ROO_ASSETS.level4.base },
    { id: 'tier5', name: 'LEYENDA', days: 18, color: '#FF3B30', image: ROO_ASSETS.level5.base },
    { id: 'endgame', name: 'SALÓN FAMA', days: 21, color: '#000000', image: ROO_ASSETS.level6.base },
  ];

  const displayedText = typewriterText.slice(0, charsVisible);

  if (phase === 1) {
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
        <SpeechBubble text={displayedText} />
      </View>

      {phasesRevealed && (
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
      )}

      <View style={styles.templeFooter}>
        {phasesRevealed ? (
          <Text style={[styles.habitFooterNote, { color: colors.textDim }]}>
            {t('onboarding.habitCreatedIn21Days')}
          </Text>
        ) : null}
        {showContinue ? (
          <SquishyButton color={colors.accSolid} shadowColor="#C62828" onPress={onNext} contentStyle={{ paddingVertical: 14 }}>
            <Text style={[styles.btnText, { color: '#FFF' }]}>{t('onboarding.continue')}</Text>
          </SquishyButton>
        ) : (
          <View style={{ height: 58 }} />
        )}
      </View>
    </View>
  );
};

// Pantalla 12: Acción física
export const Step12_PhysicalAction = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <ReadingPhraseScreen
      icon={<Icon name="bolt" size={72} color={colors.accSolid} variant="solid" />}
      title={t('onboarding.physicalActionTitle')}
      body={t('onboarding.physicalActionBody')}
      onNext={onNext}
      buttonColor={colors.text}
      buttonTextColor={colors.bg}
      buttonShadowColor="rgba(0,0,0,0.3)"
    />
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
      onNext={() => { updateData({ wakeUpFeeling: selected ?? undefined }); onNext(); }}
    />
  );
};

// Pantalla 14: Modo de misión
export const Step14_MissionMode = ({ onNext }: { onNext: () => void }) => {
  const { updateData } = useOnboarding();
  const { t, ta } = useLanguage();
  const options = ta('onboarding.missionModeOptions');
  const rouletteLabel = options[1] || 'Roo Roulette';
  const [selected, setSelected] = useState<string | null>(rouletteLabel);

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
  const [selected, setSelected] = useState<string[]>(() => {
    if (data.selectedMissions?.length) return data.selectedMissions;
    return isRoulette ? DEFAULT_ENABLED_MISSIONS : [DEFAULT_PERSONALIZED_MISSION];
  });

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
      onNext={() => { updateData({ wakeUpDuration: selected ?? undefined }); onNext(); }}
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
  const { t } = useLanguage();
  const targetTime = data.targetWakeTime || new Date(new Date().setHours(7, 0, 0, 0));
  const daysCount = data.protectedDays?.length || 5;
  const { clock, period } = formatGoalWakeTime(targetTime);
  const monthlyHours = getMonthlyHoursSaved({
    protectedDaysPerWeek: daysCount,
    wakeUpDuration: data.wakeUpDuration,
    snoozeHabit: data.snoozeHabit,
  });
  const accent = colors.accSolid;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingHorizontal: 28 }]}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 14 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 20,
            lineHeight: 26,
            fontWeight: '800',
            textAlign: 'center',
            maxWidth: 320,
            marginBottom: 18,
          }}
        >
          {t('onboarding.goalSummaryLead')}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
          <Text
            style={{
              color: accent,
              fontSize: 58,
              lineHeight: 62,
              fontFamily: FONT_FAMILY.extraBold,
              fontWeight: '900',
              letterSpacing: -1,
            }}
          >
            {clock}
          </Text>
          <Text
            style={{
              color: accent,
              fontSize: 28,
              lineHeight: 32,
              fontFamily: FONT_FAMILY.extraBold,
              fontWeight: '900',
              marginLeft: 6,
              marginBottom: 4,
            }}
          >
            {period}
          </Text>
        </View>

        <View style={{ marginTop: 34, alignItems: 'center', gap: 14 }}>
          <Text
            style={{
              color: accent,
              fontSize: 19,
              lineHeight: 24,
              fontWeight: '900',
              textAlign: 'center',
            }}
          >
            {t('onboarding.goalSummaryDays', { count: daysCount })}
          </Text>
          <Text
            style={{
              color: accent,
              fontSize: 30,
              lineHeight: 36,
              fontFamily: FONT_FAMILY.extraBold,
              fontWeight: '900',
              textAlign: 'center',
              letterSpacing: -0.5,
            }}
          >
            {t('onboarding.goalSummaryHours', { hours: monthlyHours })}
          </Text>
        </View>

        <Text
          style={{
            marginTop: 38,
            color: colors.textDim,
            fontSize: 16,
            lineHeight: 24,
            fontWeight: FONT.semiBold,
            textAlign: 'center',
            maxWidth: 255,
          }}
        >
          {t('onboarding.goalSummaryFooter')}
        </Text>
      </View>

      <DelayedContinueButton color={colors.accSolid} textColor="#FFFFFF" shadowColor="#C62828" onPress={onNext} contentStyle={{ paddingVertical: 14 }} />
    </View>
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
export const Step27_Auth = ({ onNext, onSignUp }: { onNext: () => void; onSignUp?: () => void }) => {
  const { session, signInWithApple, signInWithGoogle } = useAuth();
  const { colors } = useColors();
  const { data } = useOnboarding();
  const { t } = useLanguage();
  const [showEmail, setShowEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const emailAnim = useRef(new Animated.Value(0)).current;
  const skippedForSession = useRef(false);

  useEffect(() => {
    if (!session?.user || skippedForSession.current) return;
    skippedForSession.current = true;
    void (async () => {
      if (data.targetWakeTime) {
        try {
          await applyOnboardingSetup(session.user.id, data, session.user);
        } catch (err) {
          console.log('Onboarding save after existing session failed', err);
        }
      }
      onNext();
    })();
  }, [session?.user?.id]);

  useEffect(() => {
    Animated.timing(emailAnim, {
      toValue: showEmail ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [showEmail]);

  if (session?.user) {
    return <View style={[styles.container, { backgroundColor: colors.bg }]} />;
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setOauthError(null);
    setBusy(true);
    const result = provider === 'google'
      ? await signInWithGoogle()
      : await signInWithApple();
    setBusy(false);
    if (result.error) {
      setOauthError(result.error);
      return;
    }
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user && data.targetWakeTime) {
      try {
        await applyOnboardingSetup(authData.user.id, data, authData.user);
      } catch (err) {
        console.log('Onboarding save after OAuth failed', err);
      }
    }
    onNext();
  };

  const emailHeight = emailAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 72] });
  const emailOpacity = emailAnim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] });
  const emailTranslate = emailAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[styles.title, { color: colors.text, marginBottom: 34, textAlign: 'left', fontSize: 39, lineHeight: 45 }]}>{t('auth.saveProgress')}</Text>

        <View style={{ width: '100%', gap: 12 }}>
          <TouchableOpacity
            style={{ height: 58, flexDirection: 'row', backgroundColor: colors.text, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 12, opacity: busy ? 0.7 : 1 }}
            onPress={() => handleOAuth('apple')}
            disabled={busy}
            activeOpacity={0.86}
          >
            <AppleIcon />
            <Text style={{ color: colors.bg, fontSize: 17, fontWeight: FONT.bold }} numberOfLines={1}>{t('auth.continueApple')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ height: 58, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1.5, borderColor: colors.border, opacity: busy ? 0.7 : 1 }}
            onPress={() => handleOAuth('google')}
            disabled={busy}
            activeOpacity={0.86}
          >
            <GoogleIcon />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: FONT.bold }} numberOfLines={1}>{t('auth.continueGoogle')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ height: 52, borderRadius: 16, backgroundColor: colors.accSolid + '15', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}
            onPress={() => setShowEmail(prev => !prev)}
            activeOpacity={0.75}
          >
            <Icon name="mail" size={18} color={colors.accSolid} variant="outline" />
            <Text style={{ color: colors.accSolid, fontSize: 16, fontWeight: FONT.bold }} numberOfLines={1}>{t('auth.continueEmail')}</Text>
            <Icon name={showEmail ? 'chevDown' : 'chevR'} size={17} color={colors.textDim} />
          </TouchableOpacity>

          <Animated.View style={{ height: emailHeight, opacity: emailOpacity, overflow: 'hidden', transform: [{ translateY: emailTranslate }] }}>
            <View style={{ gap: 10, paddingTop: 8 }}>
              <TouchableOpacity
                style={{ height: 54, borderRadius: 17, backgroundColor: colors.accSolid, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => (onSignUp ? onSignUp() : onNext())}
                activeOpacity={0.86}
              >
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: FONT.bold }}>{t('onboarding.createWithEmail')}</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: FONT.semiBold }}>
                {t('onboarding.emailNextStep')}
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>

      {oauthError ? (
        <Text style={{ color: colors.accSolid, fontSize: 13, textAlign: 'center', marginBottom: 8, fontWeight: FONT.semiBold }}>
          {oauthError}
        </Text>
      ) : null}
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
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      try {
        await applyOnboardingSetup(authData.user.id, { ...data, userName: name }, authData.user);
      } catch (err) {
        console.log('Onboarding save failed', err);
      }
    }
    onNext();
    requestAuthNavigationRefresh();
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
const BuildingPlanPhase = ({ colors }: { colors: ReturnType<typeof useColors>['colors'] }) => {
  const { t, ta } = useLanguage();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const [stepIndex, setStepIndex] = useState(0);
  const steps = ta('onboarding.buildingPlanSteps');

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    let current = 0;
    const interval = setInterval(() => {
      Animated.timing(textOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        current += 1;
        if (current >= steps.length) {
          clearInterval(interval);
          return;
        }
        setStepIndex(current);
        Animated.timing(textOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, 650);

    return () => clearInterval(interval);
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
      <Animated.View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          borderWidth: 5,
          borderColor: colors.surface2,
          borderTopColor: colors.accSolid,
          transform: [{ rotate: spin }],
          marginBottom: 30,
        }}
      />
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>
        {t('onboarding.buildingPlanTitle')}
      </Text>
      <Animated.Text style={{ color: colors.textDim, fontSize: 15, fontWeight: FONT.semiBold, textAlign: 'center', opacity: textOpacity }}>
        {steps[stepIndex]}
      </Animated.Text>
    </View>
  );
};

export const Step28b_MorningPlan = ({ onNext }: { onNext: () => void }) => {
  const { colors } = useColors();
  const { data } = useOnboarding();
  const { t, missionCopy } = useLanguage();
  const enterAnim = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<'building' | 'ready'>('building');

  useEffect(() => {
    const timeout = setTimeout(() => setPhase('ready'), 2800);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    enterAnim.setValue(0);
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [phase]);

  if (phase === 'building') {
    return (
      <View style={[styles.container, { paddingHorizontal: 28 }]}>
        <BuildingPlanPhase colors={colors} />
      </View>
    );
  }

  const targetTime = data.targetWakeTime || new Date(new Date().setHours(6, 30, 0, 0));
  const hours = targetTime.getHours().toString().padStart(2, '0');
  const minutes = targetTime.getMinutes().toString().padStart(2, '0');

  const missionIds = data.selectedMissions || ['make_bed'];
  const missionMode = data.missionType || 'roulette';
  const mainMission = getMission(missionIds[0]);
  const isRoulette = missionMode === 'roulette';
  const activeDays = data.protectedDays || [0, 1, 2, 3, 4];
  const daysLabel = activeDays.length === 7 ? t('onboarding.allDays') : t('onboarding.daysPerWeek', { count: activeDays.length });

  const rows = [
    { icon: 'bell', label: t('alarmFlow.alarm'), value: hours + ':' + minutes },
    { icon: isRoulette ? 'repeat' : 'check', label: t('mission'), value: isRoulette ? t('onboarding.rouletteShort') : missionCopy(mainMission.id).label },
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
export const Step30_TrialIntro = ({
  onNext,
  onSignIn,
  onSignOutSession,
}: {
  onNext: () => void;
  onSignIn?: () => void;
  onSignOutSession?: () => void;
}) => {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <PaywallScreenContainer colors={colors}>
      <View style={{ flexShrink: 0 }}>
        <PaywallTitleTwoLines
          line1={t('onboarding.tryRooFreeLine1')}
          line2={t('onboarding.tryRooFreeLine2')}
          colors={colors}
        />
      </View>

      <View style={{ flex: 1, minHeight: 0 }} />

      <PaywallBottomPanel colors={colors}>
        <View style={{ width: '100%', alignItems: 'center', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Icon name="check" size={22} color={colors.text} variant="outline" stroke={3} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{t('onboarding.noPaymentNow')}</Text>
          </View>
          <DelayedContinueButton
            color={colors.accSolid}
            textColor={colors.surface3}
            shadowColor={paywallButtonShadow(colors)}
            onPress={onNext}
            label={t('onboarding.tryForZero')}
            contentStyle={{ paddingVertical: 18, width: '100%' }}
          />
          <Text style={{ color: colors.textDim, fontSize: 15, lineHeight: 21, fontWeight: '500', textAlign: 'center' }}>
            {t('onboarding.noCommitmentDisclaimer')}
          </Text>
          {onSignOutSession ? (
            <TouchableOpacity onPress={onSignOutSession} activeOpacity={0.72} style={{ paddingVertical: 10 }}>
              <Text style={{ color: colors.textDim, fontSize: 14, fontWeight: FONT.bold, textDecorationLine: 'underline' }}>
                {t('onboarding.removeSession')}
              </Text>
            </TouchableOpacity>
          ) : null}
          <PaywallLegalFooter colors={colors} onSignIn={onSignIn} />
        </View>
      </PaywallBottomPanel>
    </PaywallScreenContainer>
  );
};

export const Step31_TrialReminder = ({ onNext, onSignIn }: { onNext: () => void; onSignIn?: () => void }) => {
  const { colors } = useColors();
  const { t } = useLanguage();

  return (
    <PaywallScreenContainer colors={colors}>
      <View style={{ flexShrink: 0, alignItems: 'center', paddingTop: 4, paddingHorizontal: 8 }}>
        <Text style={{ color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '600', textAlign: 'center', maxWidth: 335 }}>
          {t('onboarding.trialReminderTitle')}
        </Text>
      </View>

      <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 }}>
        <AnimatedTrialBell colors={colors} />
      </View>

      <PaywallBottomPanel colors={colors}>
        <View style={{ width: '100%', alignItems: 'center', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Icon name="check" size={22} color={colors.text} variant="outline" stroke={3} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{t('onboarding.noPaymentNow')}</Text>
          </View>
          <DelayedContinueButton
            color={colors.accSolid}
            textColor={colors.surface3}
            shadowColor={paywallButtonShadow(colors)}
            onPress={onNext}
            label={t('onboarding.continueFree')}
            contentStyle={{ paddingVertical: 18, width: '100%' }}
          />
          <Text style={{ color: colors.textDim, fontSize: 15, lineHeight: 21, fontWeight: '500', textAlign: 'center' }}>
            {t('onboarding.annualSmallPrice')}
          </Text>
          <PaywallLegalFooter colors={colors} onSignIn={onSignIn} />
        </View>
      </PaywallBottomPanel>
    </PaywallScreenContainer>
  );
};

export const Step32_FinalPaywall = ({ onNext, onSignIn, onDismiss }: { onNext: () => void; onSignIn?: () => void; onDismiss?: () => void }) => {
  const { colors } = useColors();
  const { session } = useAuth();
  const { t } = useLanguage();
  const { annualPackage, weeklyPackage, purchasePlan, restorePurchases, loading: subscriptionLoading, error: subscriptionError } = useSubscription();
  const [showPlans, setShowPlans] = useState(false);
  const [plan, setPlan] = useState<'annual' | 'weekly'>('annual');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const euro = String.fromCharCode(8364);
  const purchasePlanKey = showPlans && plan === 'weekly' ? 'weekly' : 'annual';
  const isTrialPurchase = isAnnualTrialPurchase(purchasePlanKey);
  const annualPrice = resolveAnnualPriceString(annualPackage, euro);
  const weeklyPrice = weeklyPackage?.product.priceString || `4,99 ${euro}`;

  const handlePay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!session) {
      onSignIn?.();
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await purchasePlan(purchasePlanKey);
    setBusy(false);
    if (result.success) {
      onNext();
      return;
    }
    if (result.error) {
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
    if (result.success) {
      if (session?.user?.id) {
        const hasName = await hasUserProfileName(session.user.id);
        if (!hasName) {
          onNext();
          return;
        }
      }
      requestAuthNavigationRefresh();
      setMessage(t('onboarding.purchaseRestored'));
      return;
    }
    setMessage(result.error);
  };

  const openLegalLink = (url: string) => {
    Linking.openURL(url).catch(() => setMessage(t('onboarding.linkOpenError')));
  };

  return (
    <PaywallScreenContainer colors={colors}>
      {onDismiss ? (
        <TouchableOpacity
          onPress={onDismiss}
          activeOpacity={0.75}
          style={{ position: 'absolute', top: 8, right: 12, zIndex: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="x" size={22} color={colors.textDim} stroke={3} />
        </TouchableOpacity>
      ) : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12, paddingTop: 4, alignItems: 'center', width: '100%' }}
        showsVerticalScrollIndicator
      >
        <View style={{ width: '100%', maxWidth: 340, alignItems: 'center', paddingHorizontal: 8 }}>
          <PaywallTitleTwoLines
            line1={t('onboarding.paywallTrialHeadlineLine1')}
            line2={t('onboarding.paywallTrialHeadlineLine2')}
            colors={colors}
          />
          <View style={{ height: 8 }} />
          <PaywallTrialTimeline colors={colors} t={t} />
        </View>

        {showPlans ? (
          <View style={{ width: '100%', maxWidth: 340, gap: 10, marginTop: 18, paddingHorizontal: 8 }}>
            {[
              { id: 'annual' as const, title: t('onboarding.annual'), subtitle: resolveAnnualPlanSubtitle(annualPackage, annualPrice, t), badge: t('onboarding.best') },
              { id: 'weekly' as const, title: t('onboarding.weekly'), subtitle: t('onboarding.weeklyPlanSubtitle', { price: weeklyPrice }), badge: null },
            ].map((item) => {
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
                    backgroundColor: selected ? colors.accGlow : colors.surface,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 9,
                  }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? colors.accSolid : colors.hairline2, alignItems: 'center', justifyContent: 'center' }}>
                    {selected ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accSolid }} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ color: colors.textDim, fontSize: 12, lineHeight: 16, fontWeight: '600', marginTop: 1 }} numberOfLines={2}>{item.subtitle}</Text>
                  </View>
                  {item.badge ? (
                    <View style={{ backgroundColor: colors.accSolid, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: colors.surface3, fontSize: 10, fontWeight: '800' }}>{item.badge}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <TouchableOpacity onPress={() => setShowPlans((prev) => !prev)} activeOpacity={0.72} style={{ alignSelf: 'center', paddingVertical: 14 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}>
            {showPlans ? t('onboarding.hidePlans') : t('onboarding.seePlans')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <PaywallBottomPanel colors={colors}>
        <View style={{ width: '100%', alignItems: 'center', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Icon name="check" size={22} color={colors.text} variant="outline" stroke={3} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{t('onboarding.noPaymentNow')}</Text>
          </View>
          <SquishyButton
            color={colors.accSolid}
            shadowColor={paywallButtonShadow(colors)}
            shadowDepth={5}
            onPress={handlePay}
            style={{ width: '100%' }}
            contentStyle={{ paddingVertical: 18, width: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            {busy || subscriptionLoading ? (
              <ActivityIndicator color={colors.surface3} />
            ) : (
              <Text style={[styles.btnText, { color: colors.surface3, fontSize: 17 }]}>
                {isTrialPurchase ? t('onboarding.startFreeTrial') : t('onboarding.continue')}
              </Text>
            )}
          </SquishyButton>
          {isTrialPurchase ? (
            <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 18, fontWeight: '500', textAlign: 'center' }}>
              {t('onboarding.billedAfterTrial', { price: annualPrice })}
            </Text>
          ) : null}
          {!!(message || subscriptionError) ? (
            <Text style={{ color: colors.accSolid, fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'center' }}>
              {message || subscriptionError}
            </Text>
          ) : null}
          <PaywallLegalRow
            colors={colors}
            busy={busy}
            onRestore={handleRestore}
            onPrivacy={() => openLegalLink(LEGAL_LINKS.privacy)}
            onTerms={() => openLegalLink(LEGAL_LINKS.terms)}
            restoreLabel={t('onboarding.restoreShort')}
            privacyLabel={t('onboarding.privacyShort')}
            termsLabel={t('onboarding.termsShort')}
          />
        </View>
      </PaywallBottomPanel>
    </PaywallScreenContainer>
  );
};

export const ONBOARDING_STEPS = [
  Step1_Loading, Step2_Value, Step3_Thought, Step4_BedReason, Step5_UsualTime,
  Step6_SnoozeFreq, Step7_AlarmCount, Step8_Biology, Step9_Chart, Step10_OneAlarm, Step11_Temple,
  Step12_PhysicalAction, Step13_WakeFeeling, Step14_MissionMode, Step15_MissionConfig, Step16_AwakeTime,
  Step17_TargetTime, Step18_ProtectedDays, Step18b_GoalSummary, Step20_ThePact,
  Step28b_MorningPlan, Step27_Auth, Step23_PaywallChart,
  Step30_TrialIntro, Step31_TrialReminder, Step32_FinalPaywall,
  Step28_FinalForm, Step29_Processing,
];

export const PAYWALL_FLOW_STEPS = [Step30_TrialIntro, Step31_TrialReminder, Step32_FinalPaywall];

export const MORNING_PLAN_STEP = ONBOARDING_STEPS.findIndex(
  (Component) => Component.name === 'Step28b_MorningPlan'
);
export const AUTH_ONBOARDING_STEP = ONBOARDING_STEPS.findIndex(
  (Component) => Component.name === 'Step27_Auth'
);
export const CHART_STEP = ONBOARDING_STEPS.findIndex(
  (Component) => Component.name === 'Step23_PaywallChart'
);
export const POST_PAY_PROFILE_STEP = ONBOARDING_STEPS.findIndex(
  (Component) => Component.name === 'Step28_FinalForm'
);
export const PAYWALL_START_STEP = ONBOARDING_STEPS.findIndex(
  (Component) => Component.name === 'Step30_TrialIntro'
);
export const FIRST_ONBOARDING_STEP = 1;
export const DIRECT_PAYWALL_STEP = ONBOARDING_STEPS.length - 3;

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, justifyContent: 'space-between' },
  paywallScreen: { flex: 1, paddingHorizontal: 24, paddingBottom: 0 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  readingPhraseIcon: { alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  readingPhraseBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  phraseStack: {
    minHeight: 220,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phraseLayer: {
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  habitFooterNote: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONT_FAMILY.semiBold,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  templeFooter: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    paddingTop: 4,
  },
  chartScreen: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  chartTitle: {
    marginBottom: 0,
    paddingHorizontal: 24,
    fontSize: 30,
    textAlign: 'center',
    alignSelf: 'center',
    paddingTop: 8,
  },
  chartBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  chartFooter: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    paddingTop: 4,
  },
  chartCompareWrap: { alignSelf: 'center', width: '100%', maxWidth: 348, paddingHorizontal: 8 },
  chartHeadersRow: { flexDirection: 'row', marginBottom: 22, paddingHorizontal: 0 },
  chartHeaderLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  chartColumnsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 20 },
  chartColumn: { flex: 1, maxWidth: 164, alignItems: 'center' },
  chartTrack: { position: 'relative', alignSelf: 'center' },
  chartTrackRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 36, zIndex: 2 },
  chartDotCol: { width: 28, alignItems: 'center', zIndex: 2 },
  chartLabelCol: { marginLeft: 10, width: 78 },
  chartDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFA000',
  },
  chartZigzagLine: { position: 'absolute', top: 14, left: 0, width: 28, zIndex: 0 },
  chartLeftSpacer: { height: 20 },
  chartRooLine: {
    position: 'absolute',
    left: 12.75,
    top: 14,
    width: 3,
    backgroundColor: '#34C759',
    borderRadius: 2,
    zIndex: 0,
  },
  chartBadgeSection: {
    marginTop: 0,
    alignSelf: 'flex-start',
    zIndex: 2,
  },
  chartBadgeSpine: {
    width: 28,
    alignItems: 'center',
  },
  chartBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#34C759',
    width: 84,
  },
  chartBadgeTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
  },
  chartBadgeNumber: { color: '#28A745', fontWeight: '900', fontSize: 20, lineHeight: 22 },
  chartBadgeMin: { color: '#28A745', fontWeight: '900', fontSize: 9, letterSpacing: 0.8, lineHeight: 12 },
  chartBadgeLabel: {
    color: '#28A745',
    fontWeight: '800',
    fontSize: 8,
    marginTop: 2,
    letterSpacing: 0.6,
    textAlign: 'center',
    lineHeight: 10,
  },
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
