import { useState } from 'react'
import { Icon, Modal } from './UI'

export interface QuickAction {
  label: string
  description: string
  group: 'Pages' | 'Actions'
  icon: string
  run: () => void
}

export function QuickActions({
  actions,
  onClose,
}: {
  actions: QuickAction[]
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const matching = actions.filter((action) =>
    `${action.label} ${action.description} ${action.group}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  )
  const index = matching.length ? Math.min(selected, matching.length - 1) : 0
  const choose = (action: QuickAction) => {
    onClose()
    action.run()
  }
  return (
    <Modal title="Search Pockit" onClose={onClose}>
      <div className="quick-actions">
        <label className="quick-search">
          <Icon name="Search" size={20} />
          <input
            autoFocus
            role="combobox"
            aria-label="Search pages and actions"
            aria-controls="quick-action-results"
            aria-expanded="true"
            placeholder="Search pages and actions…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelected(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelected((value) => Math.min(value + 1, Math.max(0, matching.length - 1)))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelected((value) => Math.max(0, value - 1))
              }
              if (event.key === 'Enter' && matching[index]) choose(matching[index])
            }}
          />
          <kbd>⌘ / Ctrl K</kbd>
        </label>
        <div id="quick-action-results" role="listbox" aria-label="Matching pages and actions">
          {matching.length ? (
            matching.map((action, position) => (
              <button
                type="button"
                role="option"
                aria-selected={position === index}
                key={`${action.group}-${action.label}`}
                className={`quick-action-row ${position === index ? 'selected' : ''}`}
                onMouseEnter={() => setSelected(position)}
                onClick={() => choose(action)}
              >
                <span className="quick-action-icon">
                  <Icon name={action.icon} size={19} />
                </span>
                <span>
                  <small>{action.group}</small>
                  <strong>{action.label}</strong>
                  <span>{action.description}</span>
                </span>
                <Icon name="ArrowUpRight" size={16} />
              </button>
            ))
          ) : (
            <p className="quick-action-empty">No match. Try a page name or “add transaction”.</p>
          )}
        </div>
        <p className="quick-action-help">Use ↑ ↓ to move, Enter to open, Esc to close.</p>
      </div>
    </Modal>
  )
}
