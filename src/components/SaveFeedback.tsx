import { createPortal } from 'react-dom'
import { pockitFeedbackLift } from '../lib/motion'
import { motion, useReducedMotion } from 'motion/react'
import { Icon } from './UI'
import type { Goal } from '../types'

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'conflict' | 'error'
const syncCopy: Record<SyncStatus, { icon: string; label: string; detail: string }> = {
  saved: {
    icon: 'CloudCheck',
    label: 'Saved to cloud',
    detail: 'Your latest changes have synced.',
  },
  saving: {
    icon: 'CloudUpload',
    label: 'Syncing…',
    detail: 'A pending copy is on this device. Pockit is sending your changes to the cloud.',
  },
  offline: {
    icon: 'CloudOff',
    label: 'Offline · device copy',
    detail: 'Keep using this device. Pockit will try to sync when you reconnect.',
  },
  conflict: {
    icon: 'CloudUpload',
    label: 'Review changes',
    detail: 'Another device has changes. Review both copies before syncing.',
  },
  error: {
    icon: 'CloudOff',
    label: 'Save needs attention',
    detail: 'Read the message below before making more changes.',
  },
}

export function SyncIndicator({ status }: { status: SyncStatus }) {
  const copy = syncCopy[status]
  return (
    <div className={`sync-chip ${status}`} role="status" title={copy.detail}>
      <span className="sync-symbol" key={status} aria-hidden="true">
        <Icon name={copy.icon} size={15} />
      </span>
      <span>{copy.label}</span>
      <span className="sr-only">. {copy.detail}</span>
    </div>
  )
}

/** A single event, with no loop, money amounts, sound, or automatic dismissal. */
export function GoalReached({
  goal,
  onClose,
  floating = false,
}: {
  goal: Pick<Goal, 'name'>
  onClose: () => void
  floating?: boolean
}) {
  const reduce = useReducedMotion()
  const notice = (
    <section
      className={`goal-reached${floating ? ' goal-reached-floating' : ''}`}
      aria-label="Savings goal reached"
    >
      <motion.img
        src="/goal-pocket.svg"
        alt=""
        width={64}
        height={64}
        initial={reduce ? false : { y: 8 }}
        animate={reduce ? { y: 0 } : { y: [8, 0, 0] }}
        transition={pockitFeedbackLift}
      />
      <div role="status">
        <span className="goal-reached-label">Goal reached</span>
        <strong>{goal.name}</strong>
        <small>Your recorded savings reached your target. Nice work.</small>
      </div>
      <button className="icon-button" aria-label="Dismiss goal celebration" onClick={onClose}>
        <Icon name="X" size={18} />
      </button>
    </section>
  )
  return floating ? createPortal(notice, document.body) : notice
}
