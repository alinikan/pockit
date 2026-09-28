export const homeSections = [
  { id: 'overview', label: 'Money at a glance', description: 'Income, spending, and what remains' },
  { id: 'today', label: 'Your next good move', description: 'Review, bills, and payday' },
  {
    id: 'spending',
    label: 'Spending and categories',
    description: 'What you spent and where it went',
  },
  {
    id: 'planning',
    label: 'Trouble spots and bills',
    description: 'Items that may need attention',
  },
  { id: 'paycheque', label: 'Until payday', description: 'Estimated money after upcoming bills' },
  {
    id: 'trends',
    label: 'Income and expenses',
    description: 'A short monthly comparison',
  },
  { id: 'pulse', label: 'Weekly check-in', description: 'A short reset when you need it' },
] as const

export type HomeSectionId = (typeof homeSections)[number]['id']
const known = new Set<string>(homeSections.map((section) => section.id))

/** Preserve a saved order while admitting new cards added by later app versions. */
export function normalizedHomeOrder(order?: string[]): HomeSectionId[] {
  const saved = Array.isArray(order) ? order : []
  return [
    ...new Set([...saved.filter((id) => known.has(id)), ...homeSections.map((item) => item.id)]),
  ] as HomeSectionId[]
}

export function moveHomeSection(order: HomeSectionId[], id: HomeSectionId, direction: -1 | 1) {
  const next = [...order]
  const index = next.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** Place a section at the position of the section the user dragged onto. */
export function reorderHomeSection(
  order: HomeSectionId[],
  moving: HomeSectionId,
  target: HomeSectionId,
) {
  const from = order.indexOf(moving)
  const to = order.indexOf(target)
  if (from < 0 || to < 0 || from === to) return order
  const next = [...order]
  next.splice(from, 1)
  next.splice(to, 0, moving)
  return next
}
