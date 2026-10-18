import type { PockitData } from '../types'
import { validISODate } from './numbers'
import { incomeCategories } from './income'
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const optionalDate = (v: unknown) => v === undefined || (typeof v === 'string' && validISODate(v))
const list = (v: unknown, test: (v: Record<string, unknown>) => boolean, max = 200) =>
  v === undefined ||
  (Array.isArray(v) &&
    v.length <= max &&
    new Set(v.map((i) => i?.id)).size === v.length &&
    v.every((i) => object(i) && typeof i.id === 'string' && !!i.id.trim() && test(i)))
export function validateExperienceData(data: PockitData) {
  const settings = data.settings
  if (
    !list(
      settings.entryTemplates,
      (v) =>
        typeof v.name === 'string' &&
        typeof v.payee === 'string' &&
        ['expense', 'income', 'transfer'].includes(String(v.type)) &&
        (v.incomeCategory === undefined ||
          (v.type === 'income' &&
            incomeCategories.some((item) => item.value === v.incomeCategory))) &&
        (v.amount === undefined || amount(v.amount)),
      50,
    )
  )
    throw new Error('This backup contains an invalid entry template.')
  if (
    settings.completeMonths !== undefined &&
    (!Array.isArray(settings.completeMonths) ||
      settings.completeMonths.some((m) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(m)))
  )
    throw new Error('This backup contains invalid month review dates.')
  if (settings.nativeWidgets !== undefined && typeof settings.nativeWidgets !== 'boolean')
    throw new Error('This backup contains an invalid widget setting.')
  if (
    settings.pulseProgress !== undefined &&
    (!object(settings.pulseProgress) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(settings.pulseProgress.month) ||
      !Array.isArray(settings.pulseProgress.steps) ||
      settings.pulseProgress.steps.some(
        (step) => !['activity', 'accounts', 'bills', 'plan'].includes(step),
      ))
  )
    throw new Error('This backup contains invalid review progress.')
  if (
    !list(
      data.projects,
      (v) =>
        typeof v.name === 'string' &&
        amount(v.budget) &&
        optionalDate(v.start) &&
        optionalDate(v.end) &&
        typeof v.start === 'string' &&
        typeof v.end === 'string' &&
        v.end >= v.start &&
        Array.isArray(v.costs) &&
        v.costs.every(
          (cost) =>
            object(cost) &&
            typeof cost.id === 'string' &&
            typeof cost.name === 'string' &&
            amount(cost.amount) &&
            typeof cost.date === 'string' &&
            validISODate(cost.date) &&
            typeof cost.paid === 'boolean',
        ),
    )
  )
    throw new Error('This backup contains an invalid project.')
  if (
    !list(
      data.subscriptions,
      (v) =>
        typeof v.name === 'string' &&
        amount(v.amount) &&
        ['monthly', 'yearly'].includes(String(v.period)) &&
        typeof v.renewalDate === 'string' &&
        validISODate(v.renewalDate) &&
        optionalDate(v.trialEnd) &&
        optionalDate(v.cancelBy) &&
        (v.previousAmount === undefined || amount(v.previousAmount)),
    )
  )
    throw new Error('This backup contains an invalid subscription.')
  const collections = [
    'transactions',
    'categories',
    'goals',
    'bills',
    'accounts',
    'projects',
    'subscriptions',
  ]
  if (
    !list(
      data.changeLog,
      (v) =>
        typeof v.label === 'string' &&
        typeof v.time === 'string' &&
        Number.isFinite(Date.parse(v.time)) &&
        Array.isArray(v.changes) &&
        v.changes.length <= 200 &&
        v.changes.every(
          (change) =>
            object(change) &&
            collections.includes(String(change.collection)) &&
            typeof change.id === 'string' &&
            (change.before === null || (object(change.before) && change.before.id === change.id)) &&
            (change.after === null || (object(change.after) && change.after.id === change.id)),
        ),
      150,
    )
  )
    throw new Error('This backup contains invalid edit history.')
  if (
    data.goals.some(
      (goal) =>
        goal.funding !== undefined &&
        (!Array.isArray(goal.funding) ||
          new Set(goal.funding.map((entry) => entry.accountId)).size !== goal.funding.length ||
          goal.funding.some(
            (entry) =>
              !object(entry) || typeof entry.accountId !== 'string' || !amount(entry.amount),
          )),
    )
  )
    throw new Error('This backup contains invalid goal assignments.')
}
