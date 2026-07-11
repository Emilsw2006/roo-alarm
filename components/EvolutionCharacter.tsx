import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Image, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ROO_ASSETS, AnimationState } from '../constants/RooAssets';

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y, 
    "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y
  ].join(" ");
}

interface EvolutionCharacterProps {
  streak: number;
  animateToStreak?: number | null;
  onPress: () => void;
  animationState?: AnimationState;
  onAnimationEnd?: () => void;
  showRing?: boolean;
  useVideo?: boolean;
  characterSize?: number;
  characterImageSize?: number;
}

function RooVideo({ source, shouldLoop, onEnd, onError }: { source: number; shouldLoop: boolean; onEnd?: () => void; onError: () => void }) {
  const player = useVideoPlayer(source, (nextPlayer) => {
    nextPlayer.loop = shouldLoop;
    nextPlayer.muted = true;
    nextPlayer.play();
  });

  useEffect(() => {
    const endSubscription = player.addListener('playToEnd', () => {
      if (!shouldLoop) onEnd?.();
    });
    const errorSubscription = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' || error) onError();
    });
    return () => {
      endSubscription.remove();
      errorSubscription.remove();
    };
  }, [player, shouldLoop, onEnd, onError]);

  return <VideoView player={player} style={styles.characterImage} contentFit="contain" nativeControls={false} allowsFullscreen={false} />;
}

export default function EvolutionCharacter({ streak, animateToStreak, onPress, animationState = 'idle', onAnimationEnd, showRing = true, useVideo = true, characterSize = 230, characterImageSize = 195 }: EvolutionCharacterProps) {
  const { colors } = useColors();
  const { t } = useLanguage();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const imageTransition = useRef(new Animated.Value(1)).current;
  const lastImageSource = useRef<any>(null);
  const [videoError, setVideoError] = useState(false);
  const [previousImageSource, setPreviousImageSource] = useState<any>(null);

  // Re-run animation if animateToStreak changes
  useEffect(() => {
    if (animateToStreak != null) {
      progressAnim.setValue(0);
      glowAnim.setValue(0);
      
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.delay(1900), 
        Animated.timing(glowAnim, { toValue: 0, duration: 300, useNativeDriver: false })
      ]).start();
      
      Animated.timing(progressAnim, { toValue: 1, duration: 2500, useNativeDriver: false }).start();
    }
  }, [animateToStreak]);

  // Calculate Tier
  let tierLevel: 'level1' | 'level2' | 'level3' | 'level4' | 'level5' | 'level6' = 'level1';
  let tierColor = '#CD7F32';
  let base = 0;
  let target = 4;

  if (streak >= 21) {
    tierLevel = 'level6';
    tierColor = '#333333';
    base = 21; target = 21;
  } else if (streak >= 18) {
    tierLevel = 'level5';
    tierColor = '#FF3B30';
    base = 18; target = 21;
  } else if (streak >= 13) {
    tierLevel = 'level4';
    tierColor = '#50c8ff';
    base = 13; target = 18;
  } else if (streak >= 8) {
    tierLevel = 'level3';
    tierColor = '#FFD700';
    base = 8; target = 13;
  } else if (streak >= 4) {
    tierLevel = 'level2';
    tierColor = '#A9A9A9';
    base = 4; target = 8;
  } else {
    tierLevel = 'level1';
    tierColor = '#CD7F32';
    base = 0; target = 4;
  }

  let progress = 1;
  if (target > base) {
    progress = (streak - base) / (target - base);
  }
  let newProgress = progress;
  if (animateToStreak != null) {
    let newTierBase = base;
    let newTierTarget = target;
    if (animateToStreak >= 21) { newTierBase = 21; newTierTarget = 21; }
    else if (animateToStreak >= 18) { newTierBase = 18; newTierTarget = 21; }
    else if (animateToStreak >= 13) { newTierBase = 13; newTierTarget = 18; }
    else if (animateToStreak >= 8) { newTierBase = 8; newTierTarget = 13; }
    else if (animateToStreak >= 4) { newTierBase = 4; newTierTarget = 8; }
    else { newTierBase = 0; newTierTarget = 4; }
    
    if (newTierTarget > newTierBase) {
      newProgress = (animateToStreak - newTierBase) / (newTierTarget - newTierBase);
    } else {
      newProgress = 1;
    }
  }

  const size = characterSize;
  const imageSize = characterImageSize;
  const strokeWidth = Math.round(size * 0.078);
  const radius = (size - strokeWidth) / 2;
  
  const startAngle = -120;
  const endAngle = 120;
  const arcLength = (240 / 360) * 2 * Math.PI * radius;
  
  const arcPath = describeArc(size / 2, size / 2, radius, startAngle, endAngle);

  const oldOffset = arcLength - progress * arcLength;
  const newOffset = arcLength - newProgress * arcLength;

  const AnimatedPath = Animated.createAnimatedComponent(Path);
  
  const dynamicOffset = animateToStreak != null 
    ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: [oldOffset, newOffset] })
    : oldOffset;

  const assets = ROO_ASSETS[tierLevel];
  const videoSource = assets[animationState as keyof typeof assets];
  const imageSource = assets.base;

  useEffect(() => {
    if (lastImageSource.current == null) {
      lastImageSource.current = imageSource;
      return;
    }
    if (lastImageSource.current !== imageSource) {
      setPreviousImageSource(lastImageSource.current);
      lastImageSource.current = imageSource;
      imageTransition.setValue(0);
      Animated.timing(imageTransition, { toValue: 1, duration: 320, useNativeDriver: true }).start(() => {
        setPreviousImageSource(null);
      });
    }
  }, [imageSource]);

  // Video and Asset logic
  useEffect(() => {
    setVideoError(false);
    if (!useVideo && animationState !== 'idle') {
      const timeout = setTimeout(() => onAnimationEnd?.(), 360);
      return () => clearTimeout(timeout);
    }
    if (!videoSource && animationState !== 'idle') {
      onAnimationEnd?.();
    }
  }, [animationState, tierLevel, videoSource, useVideo]);

  useEffect(() => {
    if (videoError && animationState !== 'idle') {
      onAnimationEnd?.();
    }
  }, [videoError, animationState]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !showRing && styles.containerNoRing,
        { minHeight: showRing ? size + 16 : size - 16, marginTop: showRing ? 26 : -8, marginBottom: showRing ? -16 : -20 },
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.characterWrapper}>
        
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          {showRing && (
            <Svg width={size} height={size} style={{ position: 'absolute' }}>
              <Path
                d={arcPath}
                stroke={'rgba(0,0,0,0.08)'}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              <AnimatedPath
                d={arcPath}
                stroke={colors.accSolid}
                fill="none"
                strokeWidth={strokeWidth + 24}
                strokeDasharray={arcLength}
                strokeDashoffset={dynamicOffset}
                strokeLinecap="round"
                opacity={glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] })}
              />
              <AnimatedPath
                d={arcPath}
                stroke={colors.accSolid}
                fill="none"
                strokeWidth={strokeWidth + 12}
                strokeDasharray={arcLength}
                strokeDashoffset={dynamicOffset}
                strokeLinecap="round"
                opacity={glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] })}
              />
              <AnimatedPath
                d={arcPath}
                stroke={colors.accSolid}
                fill="none"
                strokeWidth={strokeWidth + 6}
                strokeDasharray={arcLength}
                strokeDashoffset={dynamicOffset}
                strokeLinecap="round"
                opacity={glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] })}
              />
              <AnimatedPath
                d={arcPath}
                stroke={colors.accSolid}
                fill="none"
                strokeWidth={strokeWidth}
                strokeDasharray={arcLength}
                strokeDashoffset={dynamicOffset}
                strokeLinecap="round"
              />
            </Svg>
          )}
          
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: size/2, backgroundColor: tierColor, opacity: 0 }]} />
          
          <View style={{ transform: [{ translateY: showRing ? size * 0.046 : -size * 0.017 }], width: imageSize, height: imageSize }}>
            {previousImageSource && !useVideo && (
              <Animated.Image
                source={previousImageSource}
                style={[
                  styles.characterImage,
                  {
                    position: 'absolute',
                    opacity: imageTransition.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                    transform: [
                      { translateX: imageTransition.interpolate({ inputRange: [0, 1], outputRange: [0, 34] }) },
                      { scale: imageTransition.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }) },
                    ],
                  },
                ]}
                resizeMode="contain"
              />
            )}
            <Animated.Image 
              source={imageSource} 
              style={[
                styles.characterImage,
                {
                  position: 'absolute',
                  opacity: useVideo ? 1 : imageTransition,
                  transform: useVideo
                    ? [{ scale: 1 }]
                    : [
                        { translateX: imageTransition.interpolate({ inputRange: [0, 1], outputRange: [-34, 0] }) },
                        { scale: imageTransition.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                      ],
                },
              ]} 
              resizeMode="contain" 
            />
            {(useVideo && !videoError && videoSource) && (
              <RooVideo
                source={videoSource}
                shouldLoop={animationState === 'idle'}
                onError={() => setVideoError(true)}
                onEnd={onAnimationEnd}
              />
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerNoRing: {},
  characterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterImage: {
    width: '100%',
    height: '100%',
  }
});
