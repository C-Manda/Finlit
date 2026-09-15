import { Platform, StyleSheet } from 'react-native';

export const palette = {
  ink: '#111214',
  muted: '#746c70',
  canvas: '#faf9f8',
  surface: '#ffffff',
  line: '#e5e0e1',
  blush: '#efd8e5',
  mint: '#d9eee5',
  blue: '#dce8f1',
  peach: '#f1dfd3',
  lilac: '#e4def1',
  teal: '#6eaaa0',
  warning: '#d89a70',
};

export const spacing = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 };
export const radii = { sm: 12, md: 18, lg: 24, pill: 999 };

export const fonts = Platform.select({
  ios: { regular: 'System', medium: 'System' },
  android: { regular: 'sans-serif', medium: 'sans-serif-medium' },
  default: { regular: 'normal', medium: 'normal' },
});

export const commonStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: spacing.md, paddingBottom: 110 },
  title: { color: palette.ink, fontSize: 30, lineHeight: 34, fontWeight: '500' },
  heading: { color: palette.ink, fontSize: 22, lineHeight: 27, fontWeight: '500' },
  body: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  label: { color: palette.muted, fontSize: 11, lineHeight: 16 },
});