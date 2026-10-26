import { Platform } from 'react-native';

/**
 * KEVLAR — amber phosphor CRT.
 *
 * The whole look is one idea: a 1987 monochrome terminal that someone hooked
 * up to their bank. Amber on near-black, monospace everything, chunky frames.
 * Colour is rationed — it only appears where money has a direction.
 */

export const color = {
  // The inside of a switched-off CRT is never pure black; it's warm and dusty.
  bg: '#0B0A07',
  surface: '#141109',
  surfaceHi: '#1E1910',
  surfacePress: '#2B2416',

  border: '#3A2F18',
  borderHi: '#5A4820',

  // Amber phosphor at three burn levels.
  text: '#FFC145',
  textDim: '#B8863A',
  textFaint: '#6E5326',

  // Brand == the phosphor itself.
  accent: '#FFB000',
  accentDim: '#7A5400',
  accentText: '#0B0A07',

  // P1 green phosphor for money coming in, CRT red for money going out.
  income: '#4AE87A',
  expense: '#FF5C4D',
  transfer: '#5AD2FF',

  warn: '#FFD166',
  danger: '#FF3B30',
  overlay: 'rgba(11,10,7,0.88)',

  /** Faint amber wash used for glows and selected states. */
  glow: 'rgba(255,176,0,0.14)',
  scanline: 'rgba(0,0,0,0.22)',

  /*
   * Bureaucratic layer — the retrofuturistic-agency register. Burnt orange
   * and mustard on bone, for anything that should read as an official form
   * rather than a screen readout.
   */
  bone: '#E8DCC0',
  boneDim: '#B5A683',
  rust: '#C2410C',
  mustard: '#D19A22',
  ink: '#1A1509',
  stamp: '#B33A2B',
  stampOk: '#4A7C3F',
} as const;

/** Terminal-safe category colours — all readable against the dark phosphor bg. */
export const swatch = [
  '#FFB000',
  '#4AE87A',
  '#5AD2FF',
  '#FF5C4D',
  '#C08CFF',
  '#4ECDC4',
  '#FF9F45',
  '#FF7BC0',
  '#A8D84A',
  '#9A8A6A',
] as const;

/**
 * Monospace stack. No bundled font files — these ship with every OS.
 *
 * `ui-monospace` resolves to SF Mono on Apple platforms, which is materially
 * wider and heavier than Courier New. That matters: the PWA runs as web even
 * on the phone, and the Courier fallback reads thin and cramped at small sizes.
 */
export const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default:
    'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Roboto Mono", monospace',
}) as string;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Terminals don't have rounded corners. Everything is square or nearly so. */
export const radius = {
  sm: 0,
  md: 2,
  lg: 2,
  xl: 3,
  pill: 2,
} as const;

export const font = {
  // Bumped roughly 15% across the board — monospace runs visually smaller
  // than a proportional face at the same nominal size.
  size: {
    micro: 12,
    caption: 14,
    body: 16,
    lead: 18,
    title: 23,
    display: 34,
    hero: 46,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  },
} as const;

/** ASCII furniture, used instead of borders and dividers wherever it reads well. */
export const glyph = {
  cursor: '█',
  rule: '─',
  heavyRule: '═',
  bulletOn: '▓',
  bulletOff: '░',
  arrow: '▸',
  check: '✓',
  cross: '✕',
} as const;

/** Repeats a glyph to fill a nominal character width. */
export const rule = (n = 32, g: string = glyph.rule): string => g.repeat(n);
