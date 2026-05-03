// Tokens Reis Magos — espelha design-reference/styles/colors_and_type.css.
// A fonte de verdade visual é o CSS; este arquivo expõe as mesmas tokens
// para Tailwind config e consumo programático.

export const colors = {
  // Brand core
  green: '#004125',
  green2: '#002e19',
  greenBr: '#1a6b40',
  red: '#aa0000',
  red2: '#7a0000',
  gold: '#b8902e',
  basil: '#2d5a3a',

  // Paper / neutrals
  paper: '#efe4c9',
  paper2: '#e4d6b5',
  cream: '#f6ecd3',
  ink: '#0a1a10',
  ink2: '#14261a',
  ink3: '#2d3a30',
  mid: '#5a6659',
  silt: '#b8b09a',
  white: '#ffffff',
} as const;

export const rules = {
  hairline: 'rgba(10, 26, 16, .16)',
  strong: 'rgba(10, 26, 16, .36)',
} as const;

export const fontFamily = {
  display: ['Glitten', '"Playfair Display"', 'Georgia', 'serif'],
  displayCaps: ['"Glitten All Caps"', 'Glitten', 'Georgia', 'serif'],
  body: ['Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
} as const;

export const fontSize = {
  display: '88px',
  h1: '56px',
  h2: '36px',
  h3: '28px',
  h4: '22px',
  body: '17px',
  bodySm: '15px',
  caption: '13px',
  eyebrow: '12px',
  micro: '10px',
} as const;

export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '24px',
  6: '32px',
  7: '48px',
  8: '64px',
  9: '96px',
} as const;

export const radii = {
  0: '0px',
  1: '2px',
  2: '4px',
  pill: '999px',
} as const;

export const shadows = {
  card: '0 1px 0 rgba(10,26,16,.04)',
  lift: '0 18px 40px -16px rgba(22,17,16,.35)',
  focus: '0 0 0 3px rgba(0, 65, 37, .18)',
} as const;

export const motion = {
  easeWarm: 'cubic-bezier(.2,.7,.2,1)',
  durFast: '120ms',
  durBase: '180ms',
  durSlow: '320ms',
} as const;
