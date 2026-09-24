import { num } from '../lib/numbers'
import { useEffect, useState } from 'react'
import type { Frequency, Goal, PockitData } from '../types'
import { buildOnboardedData } from '../lib/defaults'
import { money, monthlyPay, projectGoal } from '../lib/finance'
import { Brand, Icon, Progress } from './UI'

const reasons = [
  ['See where my money goes', 'ScanEye', 'Get a clear picture of everyday spending.'],
  ['Stop living paycheque to paycheque', 'Waves', 'Know what is safe to spend before payday.'],
  ['Get out of debt', 'TrendingDown', 'Find a path forward, one payment at a time.'],
  ['Save for something big', 'Flag', 'Turn a someday plan into a date.'],
]
const extraOptions = [
  ['Healthcare', 'HeartPulse'],
  ['Personal Care', 'Sparkles'],
  ['Gym', 'Dumbbell'],
  ['Pets', 'PawPrint'],
  ['Donations', 'HandHeart'],
  ['Gifts', 'Gift'],
  ['Investments', 'TrendingUp'],
  ['Travel', 'Plane'],
  ['Video Games', 'Gamepad2'],
]
const debtOptions = [
  ['Credit card', 'CreditCard'],
  ['Line of credit', 'Landmark'],
  ['Personal loan', 'Wallet'],
  ['Student loan', 'GraduationCap'],
  ['Personal debt', 'HandCoins'],
]
const savingOptions = [
  ['Emergency fund', 'ShieldCheck'],
  ['Vacation', 'Plane'],
  ['Home down payment', 'House'],
  ['Investing', 'TrendingUp'],
  ['New car', 'Car'],
  ['Something else', 'Sparkles'],
]

export function Onboarding({
  initial,
  onDone,
  onChange,
  onSave,
}: {
  initial: PockitData
  onDone: (value: PockitData) => void
  onChange?: (value: PockitData) => void
  onSave?: (value: PockitData) => Promise<void>
}) {
  const [data, setData] = useState(initial)
  const [step, setStep] = useState(() => Math.max(0, Math.min(8, initial.onboardingStep ?? 0)))
  const [selectedGoals, setSelectedGoals] = useState<Goal[]>(initial.goals)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    onChange?.({ ...data, goals: selectedGoals })
  }, [data, selectedGoals, onChange])
  const setProfile = (patch: Partial<PockitData['profile']>) =>
    setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }))
  const updateGoal = (id: string, patch: Partial<Goal>) =>
    setSelectedGoals((goals) => goals.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const toggleGoal = (name: string, kind: Goal['kind'], icon: string) =>
    setSelectedGoals((goals) =>
      goals.some((g) => g.name === name && g.kind === kind)
        ? goals.filter((g) => !(g.name === name && g.kind === kind))
        : [
            ...goals,
            {
              id: crypto.randomUUID(),
              name,
              kind,
              icon,
              balance: 0,
              target: kind === 'saving' ? 1000 : 0,
              monthly: 0,
              annualInterest: 0,
              color: kind === 'debt' ? '#f29a91' : '#bdf26c',
              history: [],
            },
          ],
    )
  const moveTo = (nextStep: number) => {
    const finished = nextStep === 9
    const next = finished
      ? buildOnboardedData({ ...data, goals: selectedGoals })
      : { ...data, goals: selectedGoals, onboardingStep: nextStep }
    const apply = () => {
      if (finished) onDone(next)
      else {
        setData(next)
        setStep(nextStep)
      }
    }
    if (!onSave) return apply()
    setSaving(true)
    onSave(next)
      .then(apply)
      .catch((cause) =>
        setError(
          `Your progress could not be saved. Please try again. ${cause instanceof Error ? cause.message : ''}`,
        ),
      )
      .finally(() => setSaving(false))
  }
  const advance = () => {
    if (saving) return
    setError('')
    if (step === 1 && data.profile.payAmount <= 0)
      return setError('Enter your take-home pay to continue.')
    if (step === 2 && !data.profile.housing) return setError('Choose where you live to continue.')
    if (step === 3 && !data.profile.transport)
      return setError('Choose how you get around to continue.')
    moveTo(step + 1)
  }
  const card = (
    label: string,
    icon: string,
    selected: boolean,
    click: () => void,
    description?: string,
    tone?: string,
  ) => (
    <button
      key={label}
      className={`choice-card ${selected ? 'selected' : ''} ${tone || ''}`}
      onClick={click}
    >
      <span className="choice-icon">
        <Icon name={icon} size={22} />
      </span>
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <Icon name={selected ? 'CheckCircle2' : 'Circle'} size={20} className="choice-check" />
    </button>
  )
  return (
    <div className="onboarding">
      <div className="onboarding-header">
        <Brand />
        <span>
          YOUR SETUP <b>{step + 1} / 9</b>
        </span>
      </div>
      <div className="onboarding-progress">
        <Progress value={((step + 1) / 9) * 100} />
      </div>
      <div className="onboarding-body">
        <div className="onboarding-intro">
          <div className="eyebrow">LET'S MAKE IT YOURS</div>
          <h1>
            {
              [
                'What brings you to Pockit?',
                'What’s your take-home pay?',
                'Where do you live?',
                'How do you get around?',
                'Anything else you spend on?',
                'Anything you’re saving for or paying off?',
                'Let’s add a few numbers.',
                'Make your money easier to manage.',
                'You’re all set.',
              ][step]
            }
          </h1>
          <p>
            {
              [
                'Choose the thing you most want help with. You can change your setup later.',
                'Enter the amount you actually receive after tax.',
                'This helps us suggest the right monthly categories.',
                'We’ll add the kinds of transport costs that fit your life.',
                'Pick as many as you like. You can always add more later.',
                'Choose any goals that are on your mind.',
                'These estimates update as you type. You can refine them later.',
                'Smart Features help with categorizing, receipts, and recurring charges.',
                'Your Pockit is ready. Take a look around and make it yours.',
              ][step]
            }
          </p>
        </div>
        {(step === 5 || step === 6) && (
          <p className="soft-note">
            Moving from Waypoint? You can leave these goal choices and numbers blank. After opening
            Pockit, go to More → Move from Waypoint to import the ZIP’s goals, balances, and budget
            together.
          </p>
        )}
        {step === 0 && (
          <div className="choice-list">
            {reasons.map(([label, icon, desc]) =>
              card(
                label,
                icon,
                data.profile.reason === label,
                () => setProfile({ reason: label }),
                desc,
              ),
            )}
          </div>
        )}
        {step === 1 && (
          <div className="onboarding-panel">
            <label className="field">
              <span>I get paid</span>
              <div className="money-input">
                <span>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={data.profile.payAmount || ''}
                  onChange={(e) => setProfile({ payAmount: num(e.target.value) })}
                  placeholder="2,500"
                />
              </div>
            </label>
            <label className="field">
              <span>How often?</span>
              <select
                value={data.profile.payFrequency}
                onChange={(e) => setProfile({ payFrequency: e.target.value as Frequency })}
              >
                <option value="weekly">Once a week</option>
                <option value="biweekly">Every two weeks</option>
                <option value="twice-monthly">Twice a month</option>
                <option value="monthly">Once a month</option>
              </select>
            </label>
            <div className="soft-note">
              <Icon name="Info" size={18} /> We’ll use this to estimate your monthly income. You can
              edit it anytime.
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="choice-list">
            {[
              ['I rent', 'KeyRound'],
              ['I own a home', 'House'],
              ['No rent or mortgage', 'HeartHandshake'],
            ].map(([label, icon]) =>
              card(label, icon, data.profile.housing === label, () =>
                setProfile({ housing: label }),
              ),
            )}
          </div>
        )}
        {step === 3 && (
          <div className="choice-list">
            {[
              ['Car', 'Car'],
              ['Public transit', 'TrainFront'],
              ['Rideshare or taxi', 'CarTaxiFront'],
              ['Walk or bike', 'Bike'],
            ].map(([label, icon]) =>
              card(label, icon, data.profile.transport === label, () =>
                setProfile({ transport: label }),
              ),
            )}
          </div>
        )}
        {step === 4 && (
          <div className="choice-grid">
            {extraOptions.map(([label, icon]) =>
              card(label, icon, data.profile.extras.includes(label), () =>
                setProfile({
                  extras: data.profile.extras.includes(label)
                    ? data.profile.extras.filter((x) => x !== label)
                    : [...data.profile.extras, label],
                }),
              ),
            )}
          </div>
        )}
        {step === 5 && (
          <>
            <h3 className="choice-subtitle debt-text">Paying off</h3>
            <div className="choice-grid">
              {debtOptions.map(([label, icon]) =>
                card(
                  label,
                  icon,
                  selectedGoals.some((g) => g.name === label && g.kind === 'debt'),
                  () => toggleGoal(label, 'debt', icon),
                  undefined,
                  'debt',
                ),
              )}
            </div>
            <h3 className="choice-subtitle save-text">Saving for</h3>
            <div className="choice-grid">
              {savingOptions.map(([label, icon]) =>
                card(
                  label,
                  icon,
                  selectedGoals.some((g) => g.name === label && g.kind === 'saving'),
                  () => toggleGoal(label, 'saving', icon),
                  undefined,
                  'save',
                ),
              )}
            </div>
          </>
        )}
        {step === 6 && (
          <div className="goal-setup-list">
            {selectedGoals.length ? (
              selectedGoals.map((goal) => {
                const projection = projectGoal(goal)
                return (
                  <div className="goal-setup" key={goal.id}>
                    <div className="goal-setup-top">
                      <div className={`goal-icon ${goal.kind}`}>
                        <Icon name={goal.icon} />
                      </div>
                      <div>
                        <strong>{goal.name}</strong>
                        <small>{goal.kind === 'debt' ? 'Paying off' : 'Saving for'}</small>
                      </div>
                    </div>
                    <div className="form-grid">
                      <label className="field">
                        <span>{goal.kind === 'debt' ? 'Balance owed' : 'Saved so far'}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={goal.balance || ''}
                          onChange={(e) => updateGoal(goal.id, { balance: num(e.target.value) })}
                          placeholder="0"
                        />
                      </label>
                      {goal.kind === 'saving' && (
                        <label className="field">
                          <span>Goal amount</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={goal.target || ''}
                            onChange={(e) => updateGoal(goal.id, { target: num(e.target.value) })}
                            placeholder="1000"
                          />
                        </label>
                      )}
                      <label className="field">
                        <span>{goal.kind === 'debt' ? 'Monthly payment' : 'Save each month'}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={goal.monthly || ''}
                          onChange={(e) => updateGoal(goal.id, { monthly: num(e.target.value) })}
                          placeholder="0"
                        />
                      </label>
                      <label className="field">
                        <span>Annual interest %</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          inputMode="decimal"
                          value={goal.annualInterest || ''}
                          onChange={(e) =>
                            updateGoal(goal.id, { annualInterest: num(e.target.value) })
                          }
                          placeholder="0"
                        />
                      </label>
                    </div>
                    <div className="projection-row">
                      <Icon name="CalendarClock" size={17} />
                      {projection.months === null
                        ? 'Add a realistic monthly amount for a projection'
                        : projection.months === 0
                          ? 'Already there'
                          : `${projection.months} months to ${goal.kind === 'debt' ? 'debt-free' : 'your goal'}`}
                      {goal.kind === 'debt' && goal.balance > 0 && (
                        <span>· {money(projection.monthlyInterest)} interest this month</span>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="soft-note">No goals selected. You can add them later in Goals.</div>
            )}
          </div>
        )}
        {step === 7 && (
          <div className="smart-card">
            <div className="smart-orbit">
              <Icon name="Sparkles" size={36} />
            </div>
            <h3>A little help behind the scenes</h3>
            <div className="smart-feature">
              <Icon name="Tags" /> Suggests categories for familiar merchants
            </div>
            <div className="smart-feature">
              <Icon name="ScanLine" /> Reads a receipt on your device to fill in details
            </div>
            <div className="smart-feature">
              <Icon name="Repeat2" /> Spots monthly charges in your transactions
            </div>
            <label className="smart-toggle">
              <span>
                <strong>Turn on Smart Features</strong>
                <small>You can switch this off in Settings anytime.</small>
              </span>
              <input
                type="checkbox"
                checked={data.settings.smart}
                onChange={(e) =>
                  setData((d) => ({ ...d, settings: { ...d.settings, smart: e.target.checked } }))
                }
              />
              <span />
            </label>
          </div>
        )}
        {step === 8 && (
          <div className="finish-card">
            <div>
              <Icon name="Check" size={38} />
            </div>
            <strong>Good things start with a clear picture.</strong>
            <p>
              Here is your starting plan in Canadian dollars. Suggestions fit within about 90% of
              your estimated monthly take-home pay. Edit any amount in Budget after opening Pockit.
            </p>
            {(() => {
              const preview = buildOnboardedData({ ...data, goals: selectedGoals })
              const income = monthlyPay(data.profile.payAmount, data.profile.payFrequency)
              const allocated = preview.categories.reduce(
                (sum, category) => sum + category.baseAmount,
                0,
              )
              return (
                <div className="onboarding-plan-preview" aria-label="Starting monthly plan">
                  <div>
                    <span>Expected monthly pay</span>
                    <strong>{money(income)}</strong>
                  </div>
                  <div>
                    <span>Suggested category plan</span>
                    <strong>{money(allocated)}</strong>
                  </div>
                  <div>
                    <span>Still open for choices</span>
                    <strong>{money(income - allocated)}</strong>
                  </div>
                  <small>
                    These are planning amounts, not recorded spending or money already moved. Check
                    rent and other fixed bills against what you actually pay.
                  </small>
                </div>
              )
            })()}
          </div>
        )}
        {error && (
          <div className="form-message" role="alert">
            {error}
          </div>
        )}
        <div className="onboarding-actions">
          {step > 0 && (
            <button
              className="text-button"
              disabled={saving}
              onClick={() => {
                setError('')
                moveTo(step - 1)
              }}
            >
              <Icon name="ArrowLeft" size={18} /> Back
            </button>
          )}
          <button className="primary-button" disabled={saving} onClick={advance}>
            {saving
              ? 'Saving…'
              : step === 8
                ? 'Open my Pockit'
                : step === 4 || step === 5 || step === 6
                  ? 'Continue'
                  : 'Continue'}
            <Icon name="ArrowRight" size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
