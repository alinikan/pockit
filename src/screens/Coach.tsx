import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { MonthKey, PockitData } from '../types'
import {
  budgetHealth,
  billsForMonth,
  categoryBudget,
  currentMonth,
  money,
  projectGoal,
  projectionText,
  recurringMerchants,
  shiftMonth,
  spendingByCategory,
} from '../lib/finance'
import { monthSnapshot } from '../lib/compare'
import { Icon } from '../components/UI'

const suggestions = [
  'How am I doing this month?',
  'Where can I cut spending?',
  'How are my goals doing?',
  'Compare my spending to last month',
  'What bills are still due?',
  'Will my debt payments cover interest?',
]
export type InsightMessage = { role: 'user' | 'coach'; text: string }
export const openingMessage: InsightMessage = {
  role: 'coach',
  text: 'Ask about spending, bills, pay, or a goal. I’ll use your Pockit entries and say when there is not enough information yet.',
}
export function insightCards(data: PockitData, month: MonthKey) {
  const health = budgetHealth(data, month)
  const entries = data.transactions.filter(
    (entry) => entry.type === 'expense' && entry.date.startsWith(month),
  )
  const cards: {
    tone: 'attention' | 'good' | 'neutral'
    title: string
    text: string
    icon: string
  }[] = []
  if (!entries.length)
    cards.push({
      tone: 'neutral',
      title: 'Start with one expense',
      text: 'Record a purchase in Activity to make spending insights useful.',
      icon: 'ReceiptText',
    })
  else if (health.trouble.length)
    cards.push({
      tone: 'attention',
      title: `${health.trouble.length} ${health.trouble.length === 1 ? 'category' : 'categories'} past plan`,
      text: `Check ${health.trouble[0].name} first. Review its entries before changing your limit.`,
      icon: 'TrendingUp',
    })
  else
    cards.push({
      tone: 'good',
      title: 'No category past plan',
      text: `${entries.length} expense ${entries.length === 1 ? 'entry' : 'entries'} recorded for ${month}.`,
      icon: 'CheckCircle2',
    })
  const day = month === currentMonth() ? new Date().getDate() : 1
  const nextBill =
    month < currentMonth()
      ? undefined
      : billsForMonth(data.bills, month)
          .filter((bill) => !bill.paid && !bill.skipped && bill.day >= day)
          .sort((first, second) => first.day - second.day)[0]
  if (nextBill)
    cards.push({
      tone: 'neutral',
      title: `Next bill: ${nextBill.name}`,
      text: `${money(nextBill.amount, data.settings.currency, true)} planned for day ${nextBill.day}. Record it only when paid.`,
      icon: 'CalendarClock',
    })
  const stalledDebt = data.goals.find(
    (goal) =>
      goal.kind === 'debt' &&
      goal.balance > 0 &&
      !goal.interestUnknown &&
      goal.monthly <= projectGoal(goal).monthlyInterest,
  )
  if (stalledDebt)
    cards.push({
      tone: 'attention',
      title: `${stalledDebt.name} needs a closer look`,
      text: `The planned payment does not cover the estimated monthly interest. Review its rate and payment in Goals.`,
      icon: 'TrendingDown',
    })
  return cards.slice(0, 3)
}
export function answer(question: string, data: PockitData, month: MonthKey) {
  const q = question.toLowerCase().trim()
  const currency = data.settings.currency
  const health = budgetHealth(data, month)
  const previous = shiftMonth(month, -1)
  const expenseCount = data.transactions.filter(
    (transaction) => transaction.type === 'expense' && transaction.date.startsWith(month),
  ).length
  if (/last month|compare|previous/.test(q)) {
    const throughDay = month === currentMonth() ? new Date().getDate() : undefined
    const before = monthSnapshot(data, previous, throughDay)
    const after = monthSnapshot(data, month, throughDay)
    if (!before.expenseCount || !after.expenseCount)
      return `I need spending entries in both ${previous} and ${month} to make a comparison. Add the missing month in Activity.`
    const change = after.spent - before.spent
    const direction = change > 0 ? 'more' : change < 0 ? 'less' : 'the same'
    const limit = Math.min(before.expenseCount, after.expenseCount)
    return `${month}: ${money(after.spent, currency, true)} spent${throughDay ? ` through day ${throughDay}` : ''}. ${previous}: ${money(before.spent, currency, true)} over the same days. That is ${change === 0 ? 'no change' : `${money(Math.abs(change), currency, true)} ${direction}`}. ${limit < 3 ? 'There are few entries in at least one month, so check for anything missing.' : 'Open Compare to see which categories and payees changed.'}`
  }
  if (/goal|saving|debt|credit card|payoff|interest/.test(q)) {
    const named = data.goals.find((g) => q.includes(g.name.toLowerCase()))
    const goals = named ? [named] : data.goals
    if (!goals.length)
      return 'You haven’t added a goal yet. Open Goals, add something you’re saving for or paying off, and I can help you track it.'
    return goals
      .slice(0, 3)
      .map((g) => {
        const estimate = projectGoal(g)
        if (g.kind === 'debt')
          return `${g.name}: ${money(g.balance, currency, true)} owed. Planned payment ${money(g.monthly, currency, true)}/month.${g.interestUnknown ? ' Add its interest rate for a payoff estimate.' : ` Estimated first-month interest ${money(estimate.monthlyInterest, currency, true)}. ${projectionText(g)}.`}`
        return `${g.name}: ${money(g.balance, currency, true)} of ${money(g.target, currency, true)} saved. Adding ${money(g.monthly, currency, true)}/month: ${projectionText(g).toLowerCase()}.`
      })
      .join(' ')
  }
  if (/cut|save money|reduce|overspend|trouble|subscription/.test(q)) {
    const spending = spendingByCategory(data.transactions, month)
    if (!expenseCount)
      return 'Add a few expenses in Activity first. Then I can spot patterns in your actual spending.'
    const over = health.trouble
      .map((category) => ({
        name: category.name,
        excess: (spending[category.id] || 0) - categoryBudget(category, month, health.income),
      }))
      .filter((item) => item.excess > 0)
      .sort((a, b) => b.excess - a.excess)[0]
    const flexible = data.categories
      .filter(
        (category) =>
          ['Food & Dining', 'Lifestyle'].includes(category.group) &&
          (spending[category.id] || 0) > 0,
      )
      .sort((a, b) => (spending[b.id] || 0) - (spending[a.id] || 0))[0]
    const repeats = recurringMerchants(data.transactions).slice(0, 2)
    return [
      over
        ? `${over.name} is ${money(over.excess, currency, true)} over its plan. Check those transactions for an entry to correct or a limit to reconsider.`
        : 'No category with recorded spending is over its plan.',
      flexible
        ? `${flexible.name} is your largest flexible category at ${money(spending[flexible.id], currency, true)}. Review its payees before deciding whether to change spending.`
        : 'I cannot identify a flexible category to cut from these entries yet.',
      repeats.length
        ? `${repeats.join(' and ')} ${repeats.length === 1 ? 'looks' : 'look'} monthly in your history; check whether you still use ${repeats.length === 1 ? 'it' : 'them'}.`
        : '',
    ]
      .filter(Boolean)
      .join(' ')
  }
  if (/income|paycheque|paycheck/.test(q))
    return `Your expected take-home pay for ${month} is ${money(health.income, currency, true)}. You have assigned ${money(health.allocated, currency, true)} to categories. ${health.unallocated < 0 ? `That is ${money(Math.abs(health.unallocated), currency, true)} more than expected pay; review your plan in Budget.` : `${money(health.unallocated, currency, true)} remains unassigned.`} Calendar shows the dates behind a weekly or biweekly estimate.`
  if (/bill|due|upcoming/.test(q)) {
    const bills = billsForMonth(data.bills, month)
      .filter((b) => !b.paid && !b.skipped)
      .sort((a, b) => a.day - b.day)
    return bills.length
      ? `${bills.length} unpaid ${bills.length === 1 ? 'bill reminder' : 'bill reminders'} in ${month}, totalling ${money(
          bills.reduce((sum, bill) => sum + bill.amount, 0),
          currency,
          true,
        )}. To check: ${bills
          .slice(0, 3)
          .map((b) => `${b.name} ${money(b.amount, currency, true)} on day ${b.day}`)
          .join('; ')}. These are planned, not confirmed payments.`
      : `There are no unpaid bill reminders in ${month}. Check Calendar for expected pay and recorded activity.`
  }
  if (/how am i|this month|overview|summary|doing/.test(q))
    return expenseCount
      ? `For ${month}, expected pay is ${money(health.income, currency, true)} and recorded spending is ${money(health.spent, currency, true)} across ${expenseCount} entries. Your plan has ${money(health.remaining, currency, true)} remaining.${health.trouble.length ? ` ${health.trouble.length} ${health.trouble.length === 1 ? 'category is' : 'categories are'} past plan; ask where you can cut spending to inspect them.` : ' No category is past plan.'} This is a budget estimate, not a bank balance.`
      : `For ${month}, you have no recorded expenses yet. Your expected pay is ${money(health.income, currency, true)}. Add transactions in Activity to get a meaningful spending picture.`
  return `I can check spending, income, bills, or a named goal for ${month}. Try a suggestion below or ask “Where can I cut spending?”`
}
export function Coach({
  data,
  month,
  onClose,
  messages,
  setMessages,
}: {
  data: PockitData
  month: MonthKey
  onClose: () => void
  messages: InsightMessage[]
  setMessages: Dispatch<SetStateAction<InsightMessage[]>>
}) {
  const [input, setInput] = useState('')
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null)
  useEffect(() => {
    const visual = window.visualViewport
    if (!visual) return
    const updateViewport = () =>
      setViewport(
        window.innerWidth <= 760 ? { height: visual.height, top: visual.offsetTop } : null,
      )
    updateViewport()
    visual.addEventListener('resize', updateViewport)
    visual.addEventListener('scroll', updateViewport)
    window.addEventListener('resize', updateViewport)
    return () => {
      visual.removeEventListener('resize', updateViewport)
      visual.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
    }
  }, [])
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
      style={viewport ? { height: viewport.height, top: viewport.top, bottom: 'auto' } : undefined}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="coach-panel" role="dialog" aria-modal="true" aria-label="Pockit Insights">
        <div className="coach-header">
          <div className="coach-avatar">
            <Icon name="Sparkles" size={23} />
          </div>
          <div>
            <strong>Pockit Insights</strong>
            <small>Guided answers from your entries</small>
          </div>
          <button
            className="coach-clear"
            onClick={() => setMessages([openingMessage])}
            disabled={messages.length === 1}
          >
            Clear chat
          </button>
          <button className="icon-button" aria-label="Close coach" onClick={onClose}>
            <Icon name="X" />
          </button>
        </div>
        <div className="coach-messages">
          <div className="coach-live" aria-label="Live insights from your entries">
            <strong>RIGHT NOW · {month}</strong>
            {insightCards(data, month).map((card) => (
              <div className={`coach-live-card ${card.tone}`} key={card.title}>
                <Icon name={card.icon} size={17} />
                <span>
                  <b>{card.title}</b>
                  <small>{card.text}</small>
                </span>
              </div>
            ))}
          </div>
          {messages.map((m, i) => (
            <div className={`chat-bubble ${m.role}`} key={i}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="coach-bottom">
          <div className="coach-suggestions">
            {suggestions.map((s) => (
              <button key={s} onClick={() => ask(s)}>
                {s} <Icon name="ArrowUpRight" size={14} />
              </button>
            ))}
          </div>
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
              aria-label="Ask Pockit Insights"
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
