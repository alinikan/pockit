import { useEffect, useState } from 'react'
import { Icon, Modal } from './UI'

export type GuideTopic = 'Home' | 'Activity' | 'Budget' | 'Calendar' | 'Goals' | 'Compare' | 'More'
const guides: Record<
  GuideTopic,
  { icon: string; title: string; message: string; example: string; tone: string }[]
> = {
  Home: [
    {
      icon: 'House',
      title: 'Your month at a glance',
      message:
        'The big monthly figure is planned income minus expenses entered for the selected month. It is a plan, not your bank balance.',
      example:
        'Example: $4,000 planned income and $1,200 recorded spending leaves $2,800 in the monthly view.',
      tone: 'lime',
    },
    {
      icon: 'Wallet',
      title: 'Until your next paycheque',
      message:
        'Add a starting balance or manual chequing account. Pockit subtracts unpaid bills due before payday and shows when that balance was last checked.',
      example:
        'If the balance is old or a purchase is missing, refresh it before relying on the estimate.',
      tone: 'blue',
    },
    {
      icon: 'Waves',
      title: 'A tiny weekly reset',
      message:
        'Use Pockit Pulse to review transactions, upcoming bills, and any categories that need an adjustment.',
      example: 'A five-minute review each week can prevent month-end surprises.',
      tone: 'peach',
    },
    {
      icon: 'SlidersHorizontal',
      title: 'Make Home your own',
      message:
        'Use Customize Home to hide sections you do not need and move important ones closer to the top. Reset layout brings them all back.',
      example: 'Put spending and categories first when you are checking purchases every day.',
      tone: 'blue',
    },
  ],
  Activity: [
    {
      icon: 'ReceiptText',
      title: 'What counts as spending?',
      message:
        'Purchases are expenses. Money from work is income. Moving money between your own accounts, including a credit-card payment, is a transfer.',
      example:
        'A $40 card purchase counts once as spending. Paying the card later moves money; it is not another $40 expense.',
      tone: 'peach',
    },
    {
      icon: 'ListFilter',
      title: 'Review before trusting imports',
      message:
        'Imported items wait in To review. Check the account, category, and possible duplicates before approving.',
      example:
        'Two $8 coffees on one day might both be real, so Pockit asks rather than silently deleting one.',
      tone: 'blue',
    },
    {
      icon: 'Tags',
      title: 'Split and remember',
      message:
        'Split one purchase between categories, add searchable tags, or teach Pockit a category rule for a merchant you visit often. Review those rules in More.',
      example:
        'A $70 store receipt can be $50 Groceries and $20 Personal Care. Add a “work” tag if you need to find it later.',
      tone: 'lime',
    },
    {
      icon: 'ArrowDownLeft',
      title: 'When money comes back',
      message:
        'Choose Refund when a store returns money for a purchase. Pockit subtracts it from spending rather than treating it like a paycheque.',
      example: 'A $30 return reduces your net spending by $30.',
      tone: 'blue',
    },
  ],
  Budget: [
    {
      icon: 'ChartPie',
      title: 'A plan for Canadian dollars',
      message:
        'The amount beside each category is what you intend to spend or set aside. It is a plan, not money moved in your bank. Planned income may appear before all paycheques arrive.',
      example: 'Plan $400 for groceries, then compare it with actual purchases.',
      tone: 'lime',
    },
    {
      icon: 'Layers3',
      title: 'Start fresh or carry forward',
      message:
        'Start fresh resets the amount each month. Carry forward adds unused money to the next month for less frequent costs.',
      example:
        'Plan $80 a month for car repairs. If you spend nothing, $160 is available after two months.',
      tone: 'blue',
    },
    {
      icon: 'ArrowLeftRight',
      title: 'Cover an overage',
      message:
        'Move part of the money you have not planned yet, or part of another category’s plan. This changes your plan; no money moves at a bank.',
      example: 'Move $25 from Dining Out to Groceries when groceries cost more than expected.',
      tone: 'peach',
    },
  ],
  Calendar: [
    {
      icon: 'CalendarDays',
      title: 'See what is coming',
      message:
        'Add monthly, quarterly, or yearly bills. Calendar shows them on the right days and in Next 7 days.',
      example: 'Put an annual insurance bill in the month it renews.',
      tone: 'blue',
    },
    {
      icon: 'CheckCircle2',
      title: 'Record payment',
      message:
        'Use Record payment when money actually leaves. Pockit creates a matching transaction and removes the bill from upcoming reminders.',
      example:
        'An internet bill is an expense. Paying a credit card is a transfer, because its purchases were counted earlier.',
      tone: 'lime',
    },
    {
      icon: 'Info',
      title: 'Skip is different',
      message:
        'Skip this reminder hides it for the selected month without changing spending. You can restore it later.',
      example: 'Use Skip if a bill was cancelled or does not apply this month.',
      tone: 'peach',
    },
    {
      icon: 'CalendarClock',
      title: 'Give regular bills a date',
      message:
        'When a planned regular cost has no payment day, Calendar offers a shortcut to add its due date. A reminder is still only a plan until you record payment.',
      example:
        'If your phone bill is due on the 15th, add that day and it will appear on the calendar.',
      tone: 'blue',
    },
  ],
  Goals: [
    {
      icon: 'Target',
      title: 'Saving and paying off',
      message:
        'A goal shows your starting balance, target, monthly contribution or payment, and estimated date.',
      example: 'The estimate assumes the same contribution and interest rate each month.',
      tone: 'lime',
    },
    {
      icon: 'CreditCard',
      title: 'Debt plans',
      message:
        'Pay minimums on every debt, then direct extra money to the highest-interest debt, smallest balance, or your custom order.',
      example: 'A higher extra payment can shorten the date, but it must fit your budget.',
      tone: 'peach',
    },
    {
      icon: 'ShieldCheck',
      title: 'Emergency buffer',
      message:
        'Start with a manageable cushion, then build toward a number of months of essential expenses that fits your life.',
      example:
        'Pockit shows one paycheque, one month of planned essentials, and three months as optional checkpoints.',
      tone: 'blue',
    },
  ],
  Compare: [
    {
      icon: 'GitCompareArrows',
      title: 'Compare fairly',
      message:
        'Choose months side by side. When comparing an unfinished month, use the same number of elapsed days for a fairer view.',
      example: 'Compare September 1–15 with August 1–15.',
      tone: 'blue',
    },
    {
      icon: 'Search',
      title: 'Find the cause',
      message:
        'Open a category to see the actual transactions behind its change. Pockit marks comparisons that may be missing data.',
      example: 'A rise in Transport may come from a one-time repair rather than a new habit.',
      tone: 'peach',
    },
    {
      icon: 'ArrowRight',
      title: 'Act on what you learn',
      message:
        'A useful finding should take you to the transaction or budget category that explains it.',
      example: 'Review a recurring charge before changing your monthly plan.',
      tone: 'lime',
    },
  ],
  More: [
    {
      icon: 'Landmark',
      title: 'Manual accounts',
      message:
        'Accounts help keep chequing, savings, credit cards, and cash distinct. Reconcile against the real balance whenever your estimate drifts.',
      example: 'No bank connection is needed to add an account.',
      tone: 'blue',
    },
    {
      icon: 'Download',
      title: 'Your backup',
      message:
        'Download your data as JSON. Restore only after reviewing the backup; Pockit saves your current copy first.',
      example: 'Keep the backup somewhere private because it contains financial details.',
      tone: 'lime',
    },
    {
      icon: 'Fingerprint',
      title: 'Privacy and sign-in',
      message: 'Passkeys can make signing in easier. Hide amounts when using Pockit around others.',
      example: 'A passkey does not itself lock a session that is already open.',
      tone: 'peach',
    },
    {
      icon: 'Smartphone',
      title: 'Your bottom tabs',
      message:
        'On iPhone, choose which shortcuts stay along the bottom. Search at the top still opens every page, and Home and More always remain available.',
      example: 'Keep Calendar and Goals in the bar if you use them often; move Compare to Search.',
      tone: 'blue',
    },
  ],
}

export function Guide({ topic, onClose }: { topic: GuideTopic; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [topic])
  const item = guides[topic][index]
  return (
    <Modal title={`${topic} guide`} onClose={onClose}>
      <div className="guide-body">
        <div className="guide-progress" aria-label={`Step ${index + 1} of ${guides[topic].length}`}>
          {guides[topic].map((_, step) => (
            <i key={step} className={step === index ? 'active' : ''} />
          ))}
        </div>
        <div className={`guide-illustration ${item.tone}`}>
          <Icon name={item.icon} size={43} />
          <span className="guide-orbit" />
        </div>
        <span className="eyebrow">
          STEP {index + 1} OF {guides[topic].length}
        </span>
        <h3>{item.title}</h3>
        <p>{item.message}</p>
        <div className="guide-example">
          <Icon name="Sparkles" size={18} />
          <span>{item.example}</span>
        </div>
        <div className="guide-actions">
          <button
            className="secondary-button"
            onClick={() => (index ? setIndex(index - 1) : onClose())}
          >
            {index ? 'Back' : 'Maybe later'}
          </button>
          <button
            className="primary-button"
            onClick={() => (index + 1 < guides[topic].length ? setIndex(index + 1) : onClose())}
          >
            {index + 1 < guides[topic].length ? 'Next' : 'Got it'}{' '}
            <Icon name="ArrowRight" size={16} />
          </button>
        </div>
      </div>
    </Modal>
  )
}
