import React, { useRef, useEffect } from 'react';
import { Animated, PanResponder } from 'react-native';

export const useSwipeInteractive = (isVisible: boolean, onCloseAction: () => void) => {
  const panY = useRef(new Animated.Value(600)).current;
  const scrollY = useRef(0);
  
  useEffect(() => {
    if (isVisible) {
      panY.setValue(600);
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    }
  }, [isVisible]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 15 && scrollY.current <= 0,
    onMoveShouldSetPanResponderCapture: (_, gestureState) => gestureState.dy > 15 && scrollY.current <= 0,
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        panY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 100 || gestureState.vy > 1.2) {
        Animated.timing(panY, {
          toValue: 600,
          duration: 250,
          useNativeDriver: true
        }).start(() => {
           onCloseAction();
           setTimeout(() => panY.setValue(0), 100);
        });
      } else {
        Animated.spring(panY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0
        }).start();
      }
    }
  }), [isVisible, onCloseAction]);
  return { panY, panResponder, scrollY };
};
