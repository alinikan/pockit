export type InsightMessage = { role: 'user' | 'coach'; text: string }

export const openingMessage: InsightMessage = {
  role: 'coach',
  text: 'Ask about spending, bills, pay, or a goal. I’ll use your Pockit entries and say when there is not enough information yet.',
}
