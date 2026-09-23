import { describe, expect, it } from 'vitest'
import { num, validISODate } from './numbers'

describe('numeric form input', () => {
  it.each([
    ['', 0],
    ['not a number', 0],
    ['-25', 0],
    ['Infinity', 0],
    ['1e309', 0],
    ['25.75', 25.75],
    ['0', 0],
  ])('normalizes %s without saving invalid money', (input, expected) => {
    expect(num(input)).toBe(expected)
  })
})

describe('transaction dates', () => {
  it.each([
    ['2024-02-29', true],
    ['2023-02-29', false],
    ['2026-04-31', false],
    ['2026-12-31', true],
    ['2026-00-01', false],
    ['2026-13-01', false],
    ['2026-01-00', false],
    ['2026-01-32', false],
    ['2026-1-01', false],
    ['', false],
  ])('validates %s as %s', (input, expected) => {
    expect(validISODate(input)).toBe(expected)
  })
})
