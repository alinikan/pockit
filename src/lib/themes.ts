import type { PockitData } from '../types'

export type Palette = NonNullable<PockitData['settings']['palette']>

export const palettes: {
  id: Palette
  name: string
  description: string
  swatches: [string, string, string]
}[] = [
  {
    id: 'pockit',
    name: 'Pockit Iris',
    description: 'Deep ink with a clear periwinkle glow.',
    swatches: ['#101323', '#1b2136', '#b9b4ff'],
  },
  {
    id: 'garden',
    name: 'Pockit Garden',
    description: 'The original leafy green look.',
    swatches: ['#0c1515', '#172524', '#c8f184'],
  },
  {
    id: 'waypoint',
    name: 'Coral Slate',
    description: 'Deep slate, coral highlights and crisp surfaces.',
    swatches: ['#111827', '#202d3d', '#ffaf9b'],
  },
  {
    id: 'ocean',
    name: 'Pacific',
    description: 'Ink blue with a bright coastal blue.',
    swatches: ['#0d1928', '#192c40', '#8bd5ff'],
  },
  {
    id: 'plum',
    name: 'Afterglow',
    description: 'Soft plum with lavender highlights.',
    swatches: ['#1b1425', '#2d2239', '#dfb8ff'],
  },
]

export const themeBackground = (palette: Palette, mode: 'dark' | 'light') => {
  if (mode === 'light')
    return {
      pockit: '#f6f6fc',
      garden: '#f5f7f1',
      waypoint: '#f7f8fb',
      ocean: '#f3f8fc',
      plum: '#faf6fc',
    }[palette]
  return {
    pockit: '#101323',
    garden: '#0c1515',
    waypoint: '#111827',
    ocean: '#0d1928',
    plum: '#1b1425',
  }[palette]
}
