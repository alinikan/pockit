import type { Category, MonthKey, PockitData, Transaction } from '../types'
import { categoryPresets, newCategory } from './defaults'

export interface SpendingCategoryPreset {
  id: string
  name: string
  icon: string
  group: string
  color: string
  keywords: string
}
export const categorySearchText = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
const extras = [
  [
    'Cigarettes & Tobacco',
    'Cigarette',
    'Lifestyle',
    '#d6b7a5',
    'cigarette cigarettes tobacco smokes smoking cigar',
  ],
  ['Vaping', 'Cigarette', 'Lifestyle', '#c4b0df', 'vape vaping pods e liquid'],
  ['Cannabis', 'Leaf', 'Lifestyle', '#a4c9ad', 'cannabis dispensary marijuana'],
  [
    'Toys & Games',
    'Puzzle',
    'Lifestyle',
    '#b5b0ef',
    'toy toys lego dolls puzzles board games plush',
  ],
  [
    'Hobbies & Crafts',
    'Palette',
    'Lifestyle',
    '#d7abe3',
    'hobby hobbies crafts art painting knitting collecting',
  ],
  [
    'Books & Magazines',
    'BookOpen',
    'Lifestyle',
    '#99c8dd',
    'book books magazines reading comic comics',
  ],
  [
    'Electronics',
    'Laptop',
    'Lifestyle',
    '#a4c0ef',
    'computer laptop headphones charger cable gadget tech',
  ],
  [
    'Clothing & Shoes',
    'Shirt',
    'Lifestyle',
    '#e3b0cc',
    'clothes clothing shoes sneakers jacket socks',
  ],
  [
    'Furniture & Decor',
    'Armchair',
    'Lifestyle',
    '#d8ba9b',
    'furniture couch chair desk decor lamp',
  ],
  [
    'Household Supplies',
    'House',
    'Lifestyle',
    '#b4c9cf',
    'home household cleaning supplies detergent toilet paper',
  ],
  [
    'Home Repairs',
    'Wrench',
    'Bills & Utilities',
    '#dfba94',
    'home repair plumber plumbing electrician maintenance',
  ],
  [
    'Haircuts & Beauty',
    'Scissors',
    'Lifestyle',
    '#e0b7cf',
    'haircut hair barber salon beauty nails',
  ],
  [
    'Skincare & Cosmetics',
    'Sparkles',
    'Lifestyle',
    '#e7b7c0',
    'skincare cosmetics makeup lotion perfume',
  ],
  [
    'Dental Care',
    'HeartPulse',
    'Lifestyle',
    '#9bd4c8',
    'dentist dental teeth cleaning orthodontist',
  ],
  [
    'Medicines & Pharmacy',
    'HeartPulse',
    'Lifestyle',
    '#e5b1a7',
    'medication medicine prescription pharmacy vitamins',
  ],
  [
    'Therapy & Counselling',
    'Heart',
    'Lifestyle',
    '#c6b2df',
    'therapy counselling counseling psychologist mental health',
  ],
  ['Eye Care', 'Eye', 'Lifestyle', '#a7c8de', 'glasses contacts optometrist vision'],
  ['Childcare', 'Baby', 'Lifestyle', '#edbdad', 'childcare daycare babysitter child care'],
  ['Baby Supplies', 'Baby', 'Lifestyle', '#c5c0ec', 'baby diapers nappies formula stroller'],
  [
    'School Supplies',
    'GraduationCap',
    'Lifestyle',
    '#aebce9',
    'school supplies stationery backpack pencils',
  ],
  [
    'Education & Courses',
    'GraduationCap',
    'Lifestyle',
    '#c0b0ec',
    'education tuition classes courses lessons training',
  ],
  [
    'Pet Food & Supplies',
    'PawPrint',
    'Lifestyle',
    '#d8bda6',
    'pet food dog cat litter treats supplies',
  ],
  [
    'Vet Visits',
    'HeartPulse',
    'Lifestyle',
    '#c3d0ab',
    'vet veterinary veterinarian animal hospital',
  ],
  [
    'Coffee & Snacks',
    'Utensils',
    'Food & Dining',
    '#d7b497',
    'coffee snack snacks bakery tea pastry',
  ],
  [
    'Takeout & Delivery',
    'Utensils',
    'Food & Dining',
    '#e8bd91',
    'takeout takeaway uber eats doordash skip delivery meal',
  ],
  ['Alcohol', 'Wine', 'Food & Dining', '#d6abc7', 'alcohol wine beer spirits liquor'],
  ['Parking & Tolls', 'Car', 'Transportation', '#b0c5e8', 'parking toll tolls meter parkade'],
  [
    'Vehicle Registration',
    'Car',
    'Transportation',
    '#a9c8ca',
    'vehicle registration licence license renewal',
  ],
  [
    'Bike Repairs & Gear',
    'Bike',
    'Transportation',
    '#acd1b6',
    'bicycle bike cycling helmet repair gear',
  ],
  [
    'Flights & Hotels',
    'Plane',
    'Lifestyle',
    '#a4c7e5',
    'flight flights hotel accommodation airfare lodging',
  ],
  [
    'Tickets & Events',
    'Ticket',
    'Lifestyle',
    '#c6b2eb',
    'ticket tickets concert concerts event events theatre theater festival',
  ],
  [
    'Sports & Outdoors',
    'Bike',
    'Lifestyle',
    '#b8d1a2',
    'sport sports outdoor outdoors hiking camping swimming',
  ],
  [
    'Apps & Digital Purchases',
    'Smartphone',
    'Lifestyle',
    '#a5bdeb',
    'app apps digital software dlc in app purchases',
  ],
  ['Laundry & Dry Cleaning', 'Shirt', 'Lifestyle', '#b1ccd8', 'laundry laundromat dry cleaning'],
  [
    'Delivery & Postage',
    'ShoppingBag',
    'Lifestyle',
    '#d8c2a1',
    'postage parcel shipping courier mail',
  ],
  [
    'Bank Fees',
    'Landmark',
    'Bills & Utilities',
    '#c5bcdb',
    'bank fee fees overdraft atm service charge',
  ],
  [
    'Taxes & Government Fees',
    'ReceiptText',
    'Bills & Utilities',
    '#d7b6af',
    'tax taxes government passport permit fees',
  ],
  [
    'Professional Fees',
    'ReceiptText',
    'Bills & Utilities',
    '#b9c5dc',
    'accountant lawyer legal professional fees certification',
  ],
  ['Work Expenses', 'Laptop', 'Lifestyle', '#aebfd2', 'work office workwear business tools'],
  [
    'Other Spending',
    'Shapes',
    'Lifestyle',
    '#bcc2ce',
    'other random miscellaneous misc one off unexpected',
  ],
] as const
const keywords: Record<string, string> = {
  Groceries: 'grocery supermarket food shopping produce',
  'Video Games': 'video game videogame gaming steam playstation xbox nintendo switch ps5',
  Shopping: 'shopping general retail purchases',
  Gifts: 'gift gifts birthday presents christmas',
  'Personal Care': 'personal care toiletries',
}
export const spendingCategoryLibrary: SpendingCategoryPreset[] = [
  ...categoryPresets
    .filter(
      (preset) => !['Savings', 'Debt Payments', 'Investments', 'Payday Buffer'].includes(preset[0]),
    )
    .map(([name, icon, group, color]) => [name, icon, group, color, keywords[name] || ''] as const),
  ...extras,
]
  .map(([name, icon, group, color, words]) => ({
    id: `builtin-expense-${categorySearchText(name).replace(/ /g, '-')}`,
    name,
    icon,
    group,
    color,
    keywords: words,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en-CA'))

export const categoryPreset = (id?: string) =>
  spendingCategoryLibrary.find((item) => item.id === id)
export function categoryMatches(
  category: Pick<Category, 'name' | 'group'> | SpendingCategoryPreset,
  query: string,
) {
  const preset = spendingCategoryLibrary.find(
    (item) => categorySearchText(item.name) === categorySearchText(category.name),
  )
  const text = categorySearchText(`${category.name} ${category.group} ${preset?.keywords || ''}`)
  return categorySearchText(query)
    .split(' ')
    .filter(Boolean)
    .every((word) => text.includes(word))
}
export function availableCategoryPresets(categories: Category[], query = '') {
  const names = new Set(categories.map((item) => categorySearchText(item.name)))
  return spendingCategoryLibrary.filter(
    (item) =>
      !categories.some((category) => category.id === item.id) &&
      !names.has(categorySearchText(item.name)) &&
      categoryMatches(item, query),
  )
}
export function addSpendingCategories(
  data: PockitData,
  ids: string[],
  month: MonthKey,
): PockitData {
  const categories = [...data.categories]
  for (const id of new Set(ids)) {
    const preset = categoryPreset(id)
    if (
      !preset ||
      categories.some(
        (item) =>
          item.id === id || categorySearchText(item.name) === categorySearchText(preset.name),
      )
    )
      continue
    categories.push({
      ...newCategory(preset.name, preset.icon, preset.group, preset.color, 0, month),
      id: preset.id,
      needsAmount: true,
      notes: 'Added from the category library. Set your own monthly limit in Budget.',
    })
  }
  return categories.length === data.categories.length ? data : { ...data, categories }
}
export function resolveSpendingSelection(
  data: PockitData,
  entry: Transaction,
): { data: PockitData; entry: Transaction } {
  if (entry.type !== 'expense') return { data, entry }
  const ids = [entry.categoryId, ...(entry.splits || []).map((item) => item.categoryId)].filter(
    Boolean,
  ) as string[]
  const next = addSpendingCategories(data, ids, entry.date.slice(0, 7) as MonthKey)
  const resolve = (id?: string) => {
    if (!id || next.categories.some((item) => item.id === id)) return id
    const preset = categoryPreset(id)
    return preset
      ? next.categories.find(
          (item) => categorySearchText(item.name) === categorySearchText(preset.name),
        )?.id
      : id
  }
  return {
    data: next,
    entry: {
      ...entry,
      categoryId: resolve(entry.categoryId),
      splits: entry.splits?.map((item) => ({ ...item, categoryId: resolve(item.categoryId)! })),
    },
  }
}
export function transactionDescription(entry: Transaction, categories: Category[]) {
  if (entry.payee.trim() || entry.type !== 'expense') return entry.payee.trim()
  const name =
    categories.find((item) => item.id === entry.categoryId)?.name ||
    categoryPreset(entry.categoryId)?.name
  return entry.refund
    ? name
      ? `Refund · ${name}`
      : 'Refund'
    : entry.splits?.length
      ? 'Split purchase'
      : name || 'Purchase'
}
