import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { useSubscription } from '../constants/SubscriptionContext';
import { LEGAL_LINKS } from '../constants/LegalLinks';
import { buildSubscriptionSummary } from '../lib/subscriptionSummary';
import { resolveAnnualPlanSubtitle, resolveAnnualPriceString } from '../lib/subscriptionPricing';
import { FONT_FAMILY, SIZES } from '../constants/theme';
import Icon from '../components/Icon';
import SquishyButton from '../components/SquishyButton';

interface SubscriptionScreenProps {
  navigation: any;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useColors();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textFaint }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function SubscriptionScreen({ navigation }: SubscriptionScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useColors();
  const { t } = useLanguage();
  const {
    loading,
    configured,
    hasPremiumAccess,
    isSimulatedPremium,
    annualPackage,
    weeklyPackage,
    customerInfo,
    dbSubscription,
    error,
    refreshCustomerInfo,
    purchasePlan,
    restorePurchases,
    openManageSubscriptions,
  } = useSubscription();
  const [busy, setBusy] = useState<'restore' | 'annual' | 'weekly' | null>(null);

  const summary = useMemo(
    () =>
      buildSubscriptionSummary({
        hasPremiumAccess,
        isSimulated: isSimulatedPremium,
        configured,
        customerInfo,
        annualPackage,
        weeklyPackage,
        dbExpiresAt: dbSubscription?.subscription_expires_at ?? null,
        dbStatus: dbSubscription?.subscription_status ?? null,
        dbSubscribedAt: dbSubscription?.subscribed_at ?? null,
        dbPlan: dbSubscription?.subscription_plan ?? null,
        labels: {
          inactive: t('subscriptionScreen.statusInactive'),
          active: t('subscriptionScreen.statusActive'),
          trial: t('subscriptionScreen.statusTrial'),
          annual: t('subscriptionScreen.planAnnual'),
          weekly: t('subscriptionScreen.planWeekly'),
          unknownPlan: t('subscriptionScreen.planUnknown'),
          simulated: t('subscriptionScreen.planSimulated'),
          devAccess: t('subscriptionScreen.statusDev'),
        },
      }),
    [
      annualPackage,
      configured,
      customerInfo,
      dbSubscription,
      hasPremiumAccess,
      isSimulatedPremium,
      t,
      weeklyPackage,
    ]
  );

  const renewalText = summary.renewalDate
    ? summary.isTrial
      ? t('subscriptionScreen.trialEndsOn', {
          date: summary.renewalDate.toLocaleDateString(),
        })
      : summary.willRenew
        ? t('subscriptionScreen.renewsOn', {
            date: summary.renewalDate.toLocaleDateString(),
          })
        : t('subscriptionScreen.endsOn', {
            date: summary.renewalDate.toLocaleDateString(),
          })
    : null;

  const openLegalLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert(t('onboarding.linkOpenError'));
    });
  };

  const handleRestore = async () => {
    setBusy('restore');
    const result = await restorePurchases();
    setBusy(null);
    Alert.alert(
      result.success ? t('onboarding.purchaseRestored') : t('purchaseNotFound'),
      result.success ? t('premiumUpdated') : result.error || t('purchaseAppleIdHint')
    );
  };

  const handlePurchase = async (plan: 'annual' | 'weekly') => {
    setBusy(plan);
    const result = await purchasePlan(plan);
    setBusy(null);
    if (result.success) {
      await refreshCustomerInfo();
      Alert.alert(t('subscriptionScreen.title'), t('premiumUpdated'));
      return;
    }
    if (result.error) {
      Alert.alert(t('subscriptionScreen.title'), result.error);
    }
  };

  const handleManage = async () => {
    try {
      await openManageSubscriptions();
    } catch {
      Alert.alert(t('subscriptionScreen.title'), t('onboarding.linkOpenError'));
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.gradientBottom]}
      style={[styles.screen, { paddingTop: insets.top }]}
    >
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
            <Icon name="arrowL" size={22} color={colors.text} stroke={3} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('subscriptionScreen.title')}</Text>
          <View style={{ width: 42 }} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          {loading ? (
            <ActivityIndicator color={colors.accSolid} style={{ marginVertical: 24 }} />
          ) : (
            <>
              <View style={[styles.statusPill, { backgroundColor: summary.isActive ? colors.accSolid + '20' : colors.surface2 }]}>
                <Text style={[styles.statusText, { color: summary.isActive ? colors.accSolid : colors.textDim }]}>
                  {summary.statusLabel}
                </Text>
              </View>

              <InfoRow label={t('subscriptionScreen.currentPlan')} value={summary.planLabel} />
              {summary.priceLabel ? (
                <InfoRow label={t('subscriptionScreen.price')} value={summary.priceLabel} />
              ) : null}
              {renewalText ? (
                <InfoRow label={t('subscriptionScreen.billing')} value={renewalText} />
              ) : null}
              {error && !configured ? (
                <Text style={[styles.hint, { color: colors.textFaint }]}>{error}</Text>
              ) : null}
            </>
          )}
        </View>

        {!summary.isActive && !loading ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textFaint }]}>{t('subscriptionScreen.availablePlans')}</Text>
            {annualPackage ? (
              <SquishyButton
                color={colors.surface}
                shadowColor="rgba(0,0,0,0.08)"
                borderRadius={16}
                style={{ marginBottom: 10 }}
                contentStyle={styles.planBtn}
                onPress={() => handlePurchase('annual')}
              >
                <View>
                  <Text style={[styles.planTitle, { color: colors.text }]}>{t('subscriptionScreen.planAnnual')}</Text>
                  <Text style={[styles.planPrice, { color: colors.textDim }]}>
                    {resolveAnnualPlanSubtitle(
                      annualPackage,
                      resolveAnnualPriceString(annualPackage),
                      t
                    )}
                  </Text>
                </View>
                {busy === 'annual' ? <ActivityIndicator color={colors.accSolid} /> : <Icon name="chevR" size={18} color={colors.textFaint} />}
              </SquishyButton>
            ) : null}
            {weeklyPackage ? (
              <SquishyButton
                color={colors.surface}
                shadowColor="rgba(0,0,0,0.08)"
                borderRadius={16}
                contentStyle={styles.planBtn}
                onPress={() => handlePurchase('weekly')}
              >
                <View>
                  <Text style={[styles.planTitle, { color: colors.text }]}>{t('subscriptionScreen.planWeekly')}</Text>
                  <Text style={[styles.planPrice, { color: colors.textDim }]}>{weeklyPackage.product.priceString}</Text>
                </View>
                {busy === 'weekly' ? <ActivityIndicator color={colors.accSolid} /> : <Icon name="chevR" size={18} color={colors.textFaint} />}
              </SquishyButton>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <SquishyButton
            color={colors.accSolid}
            shadowColor="rgba(0,0,0,0.12)"
            borderRadius={16}
            contentStyle={styles.actionBtn}
            onPress={handleManage}
          >
            <Text style={styles.actionBtnText}>{t('subscriptionScreen.manageSubscription')}</Text>
          </SquishyButton>

          <SquishyButton
            color={colors.surface}
            shadowColor="rgba(0,0,0,0.06)"
            borderRadius={16}
            style={{ marginTop: 10 }}
            contentStyle={styles.actionBtn}
            onPress={handleRestore}
          >
            {busy === 'restore' ? (
              <ActivityIndicator color={colors.accSolid} />
            ) : (
              <Text style={[styles.actionBtnTextDark, { color: colors.text }]}>{t('settingsScreen.restorePurchase')}</Text>
            )}
          </SquishyButton>
        </View>

        <View style={styles.legalBlock}>
          <Text style={[styles.legalText, { color: colors.textFaint }]}>{t('subscriptionScreen.autoRenewDisclaimer')}</Text>
          <TouchableOpacity onPress={() => openLegalLink(LEGAL_LINKS.terms)} activeOpacity={0.75}>
            <Text style={[styles.legalLink, { color: colors.accSolid }]}>{t('settingsScreen.terms')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openLegalLink(LEGAL_LINKS.privacy)} activeOpacity={0.75}>
            <Text style={[styles.legalLink, { color: colors.accSolid }]}>{t('settingsScreen.privacy')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.pad,
    paddingTop: 12,
    marginBottom: 20,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: FONT_FAMILY.black,
    letterSpacing: -0.4,
  },
  card: {
    marginHorizontal: SIZES.pad,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 8,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.bold,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 17,
    fontFamily: FONT_FAMILY.bold,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT_FAMILY.semiBold,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: SIZES.pad,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.extraBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  planTitle: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.bold,
  },
  planPrice: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.semiBold,
    marginTop: 2,
  },
  actionBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: FONT_FAMILY.bold,
  },
  actionBtnTextDark: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.bold,
  },
  legalBlock: {
    paddingHorizontal: SIZES.pad,
    marginTop: 24,
    gap: 10,
  },
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT_FAMILY.semiBold,
  },
  legalLink: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.bold,
    textDecorationLine: 'underline',
  },
});
