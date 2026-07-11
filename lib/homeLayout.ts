const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export interface HomeLayoutMetrics {
  scale: number;
  isCompactHeight: boolean;
  isCompactWidth: boolean;
  contentMaxWidth: number;
  horizontalPadding: number;
  greetFontSize: number;
  characterSize: number;
  characterImageSize: number;
  progressNumberSize: number;
  progressTrackHeight: number;
  progressBlockWidth: string;
  topSectionMinHeight: number;
  widgetSectionTopSpacing: number;
  characterAreaMarginTop: number;
  widgetHeight: number;
  widgetGap: number;
  widgetPaddingH: number;
  widgetPaddingV: number;
  widgetBorderRadius: number;
  alarmTimeFontSize: number;
  alarmTimeLockedFontSize: number;
  streakRingSize: number;
  streakRingRadius: number;
  streakFlameSize: number;
  streakLabelSize: number;
}

export function getHomeLayoutMetrics(width: number, height: number): HomeLayoutMetrics {
  const isCompactHeight = height < 700;
  const isCompactWidth = width < 360;
  const scale = clamp(Math.min(width / 390, height / 844), 0.78, 1.06);
  const contentMaxWidth = clamp(width - 36, 320, 520);

  const greetFontSize = Math.round(clamp(32 * scale, 22, 34));
  const characterSize = Math.round(clamp(230 * scale, isCompactHeight ? 150 : 168, 240));
  const characterImageSize = Math.round(characterSize * 0.848);
  const progressNumberSize = Math.round(clamp(46 * scale, 32, 50));

  const topSectionRatio = isCompactHeight ? 0.54 : isCompactWidth ? 0.56 : 0.58;
  const topSectionMinHeight = Math.round(
    clamp(height * topSectionRatio, height * 0.46, height * 0.68)
  );

  const widgetSectionTopSpacing = Math.round(
    clamp(height * (isCompactHeight ? 0.028 : 0.04), 12, 48)
  );

  return {
    scale,
    isCompactHeight,
    isCompactWidth,
    contentMaxWidth,
    horizontalPadding: Math.round(clamp(20 * scale, 14, 22)),
    greetFontSize,
    characterSize,
    characterImageSize,
    progressNumberSize,
    progressTrackHeight: Math.round(clamp(10 * scale, 8, 12)),
    progressBlockWidth: `${Math.round(clamp(64 * scale, 56, 68))}%`,
    topSectionMinHeight,
    widgetSectionTopSpacing,
    characterAreaMarginTop: Math.round(clamp(24 * scale, 10, 28)),
    widgetHeight: Math.round(clamp(138 * scale, isCompactHeight ? 112 : 118, 150)),
    widgetGap: Math.round(clamp(18 * scale, isCompactWidth ? 10 : 12, 20)),
    widgetPaddingH: Math.round(clamp(24 * scale, isCompactWidth ? 14 : 16, 26)),
    widgetPaddingV: Math.round(clamp(18 * scale, 14, 20)),
    widgetBorderRadius: Math.round(clamp(34 * scale, 26, 36)),
    alarmTimeFontSize: Math.round(clamp(34 * scale, 26, 36)),
    alarmTimeLockedFontSize: Math.round(clamp(28 * scale, 22, 30)),
    streakRingSize: Math.round(clamp(44 * scale, isCompactWidth ? 34 : 38, 46)),
    streakRingRadius: Math.round(clamp(17 * scale, isCompactWidth ? 13 : 14, 18)),
    streakFlameSize: Math.round(clamp(15 * scale, 12, 16)),
    streakLabelSize: Math.round(clamp(10 * scale, 9, 11)),
  };
}
