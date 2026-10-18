import { useEffect, useId, useRef, useState } from 'react'
import type { Category, PockitData } from '../types'
import { availableCategoryPresets, categoryMatches, categoryPreset } from '../lib/categoryLibrary'
import { Icon, Modal } from './UI'

function CategoryMark({ category }: { category: Pick<Category, 'name' | 'icon' | 'color'> }) {
  return (
    <span
      className="category-picker-mark"
      style={{ color: category.color, background: `${category.color}20` }}
    >
      <Icon name={category.icon} size={19} />
    </span>
  )
}
export function CategoryPicker({
  categories,
  value,
  onChange,
  label = 'Category',
  disabled = false,
}: {
  categories: Category[]
  value?: string
  onChange: (id?: string) => void
  label?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const selected = categories.find((item) => item.id === value) || categoryPreset(value)
  const pending = !!selected && !categories.some((item) => item.id === value)
  const current = categories
    .filter((item) => !item.archived && categoryMatches(item, query))
    .sort((a, b) => a.name.localeCompare(b.name, 'en-CA'))
  const available = availableCategoryPresets(categories, query)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  function choose(id?: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
    trigger.current?.focus()
  }
  function option(item: Pick<Category, 'id' | 'name' | 'icon' | 'color'>, extra = false) {
    return (
      <button
        type="button"
        key={item.id}
        className="category-picker-option"
        aria-label={`Use ${item.name}`}
        aria-pressed={value === item.id}
        onClick={() => choose(item.id)}
      >
        <CategoryMark category={item} />
        <span>
          {item.name}
          {extra && <small>Add when saved · $0 planned</small>}
        </span>
        <Icon name={value === item.id ? 'Check' : extra ? 'Plus' : 'ChevronRight'} size={17} />
      </button>
    )
  }
  return (
    <div
      className="field category-picker"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={trigger}
        type="button"
        className="category-picker-trigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={open ? `${id}-options` : undefined}
        disabled={disabled}
        onClick={() => {
          setOpen(!open)
          setQuery('')
        }}
      >
        {selected && !disabled && <CategoryMark category={selected} />}
        <span id={`${id}-value`}>
          {disabled ? 'Using the split categories below' : selected?.name || 'Choose a category'}
        </span>
        <Icon name="ChevronDown" size={18} />
      </button>
      {open && (
        <div className="category-picker-menu" id={`${id}-options`}>
          <div className="category-picker-search">
            <Icon name="Search" size={18} />
            <input
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder="Search, e.g. cigarettes or toys"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div
            className="category-picker-results"
            role="group"
            aria-label="Spending category choices"
          >
            {!query && (
              <button type="button" className="category-picker-option" onClick={() => choose()}>
                <Icon name="Shapes" size={19} />
                <span>No category</span>
              </button>
            )}
            {current.length > 0 && (
              <>
                <p className="category-picker-heading">Your categories · A–Z</p>
                {current.map((item) => option(item))}
              </>
            )}
            {available.length > 0 && (
              <>
                <p className="category-picker-heading">More categories · A–Z</p>
                {available.map((item) => option(item, true))}
              </>
            )}
            {!current.length && !available.length && (
              <p className="category-picker-empty">
                No matching category. Try a shorter word, or create your own in Budget → Add
                category.
              </p>
            )}
          </div>
        </div>
      )}
      {pending && !disabled && (
        <small className="category-picker-note">
          Added when you save this purchase, with $0 planned. Set your own monthly limit in Budget.
        </small>
      )}
    </div>
  )
}

export function CategoryLibraryDialog({
  data,
  onAdd,
  onClose,
}: {
  data: PockitData
  onAdd: (ids: string[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState<string[]>([])
  const all = availableCategoryPresets(data.categories),
    choices = all.filter((item) => categoryMatches(item, query))
  const chosen = selected.filter((id) => all.some((item) => item.id === id))
  return (
    <Modal title="Browse spending categories" onClose={onClose}>
      <div className="modal-body category-library-sheet">
        <p className="goal-form-note">
          Choose the categories you want. Each starts with $0 planned; set your own limits
          afterwards. Your existing amounts stay as they are.
        </p>
        <div className="category-picker-search">
          <Icon name="Search" size={18} />
          <input
            aria-label="Search category library"
            type="search"
            placeholder="Search, e.g. cigarettes or toys"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="category-library-list">
          {choices.map((item) => (
            <label className="category-library-choice" key={item.id}>
              <input
                type="checkbox"
                checked={chosen.includes(item.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id),
                  )
                }
              />
              <CategoryMark category={item} />
              <span>
                {item.name}
                <small>{item.group}</small>
              </span>
            </label>
          ))}
          {!choices.length && (
            <p className="goal-form-note">
              {all.length
                ? 'No match. Try a shorter word or create your own category.'
                : 'You have already added these categories. You can create a custom category or restore removed ones in Budget.'}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!chosen.length}
            onClick={() => {
              onAdd(chosen)
              onClose()
            }}
          >
            Add {chosen.length || ''} {chosen.length === 1 ? 'category' : 'categories'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
