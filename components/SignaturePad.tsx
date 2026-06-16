import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, TouchableOpacity, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '../constants/ThemeContext';
import * as Haptics from 'expo-haptics';

interface SignaturePadProps {
  onOK: (signatureExists: boolean) => void;
  onClear?: () => void;
  width?: number | string;
  height?: number;
}

export default function SignaturePad({ onOK, onClear, width = '100%', height = 200 }: SignaturePadProps) {
  const { colors } = useColors();
  const [paths, setPaths] = useState<string[]>([]);
  const currentPath = useRef<string>('');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current = `M${locationX},${locationY}`;
        Haptics.selectionAsync(); // Subtle vibration on touch start
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current += ` L${locationX},${locationY}`;
        
        // Remove asynchronous access to `evt` to avoid synthetic event pooling errors
        setPaths((prevPaths) => {
          const newPaths = [...prevPaths];
          // To make it smooth, we update the last path in state
          if (currentPath.current.split('L').length === 2) {
            newPaths.push(currentPath.current); // First move after grant
          } else {
            newPaths[newPaths.length - 1] = currentPath.current;
          }
          return newPaths;
        });
      },
      onPanResponderRelease: () => {
        if (currentPath.current) {
          onOK(true); // Notify that a signature exists
        }
      },
    })
  ).current;

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaths([]);
    currentPath.current = '';
    onOK(false);
    if (onClear) onClear();
  };

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={[styles.pad, { width, height, backgroundColor: '#FFF' }]} {...panResponder.panHandlers}>
        <Svg width="100%" height="100%">
          {paths.map((path, index) => (
            <Path
              key={index}
              d={path}
              stroke="#000"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {paths.length === 0 && (
          <View style={styles.placeholderContainer} pointerEvents="none">
            <Text style={[styles.placeholderText, { color: colors.textFaint }]}>Firma aquí...</Text>
          </View>
        )}
      </View>
      {paths.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearText}>Borrar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  pad: {
    position: 'relative',
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  clearButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  clearText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  }
});
