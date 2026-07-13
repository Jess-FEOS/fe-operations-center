import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'fe-blue': '#0762C8',
        'fe-navy': '#1B365D',
        'fe-gold': '#B29838',
        'fe-tan': '#D9C58D',
        'fe-blue-gray': '#647692',
        'fe-anthracite': '#3F4444',
        'fe-offwhite': '#F8F9FB',
        'fe-green': '#046A38',
        'fe-red': '#C8350D',
        'fe-teal': '#437F94',
      },
      fontFamily: {
        barlow: ['Barlow', 'sans-serif'],
        fira: ['Fira Sans', 'sans-serif'],
      },
      // Editorial redesign: square corners everywhere. Every rounded-* utility
      // (sm/md/lg/xl/2xl/3xl) collapses to 0. 'full' is preserved intentionally
      // for avatars, status dots and pills. 'DEFAULT' also 0 so bare `rounded` = square.
      borderRadius: {
        none: '0px',
        sm: '0px',
        DEFAULT: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '9999px',
      },
      // Editorial neutrals used for the hairline-border panel system.
      borderColor: {
        'fe-line': '#E4E7EC',
        'fe-line-strong': '#D0D5DD',
      },
      boxShadow: {
        // Replace soft floating shadows with a single, barely-there editorial shadow.
        'fe-panel': '0 1px 0 0 #E4E7EC',
        'fe-raise': '0 1px 2px 0 rgba(16,24,40,0.06)',
      },
    },
  },
  plugins: [],
}
export default config
