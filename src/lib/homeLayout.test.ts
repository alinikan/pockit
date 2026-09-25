import { describe, expect, it } from 'vitest'
import { homeSections, moveHomeSection, normalizedHomeOrder } from './homeLayout'

describe('home layout', () => {
  it('keeps saved positions, removes duplicates and unknown cards, and includes new cards', () => {
    const order = normalizedHomeOrder(['trends', 'today', 'trends', 'deleted-card'])
    expect(order.slice(0, 2)).toEqual(['trends', 'today'])
    expect(order).toHaveLength(homeSections.length)
    expect(new Set(order).size).toBe(homeSections.length)
  })
  it('moves one card at a time without crossing an edge', () => {
    const order = normalizedHomeOrder()
    expect(moveHomeSection(order, 'today', -1)).toEqual(order)
    const changed = moveHomeSection(order, 'pulse', -1)
    expect(changed.slice(0, 2)).toEqual(['pulse', 'today'])
    expect(order.slice(0, 2)).toEqual(['today', 'pulse'])
  })
})
