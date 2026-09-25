// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { makeInitialData } from '../lib/defaults'
import { answer, Coach, insightCards, openingMessage, type InsightMessage } from './Coach'

afterEach(cleanup)

describe('Pockit Insights', () => {
  it('compares the same part of an open month and warns when entries are sparse', () => {
    const data = makeInitialData()
    data.transactions = [
      { id: 'old', date: '2026-08-01', payee: 'Market', amount: 20, type: 'expense' },
      { id: 'new', date: '2026-09-01', payee: 'Market', amount: 30, type: 'expense' },
    ]
    const reply = answer('Compare my spending to last month', data, '2026-09')
    expect(reply).toMatch(/\$10 more/)
    expect(reply).toMatch(/few entries/)
  })

  it('does not invent savings advice when there are no spending entries', () => {
    expect(answer('Where can I cut spending?', makeInitialData(), '2026-09')).toMatch(
      /Add a few expenses/,
    )
    expect(insightCards(makeInitialData(), '2026-09')[0]).toMatchObject({
      tone: 'neutral',
      title: 'Start with one expense',
    })
  })

  it('shows debt interest and an honest projection warning', () => {
    const data = makeInitialData()
    data.goals = [
      {
        id: 'debt',
        name: 'Credit card',
        kind: 'debt',
        balance: 1000,
        target: 0,
        monthly: 5,
        annualInterest: 24,
        color: '#ffaaaa',
        icon: 'CreditCard',
        history: [],
      },
    ]
    const reply = answer('Will my debt payments cover interest?', data, '2026-09')
    expect(reply).toMatch(/Estimated first-month interest \$20/)
    expect(reply).toMatch(/Payment does not cover interest/)
    expect(insightCards(data, '2026-09')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tone: 'attention', title: expect.stringMatching(/Credit card/) }),
      ]),
    )
  })

  it('keeps messages when the panel closes and allows an explicit clear', () => {
    function Wrapper() {
      const [open, setOpen] = useState(true)
      const [messages, setMessages] = useState<InsightMessage[]>([openingMessage])
      return (
        <>
          <button onClick={() => setOpen(true)}>Open insights</button>
          {open && (
            <Coach
              data={makeInitialData()}
              month="2026-09"
              onClose={() => setOpen(false)}
              messages={messages}
              setMessages={setMessages}
            />
          )}
        </>
      )
    }
    render(<Wrapper />)
    fireEvent.click(screen.getByRole('button', { name: 'How am I doing this month?' }))
    expect(document.querySelectorAll('.chat-bubble.user')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close coach' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open insights' }))
    expect(document.querySelectorAll('.chat-bubble.user')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }))
    expect(document.querySelectorAll('.chat-bubble.user')).toHaveLength(0)
  })
})
