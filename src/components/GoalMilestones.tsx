import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Goal } from '../types'
import { goalMilestones } from '../lib/goalMilestones'
import { money } from '../lib/finance'
import { pockitSpring } from '../lib/motion'
import { Icon } from './UI'

export function GoalMilestones({ goal }: { goal: Goal }) {
  const milestones = goalMilestones(goal)
  const [selected, setSelected] = useState<number | null>(null)
  const reduceMotion = useReducedMotion()
  if (!milestones.length) return null
  const next = milestones.find((item) => !item.reached) || milestones.at(-1)!
  const point = milestones.find((item) => item.percent === selected) || next
  return (
    <details className="goal-milestones">
      <summary>
        <span className={`milestone-emblem ${next.reached ? 'complete' : ''}`}>
          <Icon name={next.reached ? 'Check' : 'Flag'} size={18} />
        </span>
        <span>
          <strong>{next.reached ? 'Goal reached' : `Next milestone · ${next.percent}%`}</strong>
          <small>
            {next.reached
              ? 'Your recorded savings reached this target.'
              : `${money(next.remaining)} to the next checkpoint`}
          </small>
        </span>
        <Icon name="ChevronDown" size={17} />
      </summary>
      <div className="milestone-explorer">
        <div
          className="milestone-stops"
          style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))` }}
          role="group"
          aria-label={`${goal.name} milestones`}
        >
          {milestones.map((item) => (
            <motion.button
              key={item.percent}
              type="button"
              aria-pressed={point.percent === item.percent}
              aria-label={`${item.percent}% milestone${item.reached ? ', reached' : ''}`}
              className={item.reached ? 'reached' : ''}
              whileTap={reduceMotion ? undefined : { scale: 0.95 }}
              transition={pockitSpring}
              onClick={() => setSelected(item.percent)}
            >
              <Icon name={item.reached ? 'Check' : 'Flag'} size={15} />
              {item.percent}%
            </motion.button>
          ))}
        </div>
        <div className="milestone-detail" aria-live="polite">
          <motion.img
            src="/goal-pocket.svg"
            alt=""
            width="76"
            height="76"
            animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
            transition={{ duration: 0.5 }}
            key={point.percent}
          />
          <span>
            <small>
              {point.percent === 100 ? 'Your full goal' : `${point.percent}% checkpoint`}
            </small>
            <strong>{money(point.amount)}</strong>
            <span>
              {point.reached
                ? 'Reached with your recorded savings.'
                : `${money(point.remaining)} more${point.months === null ? '. Set a monthly amount to estimate when.' : ` · about ${point.months} ${point.months === 1 ? 'month' : 'months'} at your current plan.`}`}
            </span>
          </span>
        </div>
        <p>
          Checkpoints use your saved balance, monthly amount, and interest rate. Estimates can
          change; this preview does not move or save money.
        </p>
      </div>
    </details>
  )
}
