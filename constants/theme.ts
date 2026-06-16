export type PaletteKey = 'warmGlass' | 'lavender' | 'ocean' | 'midnight' | 'seaGradient' | 'redWhite' | 'rooGamified';

export interface Palette {
  name: string;
  bg: string;
  gradientTop: string;
  gradientBottom: string;
  surface: string;
  surface2: string;
  surface3: string;
  hairline: string;
  hairline2: string;
  text: string;
  textDim: string;
  textFaint: string;
  accSolid: string;
  accGlow: string;
  green: string;
  brandOrange?: string;
  isDark: boolean;
}

export const PALETTES: Record<PaletteKey, Palette> = {
  warmGlass: {
    name: 'Warm Glass',
    bg: '#5c4c47',
    gradientTop: '#6f5d57',
    gradientBottom: '#3d322e',
    surface: 'rgba(255,255,255,0.08)',
    surface2: 'rgba(255,255,255,0.15)',
    surface3: 'rgba(255,255,255,0.22)',
    hairline: 'rgba(255,255,255,0.14)',
    hairline2: 'rgba(255,255,255,0.22)',
    text: '#ffffff',
    textDim: 'rgba(255,255,255,0.65)',
    textFaint: 'rgba(255,255,255,0.4)',
    accSolid: '#ffffff',
    accGlow: 'rgba(255,255,255,0.15)',
    green: '#8e9f8f',
    isDark: true,
  },
  lavender: {
    name: 'Lavender Dawn',
    bg: '#0d0b12',
    gradientTop: '#1a1525',
    gradientBottom: '#0d0b12',
    surface: 'rgba(255,255,255,0.045)',
    surface2: 'rgba(255,255,255,0.075)',
    surface3: 'rgba(255,255,255,0.11)',
    hairline: 'rgba(255,255,255,0.085)',
    hairline2: 'rgba(255,255,255,0.14)',
    text: '#f5f4f2',
    textDim: 'rgba(245,244,242,0.56)',
    textFaint: 'rgba(245,244,242,0.34)',
    accSolid: '#b388ff',
    accGlow: 'rgba(179,136,255,0.45)',
    green: '#34c759',
    isDark: true,
  },
  ocean: {
    name: 'Ocean',
    bg: '#090b0e',
    gradientTop: '#101820',
    gradientBottom: '#090b0e',
    surface: 'rgba(255,255,255,0.045)',
    surface2: 'rgba(255,255,255,0.075)',
    surface3: 'rgba(255,255,255,0.11)',
    hairline: 'rgba(255,255,255,0.085)',
    hairline2: 'rgba(255,255,255,0.14)',
    text: '#f0f4f5',
    textDim: 'rgba(240,244,245,0.56)',
    textFaint: 'rgba(240,244,245,0.34)',
    accSolid: '#26c6da',
    accGlow: 'rgba(38,198,218,0.45)',
    green: '#34c759',
    isDark: true,
  },
  midnight: {
    name: 'Midnight Rose',
    bg: '#0b080c',
    gradientTop: '#1a1018',
    gradientBottom: '#0b080c',
    surface: 'rgba(255,255,255,0.045)',
    surface2: 'rgba(255,255,255,0.075)',
    surface3: 'rgba(255,255,255,0.11)',
    hairline: 'rgba(255,255,255,0.085)',
    hairline2: 'rgba(255,255,255,0.14)',
    text: '#f5f0f2',
    textDim: 'rgba(245,240,242,0.56)',
    textFaint: 'rgba(245,240,242,0.34)',
    accSolid: '#ff4081',
    accGlow: 'rgba(255,64,129,0.45)',
    green: '#34c759',
    isDark: true,
  },
  seaGradient: {
    name: 'Sea Gradient',
    bg: '#075057',
    gradientTop: '#09606D',
    gradientBottom: '#075057',
    surface: 'rgba(210,236,242,0.08)',
    surface2: 'rgba(210,236,242,0.15)',
    surface3: 'rgba(210,236,242,0.22)',
    hairline: 'rgba(210,236,242,0.14)',
    hairline2: 'rgba(210,236,242,0.22)',
    text: '#ffffff',
    textDim: 'rgba(255,255,255,0.7)',
    textFaint: 'rgba(255,255,255,0.4)',
    accSolid: '#D2ECF2',
    accGlow: 'rgba(210,236,242,0.25)',
    green: '#34c759',
    isDark: true,
  },
  redWhite: {
    name: 'Red White',
    bg: '#F0F0F0',
    gradientTop: '#FFFFFF',
    gradientBottom: '#E5E5E5',
    surface: 'rgba(255,255,255,0.7)',
    surface2: 'rgba(255,255,255,0.85)',
    surface3: 'rgba(255,255,255,0.95)',
    hairline: 'rgba(0,0,0,0.05)',
    hairline2: 'rgba(0,0,0,0.1)',
    text: '#111111',
    textDim: 'rgba(17,17,17,0.6)',
    textFaint: 'rgba(17,17,17,0.3)',
    accSolid: '#E7473C',
    accGlow: 'rgba(231,71,60,0.4)',
    green: '#34c759',
    isDark: false,
  },
  rooGamified: {
    name: 'Roo Gamified',
    bg: '#FFFDF8',
    gradientTop: '#FFFFFF',
    gradientBottom: '#FFFDF8',
    surface: '#FFFFFF',
    surface2: '#F8F6F0',
    surface3: '#F0EFE9',
    hairline: 'rgba(0,0,0,0.05)',
    hairline2: 'rgba(0,0,0,0.1)',
    text: '#373737',
    textDim: '#A09E9B',
    textFaint: 'rgba(55,55,55,0.3)',
    accSolid: '#E53935',
    accGlow: 'rgba(229, 57, 53, 0.3)',
    green: '#34c759',
    brandOrange: '#FFA000',
    isDark: false,
  },
};

export const PALETTE_KEYS: PaletteKey[] = ['warmGlass', 'lavender', 'ocean', 'midnight', 'seaGradient', 'redWhite', 'rooGamified'];

// Default exports for backward compatibility — uses rooGamified palette
export const COLORS = PALETTES.rooGamified;

export const SIZES = {
  rXl: 36, // button_border_radius
  rLg: 28, // card_border_radius
  rMd: 22,
  rSm: 16,
  pad: 20,
};

export const FONT_FAMILY = {
  black: 'Nunito_900Black',
  extraBold: 'Nunito_800ExtraBold',
  bold: 'Nunito_700Bold',
  semiBold: 'Nunito_600SemiBold',
  medium: 'Nunito_500Medium',
  regular: 'Nunito_400Regular',
};

export const FONT = {
  bold: '800' as const,
  semiBold: '600' as const,
  medium: '500' as const,
  regular: '400' as const,
};
