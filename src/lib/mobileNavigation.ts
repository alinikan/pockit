export const allMobileTabs = [
  'Home',
  'Activity',
  'Budget',
  'Calendar',
  'Goals',
  'Compare',
  'More',
] as const
export type MobileTab = (typeof allMobileTabs)[number]
const known = new Set<string>(allMobileTabs)

/** Home and More stay reachable even if an older or damaged preference is loaded. */
export function normalizedMobileTabs(saved?: string[]): MobileTab[] {
  if (!Array.isArray(saved)) return [...allMobileTabs]
  const chosen = [...new Set(saved.filter((name) => known.has(name)))] as MobileTab[]
  if (!chosen.includes('Home')) chosen.unshift('Home')
  if (!chosen.includes('More')) chosen.push('More')
  for (const tab of allMobileTabs) {
    if (chosen.length >= 4) break
    if (!chosen.includes(tab)) chosen.splice(chosen.length - 1, 0, tab)
  }
  return chosen
}

export function moveMobileTab(tabs: MobileTab[], tab: MobileTab, direction: -1 | 1) {
  const next = [...tabs]
  const index = next.indexOf(tab)
  const target = index + direction
  if (index < 0 || target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
