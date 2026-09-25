import { describe, expect, it } from 'vitest'
import { allMobileTabs, moveMobileTab, normalizedMobileTabs } from './mobileNavigation'

describe('mobile navigation preferences', () => {
  it('defaults to every page and repairs an outdated or incomplete selection', () => {
    expect(normalizedMobileTabs()).toEqual(allMobileTabs)
    const repaired = normalizedMobileTabs(['Compare', 'Compare', 'unknown'])
    expect(repaired).toEqual(['Home', 'Compare', 'Activity', 'More'])
    expect(new Set(repaired).size).toBe(repaired.length)
  })
  it('moves a selected tab without mutating the saved list', () => {
    const tabs = normalizedMobileTabs(['Home', 'Calendar', 'Goals', 'More'])
    expect(moveMobileTab(tabs, 'Goals', -1)).toEqual(['Home', 'Goals', 'Calendar', 'More'])
    expect(tabs).toEqual(['Home', 'Calendar', 'Goals', 'More'])
    expect(moveMobileTab(tabs, 'Home', -1)).toEqual(tabs)
  })
})
