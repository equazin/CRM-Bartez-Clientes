/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta Bartez
        'green-deep':  '#14532D',
        'green-ink':   '#0B2818',
        'paper':       '#F7F6F2',
        'carbon':      '#1A1D1A',
        'brass':       '#A8893A',
        'mist':        '#E8E6DF',
        'smoke':       '#6B6B6A',

        // Semánticos CSS-var para modo claro/oscuro
        bg:       'var(--bg)',
        surface:  'var(--surface)',
        border:   'var(--border)',
        text:     'var(--text)',
        'text-2': 'var(--text-2)',

        // Etapas pipeline
        stage: {
          prospecto:     '#94A3B8',
          contactado:    '#6B8CAE',
          derivado:      '#5B7FA6',
          alta:          '#B5895A',
          habilitado:    '#5A8A62',
          cotizacion:    '#2D7A4F',
          cliente:       '#14532D',
          inactivo:      '#4A4A4A',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
        xs:    ['12px', '16px'],
        sm:    ['13px', '18px'],
        base:  ['14px', '20px'],
        md:    ['16px', '22px'],
        lg:    ['20px', '28px'],
        xl:    ['24px', '32px'],
        '2xl': ['32px', '40px'],
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
        md: '4px',
        lg: '6px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
}
