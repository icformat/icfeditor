/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Design tokens are CSS variables (see styles/theme.css) so Tailwind and
      // Monaco can share one palette across light / dark / system themes.
      colors: {
        app: {
          bg: 'var(--app-bg)',
          surface: 'var(--app-surface)',
          'surface-hover': 'var(--app-surface-hover)',
          border: 'var(--app-border)',
          text: 'var(--app-text)',
          muted: 'var(--app-text-muted)',
          accent: 'var(--app-accent)',
          'accent-hover': 'var(--app-accent-hover)',
          error: 'var(--app-error)',
          warning: 'var(--app-warning)',
          info: 'var(--app-info)',
          success: 'var(--app-success)'
        }
      },
      fontFamily: {
        mono: ['var(--app-font-mono)', 'monospace']
      }
    }
  },
  plugins: []
}
