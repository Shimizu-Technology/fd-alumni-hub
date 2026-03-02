// tailwind.config.ts (snippet)
// import type { Config } from 'tailwindcss'

export const fdThemeExtend = {
  colors: {
    brand: {
      maroon: '#670F26',
      gold: '#D7B885',
      ink: '#1F2321',
      cream: '#F7F5F1',
    },
    neutralx: {
      900: '#222222',
      700: '#4B4B4B',
      500: '#7A7A7A',
      300: '#D0D0D0',
      100: '#F1F0F3',
    },
    status: {
      live: '#C53030',
      upcoming: '#670F26',
      final: '#4B4B4B',
      success: '#1F8A4C',
      warning: '#B7791F',
      error: '#C53030',
      info: '#2B6CB0',
    },
  },
  fontFamily: {
    heading: ['Sora', 'sans-serif'],
    body: ['Geist', 'sans-serif'],
  },
  borderRadius: {
    fdsm: '10px',
    fdmd: '12px',
    fdlg: '14px',
  },
  boxShadow: {
    fd: '0 4px 18px rgba(31,35,33,0.08)',
    'fd-hover': '0 10px 26px rgba(31,35,33,0.12)',
  },
}
