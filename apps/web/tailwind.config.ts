import type { Config } from 'tailwindcss';

// Tokens espelham packages/ui/src/styles/tokens.css (Reis Magos design system).
// Mantenha este arquivo em sincronia com o CSS oficial.

const config: Config = {
  content: [
    './src/**/*.{ts,tsx,mdx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        rm: {
          green: 'var(--rm-green)',
          'green-2': 'var(--rm-green-2)',
          'green-br': 'var(--rm-green-br)',
          red: 'var(--rm-red)',
          'red-2': 'var(--rm-red-2)',
          gold: 'var(--rm-gold)',
          basil: 'var(--rm-basil)',
          paper: 'var(--rm-paper)',
          'paper-2': 'var(--rm-paper-2)',
          cream: 'var(--rm-cream)',
          ink: 'var(--rm-ink)',
          'ink-2': 'var(--rm-ink-2)',
          'ink-3': 'var(--rm-ink-3)',
          mid: 'var(--rm-mid)',
          silt: 'var(--rm-silt)',
        },
        // Semantic
        'fg-1': 'var(--fg-1)',
        'fg-2': 'var(--fg-2)',
        'fg-3': 'var(--fg-3)',
        'fg-accent': 'var(--fg-accent)',
        'fg-alert': 'var(--fg-alert)',
        'fg-gold': 'var(--fg-gold)',
        'bg-0': 'var(--bg-0)',
        'bg-1': 'var(--bg-1)',
        'bg-2': 'var(--bg-2)',
        'bg-ink': 'var(--bg-ink)',
        'bg-green': 'var(--bg-green)',
        'bg-red': 'var(--bg-red)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        'display-caps': ['var(--font-display-caps)'],
        sans: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        display: ['88px', { lineHeight: '0.98', letterSpacing: '-0.015em' }],
        h1: ['56px', { lineHeight: '1.02', letterSpacing: '-0.01em' }],
        h2: ['36px', { lineHeight: '1.1' }],
        h3: ['28px', { lineHeight: '1.15' }],
        h4: ['22px', { lineHeight: '1.2' }],
        body: ['17px', { lineHeight: '1.6' }],
        'body-sm': ['15px', { lineHeight: '1.55' }],
        caption: ['13px', { lineHeight: '1.55' }],
        eyebrow: ['12px', { letterSpacing: '0.22em' }],
        micro: ['10px', { letterSpacing: '0.18em' }],
      },
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '4px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(10,26,16,.04)',
        lift: '0 18px 40px -16px rgba(22,17,16,.35)',
        focus: '0 0 0 3px rgba(0, 65, 37, .18)',
      },
      borderColor: {
        hairline: 'var(--rm-rule)',
        strong: 'var(--rm-rule-strong)',
      },
      transitionTimingFunction: {
        warm: 'var(--ease-warm)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
