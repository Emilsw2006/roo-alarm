import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors } from '../constants/ThemeContext';
import Icon from './Icon';

interface MissionGlyphProps {
  icon: string;
  size?: number;
  active?: boolean;
}

export default function MissionGlyph({ icon, size = 46, active = false }: MissionGlyphProps) {
  const { colors } = useColors();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: active ? colors.accSolid : colors.surface2,
          borderWidth: active ? 0 : 1,
          borderColor: colors.hairline,
        },
      ]}
    >
      <Icon name={icon} size={size * 0.5} color={active ? '#1a0e08' : colors.text} stroke={1.8} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
