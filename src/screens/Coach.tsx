import { useState } from 'react'
import type { MonthKey, PockitData } from '../types'
import {
  budgetHealth,
  categoryBudget,
  money,
  monthSummary,
  projectionText,
  shiftMonth,
  spendingByCategory,
} from '../lib/finance'
import { Icon } from '../components/UI'

const suggestions = [
  'How am I doing this month?',
  'Where can I cut spending?',
  'How are my goals doing?',
  'Compare my spending to last month',
]
function answer(question: string, data: PockitData, month: MonthKey) {
  const q = question.toLowerCase()
  const currency = data.settings.currency
  const health = budgetHealth(data, month)
  const previous = shiftMonth(month, -1)
  const prev = monthSummary(data, previous)
  if (/last month|compare|previous/.test(q)) {
    if (!prev.spent)
      return 'I don’t have spending from last month yet. Add past transactions in Activity and I’ll compare them.'
    const difference = health.spent - prev.spent
    return `You’ve spent ${money(health.spent, currency, true)} this month versus ${money(prev.spent, currency, true)} last month. That’s ${money(Math.abs(difference), currency, true)} ${difference > 0 ? 'more' : 'less'} so far. Compare at the same point in each month for a fairer picture.`
  }
  if (/goal|saving|debt|credit card|payoff/.test(q)) {
    const named = data.goals.find((g) => q.includes(g.name.toLowerCase()))
    const goals = named ? [named] : data.goals
    if (!goals.length)
      return 'You haven’t added a goal yet. Open Goals, add something you’re saving for or paying off, and I can help you track it.'
    return goals
      .map(
        (g) =>
          `${g.name}: ${money(g.balance, currency, true)} ${g.kind === 'debt' ? 'owed' : 'saved'}. At ${money(g.monthly, currency, true)} per month, ${projectionText(g).toLowerCase()}.`,
      )
      .join(' ')
  }
  if (/cut|save money|reduce|overspend|trouble/.test(q)) {
    const spending = spendingByCategory(data.transactions, month)
    const ranked = data.categories
      .filter((c) => spending[c.id] > 0)
      .sort((a, b) => (spending[b.id] || 0) - (spending[a.id] || 0))
    const flexible = ranked
      .filter((c) => ['Food & Dining', 'Lifestyle'].includes(c.group))
      .slice(0, 2)
    if (!ranked.length)
      return 'Add a few expenses in Activity first. Then I can spot patterns in your actual spending.'
    const overs = health.trouble.length
      ? ` ${health.trouble.map((c) => `${c.name} is ${money((spending[c.id] || 0) - categoryBudget(c, month, health.income), currency, true)} over plan`).join('; ')}.`
      : ''
    return `Your largest flexible ${flexible.length === 1 ? 'category is' : 'categories are'} ${flexible.map((c) => `${c.name} (${money(spending[c.id], currency, true)})`).join(' and ') || 'still taking shape'}.${overs} Try a small limit change there before cutting essentials.`
  }
  if (/income|paycheque|paycheck/.test(q))
    return `Your expected monthly take-home pay is ${money(health.income, currency, true)}. You’ve planned ${money(health.allocated, currency, true)} across categories, leaving ${money(health.unallocated, currency, true)} unallocated.`
  if (/bill|due|upcoming/.test(q)) {
    const bills = data.bills
      .filter((b) => !b.paidMonths.includes(month))
      .sort((a, b) => a.day - b.day)
    return bills.length
      ? `Unpaid bills this month: ${bills.map((b) => `${b.name} ${money(b.amount, currency, true)} on day ${b.day}`).join('; ')}. Mark them paid in Calendar once they clear.`
      : 'There are no unpaid bills on your calendar for this month.'
  }
  return `You’ve received or planned ${money(health.income, currency, true)} and spent ${money(health.spent, currency, true)} this month, leaving ${money(health.remaining, currency, true)}. ${health.trouble.length ? `${health.trouble.length} ${health.trouble.length === 1 ? 'category is' : 'categories are'} over plan.` : 'No categories are over plan.'} Ask me about spending, bills, debt, or a goal.`
}
export function Coach({
  data,
  month,
  onClose,
}: {
  data: PockitData
  month: MonthKey
  onClose: () => void
}) {
  const [messages, setMessages] = useState<{ role: 'user' | 'coach'; text: string }[]>([
    {
      role: 'coach',
      text: 'Hi! I’m your Pockit money coach. I use the numbers you’ve entered to help you see what’s happening and what you could try next.',
    },
  ])
  const [input, setInput] = useState('')
  function ask(value: string) {
    const text = value.trim()
    if (!text) return
    setMessages((items) => [
      ...items,
      { role: 'user', text },
      { role: 'coach', text: answer(text, data, month) },
    ])
    setInput('')
  }
  return (
    <div
      className="coach-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="coach-panel" role="dialog" aria-modal="true" aria-label="Pockit Money Coach">
        <div className="coach-header">
          <div className="coach-avatar">
            <Icon name="Sparkles" size={23} />
          </div>
          <div>
            <strong>Money Coach</strong>
            <small>Here to help you find clarity</small>
          </div>
          <button className="icon-button" aria-label="Close coach" onClick={onClose}>
            <Icon name="X" />
          </button>
        </div>
        <div className="coach-messages">
          {messages.map((m, i) => (
            <div className={`chat-bubble ${m.role}`} key={i}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="coach-bottom">
          {messages.length === 1 && (
            <div className="coach-suggestions">
              {suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)}>
                  {s} <Icon name="ArrowUpRight" size={14} />
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              ask(input)
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your money…"
              aria-label="Ask Money Coach"
            />
            <button disabled={!input.trim()} aria-label="Send">
              <Icon name="ArrowUp" size={18} />
            </button>
          </form>
          <small>
            Pockit uses your entered data. It does not connect to your bank or provide professional
            financial advice.
          </small>
        </div>
      </div>
    </div>
  )
}
