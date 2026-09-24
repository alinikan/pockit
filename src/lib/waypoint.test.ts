import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { makeInitialData, newCategory } from './defaults'
import { importWaypoint, parseWaypointZip, type WaypointOptions } from './waypoint'
import {
  beforeWaypointPlan,
  budgetHealth,
  categoryDueDates,
  monthSummary,
  projectGoal,
  simulateDebtPlan,
  spendingByCategory,
} from './finance'
import { budgetComparison, comparisonFindings, EXCLUDED, monthSnapshot } from './compare'
import { accountBalance } from './ledger'
import { changeTransaction } from './linked'

const headers = {
  'transactions.csv':
    'Date,Description,Amount,Category,Group,Type,Tags,Notes,Excluded from Budget,Account,Account Last 4,Bank',
  'budgets.csv': 'Group,Category,Budget Amount,Recurrence,Due Date (Day of Month)',
  'categories.csv': 'Group,Category,Icon,Color',
  'goals.csv':
    'Goal,Type,Target Amount,Current Amount,Remaining Balance,Progress,Monthly Contribution Target,Manual Contributions,Transaction Contributions,Original Debt Amount,Interest Rate,Minimum Payment,Target Date,Description',
  'accounts.csv':
    'Bank,Account,Type,Subtype,Account Last 4,Balance,Available Balance,Credit Limit,Connection,Last Updated',
}
type Files = Record<keyof typeof headers, string>
const sample = (changes: Partial<Files> = {}): Files => ({
  'transactions.csv': headers['transactions.csv'],
  'budgets.csv': `${headers['budgets.csv']}\n,Monthly Income,4300,,\n,Total Allocated,580,,\n,Remaining,3720,,\n,Groceries,390,monthly,\n,Gas,190,monthly,`,
  'categories.csv': `${headers['categories.csv']}\n,Groceries,ShoppingCart,#10B981\n,Gas,Fuel,#EF4444`,
  'goals.csv': `${headers['goals.csv']}\nCredit Card,debt,,,5000,0%,300,0,0,5000,22.00%,100,,Pay off card\nVacation,savings,5000,1250,,25%,200,300,950,,,,2027-06-01,Trip`,
  'accounts.csv': headers['accounts.csv'],
  ...changes,
})
const archive = (changes?: Partial<Files>) =>
  parseWaypointZip(
    zipSync(
      Object.fromEntries(
        Object.entries(sample(changes)).map(([name, text]) => [name, strToU8(text)]),
      ),
    ),
  )
const options: WaypointOptions = {
  startMonth: '2026-09',
  cadConfirmed: true,
  existing: 'waypoint',
  includePossibleDuplicates: false,
  creditPositiveMeansOwed: false,
  accountAsOfDate: '2026-09-23',
}

describe('Waypoint full ZIP import', () => {
  it('reads the empty-new-user ZIP shape without inventing transactions or accounts', () => {
    const result = importWaypoint(archive(), makeInitialData(), options)
    expect(result.counts).toMatchObject({ categories: 2, goals: 2, transactions: 0, accounts: 0 })
    expect(result.data.profile.plannedMonthlyIncome).toBe(4300)
    expect(result.data.profile.payAmount).toBe(0)
    expect(result.data.categories.find((item) => item.name === 'Groceries')).toMatchObject({
      baseAmount: 390,
      group: 'Food & Dining',
      icon: 'ShoppingBasket',
    })
    expect(result.data.goals.find((item) => item.name === 'Credit Card')).toMatchObject({
      balance: 5000,
      annualInterest: 22,
      minimumPayment: 100,
    })
    expect(result.data.goals.find((item) => item.name === 'Vacation')).toMatchObject({
      balance: 1250,
      target: 5000,
      targetDate: '2027-06-01',
    })
    expect(monthSummary(result.data, '2026-09').income).toBe(4300)
    expect(monthSummary(result.data, '2026-08').income).toBe(0)
    expect(result.data.transactions).toHaveLength(0)
    expect(result.data.accounts).toHaveLength(0)
  })

  it('imports dated spending across historical months without inventing past budget plans', () => {
    const full = archive({
      'transactions.csv': `${headers['transactions.csv']}\n2026-06-11,June market,-25,Groceries,,expense,,,false,,,\n2026-07-12,July market,-35,Groceries,,expense,,,false,,,\n2026-08-13,August market,-45,Groceries,,expense,,,false,,,\n2026-09-14,September market,-55,Groceries,,expense,,,false,,,`,
    })
    const result = importWaypoint(full, makeInitialData(), options)
    expect(result.counts.transactions).toBe(4)
    expect(
      ['2026-06', '2026-07', '2026-08', '2026-09'].map(
        (month) => monthSummary(result.data, month as '2026-06').spent,
      ),
    ).toEqual([25, 35, 45, 55])
    expect(
      ['2026-06', '2026-07', '2026-08', '2026-09'].map(
        (month) => monthSnapshot(result.data, month as '2026-06').spent,
      ),
    ).toEqual([25, 35, 45, 55])
    expect(
      budgetComparison(result.data, '2026-08').find((row) => row.name === 'Groceries'),
    ).toMatchObject({ planned: 0, spent: 45 })
    expect(
      budgetComparison(result.data, '2026-09').find((row) => row.name === 'Groceries'),
    ).toMatchObject({ planned: 390, spent: 55 })
    expect(result.data.profile.waypointPlanStarts).toBe('2026-09')
    expect(beforeWaypointPlan(result.data, '2026-08')).toBe(true)
    expect(beforeWaypointPlan(result.data, '2026-09')).toBe(false)
    expect(budgetHealth(result.data, '2026-08').trouble).toHaveLength(0)
    expect(
      budgetComparison(result.data, '2026-08').find((row) => row.name === 'Groceries'),
    ).toMatchObject({ planUnavailable: true, balance: 0 })
    expect(
      comparisonFindings(
        result.data,
        monthSnapshot(result.data, '2026-07'),
        monthSnapshot(result.data, '2026-08'),
      ).some((finding) => finding.title.includes('need attention')),
    ).toBe(false)
  })

  it('treats Waypoint reimbursements as positive refunds against spending', () => {
    const full = archive({
      'budgets.csv': `${headers['budgets.csv']}\n,Monthly Income,0,,\n,Groceries,390,monthly,`,
      'transactions.csv': `${headers['transactions.csv']}\n2026-08-11,Market,-80,Groceries,,expense,,,No,,,\n2026-08-12,Refund,25,Groceries,,reimbursement,,,No,,,\n2026-09-11,Market,-50,Groceries,,expense,,,No,,,\n2026-09-12,Refund,10,Groceries,,reimbursement,,,No,,,\n2026-09-15,Pay,500,,,income,,,No,,,`,
    })
    const result = importWaypoint(full, makeInitialData(), options)
    expect(result.counts.transactions).toBe(5)
    expect(result.data.transactions.filter((item) => item.refund)).toHaveLength(2)
    expect(result.data.transactions.find((item) => item.payee === 'Refund')).toMatchObject({
      type: 'expense',
      refund: true,
      waypointTypeRaw: 'reimbursement',
    })
    expect(monthSummary(result.data, '2026-08').spent).toBe(55)
    expect(monthSummary(result.data, '2026-09')).toMatchObject({
      spent: 40,
      actualIncome: 500,
    })
    expect(monthSnapshot(result.data, '2026-08').spent).toBe(55)
    expect(result.notes.some((note) => note.includes('$0 monthly income plan'))).toBe(true)
    const repeated = importWaypoint(full, result.data, options)
    expect(repeated.counts.transactions).toBe(0)
    expect(repeated.counts.duplicates).toBe(5)
    expect(() =>
      importWaypoint(
        archive({
          'transactions.csv': `${headers['transactions.csv']}\n2026-09-12,Bad refund,-10,Groceries,,reimbursement,,,No,,,`,
        }),
        makeInitialData(),
        options,
      ),
    ).toThrow(/must have a positive amount/)
    expect(() =>
      importWaypoint(
        archive({
          'transactions.csv': `${headers['transactions.csv']}\n2026-09-12,Bad expense,10,Groceries,,expense,,,No,,,`,
        }),
        makeInitialData(),
        options,
      ),
    ).toThrow(/expense must have a negative amount/)
    expect(() =>
      importWaypoint(
        archive({
          'transactions.csv': `${headers['transactions.csv']}\n2026-09-12,Bad income,-10,,,income,,,No,,,`,
        }),
        makeInitialData(),
        options,
      ),
    ).toThrow(/income must have a positive amount/)
  })

  it('flags an exactly-100-row export for a completeness check without dropping rows', () => {
    const entries = Array.from(
      { length: 100 },
      (_, index) =>
        `2026-08-${String((index % 28) + 1).padStart(2, '0')},Market ${index},-1,Groceries,,expense,,,No,,,`,
    )
    const full = archive({
      'transactions.csv': `${headers['transactions.csv']}\n${entries.join('\n')}`,
    })
    const result = importWaypoint(full, makeInitialData(), options)
    expect(result.counts.transactions).toBe(100)
    expect(result.notes.some((note) => note.includes('exactly 100 transactions'))).toBe(true)
    expect(monthSummary(result.data, '2026-08').spent).toBe(100)
  })

  it('does not invent a zero interest rate for an exported debt with a blank rate', () => {
    const full = archive({
      'goals.csv': `${headers['goals.csv']}\nStudent Loan,debt,,,20000,0%,300,0,0,20000,,,,Pay it off`,
    })
    const result = importWaypoint(full, makeInitialData(), options)
    const debt = result.data.goals[0]
    expect(debt.interestUnknown).toBe(true)
    expect(projectGoal(debt).months).toBeNull()
    expect(
      simulateDebtPlan(result.data.goals, { strategy: 'interest', extra: 0, order: [] })
        .unknownInterest,
    ).toBe(true)
  })

  it('imports categories into an existing plan without rewriting earlier month amounts', () => {
    const current = makeInitialData()
    const groceries = newCategory(
      'Groceries',
      'ShoppingBasket',
      'Food & Dining',
      '#aaaabb',
      200,
      '2026-01',
    )
    groceries.overrides['2026-09'] = 999
    current.categories = [groceries]
    const first = importWaypoint(archive(), current, options)
    expect(first.data.categories.find((item) => item.id === groceries.id)?.baseAmount).toBe(200)
    expect(first.data.categories.find((item) => item.id === groceries.id)?.changes['2026-09']).toBe(
      390,
    )
    expect(first.data.categories.find((item) => item.id === groceries.id)?.waypointKey).toBeTruthy()
    expect(
      first.data.categories.find((item) => item.id === groceries.id)?.overrides['2026-09'],
    ).toBeUndefined()
    expect(first.data.categories).toHaveLength(2)
    expect(first.changes.some((line) => line.includes('Groceries plan'))).toBe(true)
    expect(first.newRecords.some((line) => line.includes('Gas'))).toBe(true)
    const second = importWaypoint(archive(), first.data, { ...options, existing: 'keep' })
    expect(second.data.categories).toHaveLength(2)
    expect(second.data.goals).toHaveLength(2)
    expect(second.counts.matched).toBeGreaterThan(0)
  })

  it('stops a mismatched recurrence instead of showing a false monthly allocation', () => {
    const current = makeInitialData()
    const groceries = newCategory(
      'Groceries',
      'ShoppingBasket',
      'Food & Dining',
      '#abcdef',
      90,
      '2026-01',
    )
    groceries.frequency = 'weekly'
    current.categories = [groceries]
    expect(() => importWaypoint(archive(), current, options)).toThrow(/different Pockit recurrence/)
    expect(
      importWaypoint(archive(), current, { ...options, existing: 'keep' }).data.categories[0]
        .frequency,
    ).toBe('weekly')
  })

  it('keeps account snapshots, transaction details and month-wide figures connected', () => {
    const full = archive({
      'accounts.csv': `${headers['accounts.csv']}\nExample Bank,Daily,Chequing,Everyday,1234,1000,950,,Manual,2026-09-15`,
      'transactions.csv': `${headers['transactions.csv']}\n2026-09-17,Market,-30,Groceries,,expense,"food, weekly",Bread,no,Daily,1234,Example Bank\n2026-09-18,Paycheque,1000,,,income,,Salary,false,Daily,1234,Example Bank\n2026-09-19,Gift,-20,Gas,,expense,,Outside plan,true,Daily,1234,Example Bank`,
    })
    const result = importWaypoint(full, makeInitialData(), options)
    expect(result.counts).toMatchObject({ accounts: 1, transactions: 3 })
    const account = result.data.accounts![0]
    expect(accountBalance(account, result.data.transactions)).toBe(1950)
    expect(result.data.transactions[0]).toMatchObject({
      amount: 30,
      type: 'expense',
      tags: ['food', 'weekly'],
      note: 'Bread',
      accountId: account.id,
    })
    expect(monthSummary(result.data, '2026-09')).toMatchObject({
      actualIncome: 1000,
      spent: 50,
      remaining: 4250,
    })
    const gas = result.data.categories.find((item) => item.name === 'Gas')!
    expect(spendingByCategory(result.data.transactions, '2026-09')[gas.id] || 0).toBe(0)
    expect(monthSnapshot(result.data, '2026-09').categorySpend[EXCLUDED]).toBe(20)
    expect(
      budgetComparison(result.data, '2026-09').find((item) => item.id === EXCLUDED)?.balance,
    ).toBe(0)
    const edited = changeTransaction(result.data, result.data.transactions[0], {
      ...result.data.transactions[0],
      amount: 45,
    })
    expect(monthSummary(edited, '2026-09').spent).toBe(65)
    expect(accountBalance(account, edited.transactions)).toBe(1935)
    expect(
      spendingByCategory(edited.transactions, '2026-09')[result.data.transactions[0].categoryId!],
    ).toBe(45)
    const reimport = importWaypoint(full, edited, options)
    expect(reimport.counts.transactions).toBe(0)
    expect(
      reimport.data.transactions.find((item) => item.id === edited.transactions[0].id)?.amount,
    ).toBe(45)
  })

  it('retains two truly identical export rows but skips them on a repeat import', () => {
    const one = '2026-09-17,Cafe,-5,Groceries,,expense,,,false,,,'
    const full = archive({ 'transactions.csv': `${headers['transactions.csv']}\n${one}\n${one}` })
    const first = importWaypoint(full, makeInitialData(), options)
    expect(first.counts.transactions).toBe(2)
    expect(new Set(first.data.transactions.map((item) => item.sourceId)).size).toBe(2)
    const second = importWaypoint(full, first.data, options)
    expect(second.counts.transactions).toBe(0)
    expect(second.counts.duplicates).toBe(2)
  })

  it('shows a budget payment date without fabricating a bill', () => {
    const full = archive({ 'budgets.csv': `${headers['budgets.csv']}\n,Rent,1000,monthly,31` })
    const result = importWaypoint(full, makeInitialData(), options).data
    expect(categoryDueDates(result, '2026-09')[0]).toMatchObject({
      date: '2026-09-30',
      amount: 1000,
    })
    expect(result.bills).toHaveLength(0)
  })

  it('keeps same-named categories in different groups distinct', () => {
    const full = archive({
      'budgets.csv': `${headers['budgets.csv']}\nFood,Other,60,monthly,\nHome,Other,40,monthly,`,
      'categories.csv': `${headers['categories.csv']}\nFood,Other,Shapes,#112233\nHome,Other,Shapes,#445566`,
      'transactions.csv': `${headers['transactions.csv']}\n2026-09-17,Store,-20,Other,Food,expense,,,false,,,`,
    })
    const result = importWaypoint(full, makeInitialData(), options).data
    expect(result.categories).toHaveLength(2)
    expect(result.transactions[0].categoryId).toBe(
      result.categories.find((item) => item.group === 'Food')?.id,
    )
    const existing = makeInitialData()
    existing.categories = [newCategory('Other', 'Shapes', 'Lifestyle', '#abcdef', 9, '2026-01')]
    const merged = importWaypoint(full, existing, options).data
    expect(merged.categories).toHaveLength(2)
    expect(merged.categories.map((item) => item.group).sort()).toEqual(['Food', 'Home'])
  })

  it('does not silently choose between ambiguous same-named categories', () => {
    const full = archive({
      'budgets.csv': `${headers['budgets.csv']}\nFood,Other,60,monthly,\nHome,Other,40,monthly,`,
      'categories.csv': `${headers['categories.csv']}\nFood,Other,Shapes,#112233\nHome,Other,Shapes,#445566`,
      'transactions.csv': `${headers['transactions.csv']}\n2026-09-17,Store,-20,Other,,expense,,,false,,,`,
    })
    expect(() => importWaypoint(full, makeInitialData(), options)).toThrow(/category “Other”/)
  })

  it('accepts a negative remaining budget without treating it as a negative category', () => {
    const full = archive({
      'budgets.csv': `${headers['budgets.csv']}\n,Monthly Income,100,,\n,Total Allocated,150,,\n,Remaining,-50,,\n,Groceries,150,monthly,`,
    })
    const result = importWaypoint(full, makeInitialData(), options)
    expect(result.data.profile.plannedMonthlyIncome).toBe(100)
    expect(result.data.categories[0].baseAmount).toBe(150)
    expect(result.notes.some((note) => note.includes('do not reconcile'))).toBe(false)
  })

  it('does not double count an imported goal balance when a historic transaction is linked', () => {
    const first = importWaypoint(
      archive({
        'transactions.csv': `${headers['transactions.csv']}\n2026-09-12,Card payment,-100,Gas,,transfer,,,false,,,`,
      }),
      makeInitialData(),
      options,
    ).data
    const goal = first.goals.find((item) => item.name === 'Credit Card')!
    const transaction = first.transactions[0]
    const linked = changeTransaction(first, transaction, {
      ...transaction,
      goalId: goal.id,
      goalBaselineImpact: -100,
    })
    expect(linked.goals.find((item) => item.id === goal.id)?.balance).toBe(5000)
    expect(linked.goals.find((item) => item.id === goal.id)?.history).toHaveLength(1)
    expect(linked.goals.find((item) => item.id === goal.id)?.history[0].note).toBe(
      'Withdrawal or payment',
    )
    const changed = changeTransaction(linked, linked.transactions[0], {
      ...linked.transactions[0],
      amount: 120,
    })
    expect(changed.goals.find((item) => item.id === goal.id)?.balance).toBe(4980)
  })

  it('uses transfer signs for the correct account direction after a balance snapshot', () => {
    const full = archive({
      'accounts.csv': `${headers['accounts.csv']}\nExample Bank,Daily,Chequing,,1234,1000,,,,2026-09-15`,
      'transactions.csv': `${headers['transactions.csv']}\n2026-09-17,Incoming transfer,80,,,transfer,,,false,Daily,1234,Example Bank\n2026-09-18,Outgoing transfer,-30,,,transfer,,,false,Daily,1234,Example Bank`,
    })
    const result = importWaypoint(full, makeInitialData(), options).data
    expect(result.transactions[0]).toMatchObject({
      toAccountId: result.accounts![0].id,
      amount: 80,
    })
    expect(result.transactions[1]).toMatchObject({ accountId: result.accounts![0].id, amount: 30 })
    expect(accountBalance(result.accounts![0], result.transactions)).toBe(1050)
  })

  it('requires CAD confirmation and rejects broken or unknown ZIP content', () => {
    expect(() =>
      importWaypoint(archive(), makeInitialData(), { ...options, cadConfirmed: false }),
    ).toThrow(/Canadian dollars/)
    expect(() => parseWaypointZip(strToU8('not a zip'))).toThrow()
    expect(() =>
      parseWaypointZip(zipSync({ 'transactions.csv': strToU8(headers['transactions.csv']) })),
    ).toThrow(/missing budgets.csv/)
    expect(() =>
      parseWaypointZip(
        zipSync({
          ...Object.fromEntries(
            Object.entries(sample()).map(([name, text]) => [name, strToU8(text)]),
          ),
          'extra.csv': strToU8('secret'),
        }),
      ),
    ).toThrow(/Unexpected/)
    expect(() =>
      archive({ 'transactions.csv': `${headers['transactions.csv']},New Secret Column` }),
    ).toThrow(/unsupported column/)
    expect(() =>
      importWaypoint(
        archive({ 'budgets.csv': `${headers['budgets.csv']}\n,Groceries,10,fortnightly,` }),
        makeInitialData(),
        options,
      ),
    ).toThrow(/recurrence/)
    expect(() =>
      importWaypoint(
        archive({ 'goals.csv': `${headers['goals.csv']}\nBroken,debt,,,not-money,,,,,,,,,` }),
        makeInitialData(),
        options,
      ),
    ).toThrow(/invalid amount/)
    expect(() =>
      importWaypoint(
        archive({
          'transactions.csv': `${headers['transactions.csv']}\n2026-09-23garbage,Shop,-10,Groceries,,expense,,,false,,,`,
        }),
        makeInitialData(),
        options,
      ),
    ).toThrow(/invalid date/)
  })
})
