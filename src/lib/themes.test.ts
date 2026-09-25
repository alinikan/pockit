import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { palettes, themeBackground } from './themes'

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
const blocks = [...css.matchAll(/(:root(?:\[[^\]]+\])*)\s*\{([^}]+)\}/g)]
const variables = (selector: string) =>
  Object.fromEntries(
    [
      ...(blocks.find((block) => block[1] === selector)?.[2] || '').matchAll(
        /(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g,
      ),
    ].map((match) => [match[1], match[2]]),
  )
const rgb = (hex: string) => {
  const full =
    hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join('')}` : hex
  return [1, 3, 5].map((start) => parseInt(full.slice(start, start + 2), 16) / 255)
}
const luminance = (hex: string) =>
  rgb(hex)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (first: string, second: string) => {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

describe('colour themes', () => {
  it('has a readable surface, secondary text, and accent in every mode', () => {
    for (const palette of palettes)
      for (const mode of ['dark', 'light'] as const) {
        const tokens = {
          ...variables(':root'),
          ...(mode === 'light' ? variables(":root[data-theme='light']") : {}),
          ...(palette.id === 'pockit'
            ? {}
            : variables(`:root[data-palette='${palette.id}'][data-theme='${mode}']`)),
        }
        expect(
          contrast(tokens['--text'], tokens['--surface']),
          `${palette.id} ${mode} main text`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrast(tokens['--muted'], tokens['--surface']),
          `${palette.id} ${mode} secondary text`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrast(tokens['--lime'], tokens['--surface']),
          `${palette.id} ${mode} accent text`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrast(tokens['--on-accent'], tokens['--lime']),
          `${palette.id} ${mode} button text`,
        ).toBeGreaterThanOrEqual(4.5)
        for (const stop of ['--hero-start', '--hero-middle', '--hero-end'])
          expect(
            contrast(tokens['--hero-ink'], tokens[stop]),
            `${palette.id} ${mode} hero ${stop}`,
          ).toBeGreaterThanOrEqual(4.5)
        expect(themeBackground(palette.id, mode)).toBe(tokens['--bg'])
      }
  })
})
