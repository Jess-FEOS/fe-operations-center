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
    },
  },
  plugins: [],
}
export default config
