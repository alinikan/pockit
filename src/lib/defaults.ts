import type { Category, Goal, PockitData, Transaction } from '../types'
import { currentMonth, shiftMonth } from './finance'

export const categoryPresets = [
  ['Rent', 'House', 'Bills & Utilities', '#a9a3f5', 1500],
  ['Mortgage', 'House', 'Bills & Utilities', '#a9a3f5', 1800],
  ['Groceries', 'ShoppingBasket', 'Food & Dining', '#aee789', 480],
  ['Car Payment', 'Car', 'Transportation', '#f0ae75', 350],
  ['Savings', 'PiggyBank', 'Savings & Goals', '#91d9c0', 300],
  ['Debt Payments', 'CreditCard', 'Savings & Goals', '#f19b96', 200],
  ['Dining Out', 'Utensils', 'Food & Dining', '#f4c586', 180],
  ['Gas', 'Fuel', 'Transportation', '#e7a17a', 160],
  ['Transit', 'TrainFront', 'Transportation', '#93bfe2', 130],
  ['Rideshare', 'CarTaxiFront', 'Transportation', '#e7a17a', 120],
  ['Investments', 'TrendingUp', 'Savings & Goals', '#8ecdb9', 150],
  ['Car Insurance', 'Shield', 'Transportation', '#9fc2ee', 130],
  ['Insurance', 'ShieldCheck', 'Bills & Utilities', '#b7b0ed', 90],
  ['Shopping', 'ShoppingBag', 'Lifestyle', '#efa9ca', 120],
  ['Utilities', 'Zap', 'Bills & Utilities', '#f1d37d', 160],
  ['Entertainment', 'Clapperboard', 'Lifestyle', '#c0a8f5', 80],
  ['Video Games', 'Gamepad2', 'Lifestyle', '#9ab9ef', 40],
  ['Internet', 'Wifi', 'Bills & Utilities', '#99ceec', 80],
  ['Phone', 'Smartphone', 'Bills & Utilities', '#b5d3f1', 65],
  ['Car Maintenance', 'Wrench', 'Transportation', '#e5b68c', 80],
  ['Emergency', 'HeartPulse', 'Savings & Goals', '#eeaaa4', 100],
  ['Subscriptions', 'Repeat2', 'Lifestyle', '#c8b2eb', 60],
  ['Healthcare', 'Heart', 'Lifestyle', '#f0aaa2', 60],
  ['Personal Care', 'Sparkles', 'Lifestyle', '#eeb7d1', 60],
  ['Gym', 'Dumbbell', 'Lifestyle', '#b1d7c5', 50],
  ['Pets', 'PawPrint', 'Lifestyle', '#deb9a4', 60],
  ['Donations', 'HandHeart', 'Lifestyle', '#b8d7a8', 30],
  ['Gifts', 'Gift', 'Lifestyle', '#f3b7ae', 40],
  ['Travel', 'Plane', 'Lifestyle', '#a5c9e9', 100],
  ['Payday Buffer', 'Wallet', 'Savings & Goals', '#b9e48c', 150],
] as const

export const newCategory = (
  name: string,
  icon = 'Shapes',
  group = 'Lifestyle',
  color = '#9bd5c2',
  amount = 0,
  starts = currentMonth(),
): Category => ({
  id: crypto.randomUUID(),
  name,
  icon,
  group,
  color,
  baseAmount: amount,
  changes: {},
  overrides: {},
  starts,
  frequency: 'monthly',
  mode: 'fresh',
  targetType: 'fixed',
  targetValue: amount,
  funding: 'auto',
  notes: '',
})

export const makeInitialData = (name = ''): PockitData => ({
  version: 1,
  onboarded: false,
  profile: {
    name,
    reason: 'See where my money goes',
    payAmount: 0,
    payFrequency: 'biweekly',
    housing: '',
    transport: '',
    extras: [],
  },
  settings: { theme: 'dark', smart: true, currency: 'CAD' },
  categories: [],
  transactions: [],
  goals: [],
  bills: [],
  debtPlan: null,
})

export const buildOnboardedData = (input: PockitData): PockitData => {
  const month = currentMonth()
  const housing =
    input.profile.housing === 'I rent'
      ? 'Rent'
      : input.profile.housing === 'I own a home'
        ? 'Mortgage'
        : ''
  const transport =
    input.profile.transport === 'Car'
      ? ['Car Payment', 'Gas', 'Car Insurance', 'Car Maintenance']
      : input.profile.transport === 'Public transit'
        ? ['Transit']
        : input.profile.transport === 'Rideshare or taxi'
          ? ['Rideshare']
          : []
  const selected = new Set([
    'Groceries',
    'Dining Out',
    'Utilities',
    'Phone',
    'Subscriptions',
    'Emergency',
    ...input.profile.extras,
    ...transport,
  ])
  if (housing) selected.add(housing)
  if (input.profile.reason === 'Get out of debt') selected.add('Debt Payments')
  if (input.profile.reason === 'Save for something big') selected.add('Savings')
  if (input.profile.reason === 'Stop living paycheque to paycheque') selected.add('Payday Buffer')
  if (input.profile.reason === 'See where my money goes') {
    selected.add('Shopping')
    selected.add('Entertainment')
  }
  const categories = [...selected].map((name) => {
    const preset = categoryPresets.find((p) => p[0] === name)
    const category = newCategory(
      name,
      preset?.[1],
      preset?.[2],
      preset?.[3],
      preset?.[4] || 0,
      month,
    )
    if (
      [
        'Savings',
        'Emergency',
        'Car Maintenance',
        'Travel',
        'Investments',
        'Payday Buffer',
      ].includes(name)
    )
      category.mode = 'rollover'
    return category
  })
  return { ...input, onboarded: true, categories }
}

export const makeDemoData = (): PockitData => {
  const month = currentMonth()
  const previous = shiftMonth(month, -1)
  const base = makeInitialData('Alex')
  const categories = categoryPresets
    .slice(0, 19)
    .map((p) => newCategory(p[0], p[1], p[2], p[3], p[4], previous))
  for (const c of categories)
    if (['Savings', 'Car Maintenance', 'Emergency'].includes(c.name)) c.mode = 'rollover'
  const id = (name: string) => categories.find((c) => c.name === name)?.id
  const t = (
    date: string,
    payee: string,
    amount: number,
    type: Transaction['type'],
    category?: string,
  ): Transaction => ({
    id: crypto.randomUUID(),
    date,
    payee,
    amount,
    type,
    categoryId: category ? id(category) : undefined,
  })
  const txs: Transaction[] = [
    t(`${month}-01`, 'Paycheque', 2900, 'income'),
    t(`${month}-15`, 'Paycheque', 2900, 'income'),
    t(`${month}-01`, 'Rent', 1500, 'expense', 'Rent'),
    t(`${month}-03`, 'Fresh Market', 118.42, 'expense', 'Groceries'),
    t(`${month}-04`, 'Shell', 72.35, 'expense', 'Gas'),
    t(`${month}-06`, 'Coffee House', 12.8, 'expense', 'Dining Out'),
    t(`${month}-08`, 'Phone bill', 65, 'expense', 'Phone'),
    t(`${month}-10`, 'Netflix', 18.99, 'expense', 'Subscriptions'),
    t(`${month}-12`, 'Costco', 154.65, 'expense', 'Groceries'),
    t(`${month}-14`, 'Electricity', 128, 'expense', 'Utilities'),
    t(`${month}-16`, 'Car payment', 350, 'expense', 'Car Payment'),
    t(`${month}-17`, 'Dining Out', 48.2, 'expense', 'Dining Out'),
    t(`${month}-18`, 'Savings transfer', 300, 'transfer', 'Savings'),
    t(`${month}-19`, 'Superstore', 132.1, 'expense', 'Groceries'),
    t(`${previous}-10`, 'Netflix', 18.99, 'expense', 'Subscriptions'),
    t(`${previous}-01`, 'Paycheque', 2900, 'income'),
    t(`${previous}-15`, 'Paycheque', 2900, 'income'),
    t(`${previous}-01`, 'Rent', 1500, 'expense', 'Rent'),
    t(`${previous}-05`, 'Groceries', 540, 'expense', 'Groceries'),
    t(`${previous}-12`, 'Dining Out', 250, 'expense', 'Dining Out'),
  ]
  const goals: Goal[] = [
    {
      id: crypto.randomUUID(),
      kind: 'saving',
      name: 'Emergency fund',
      balance: 2350,
      target: 6000,
      monthly: 300,
      annualInterest: 2,
      color: '#bdf26c',
      icon: 'ShieldCheck',
      history: [{ date: `${month}-18`, amount: 300, note: 'Monthly contribution' }],
    },
    {
      id: crypto.randomUUID(),
      kind: 'debt',
      name: 'Credit card',
      balance: 1850,
      target: 0,
      monthly: 175,
      annualInterest: 19.99,
      color: '#f29a91',
      icon: 'CreditCard',
      history: [],
    },
  ]
  return {
    ...base,
    onboarded: true,
    profile: {
      name: 'Alex',
      reason: 'See where my money goes',
      payAmount: 2900,
      payFrequency: 'twice-monthly',
      housing: 'I rent',
      transport: 'Car',
      extras: [],
    },
    categories,
    transactions: txs,
    goals,
    bills: [
      {
        id: crypto.randomUUID(),
        name: 'Rent',
        amount: 1500,
        day: 1,
        categoryId: id('Rent'),
        paidMonths: [month],
      },
      {
        id: crypto.randomUUID(),
        name: 'Internet',
        amount: 80,
        day: 24,
        categoryId: id('Internet'),
        paidMonths: [],
      },
      {
        id: crypto.randomUUID(),
        name: 'Car insurance',
        amount: 130,
        day: 28,
        categoryId: id('Car Insurance'),
        paidMonths: [],
      },
    ],
  }
}
