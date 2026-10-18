// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Icon, Modal, SectionHead } from './UI'

afterEach(cleanup)

describe('dialog background scrolling', () => {
  it('keeps the page locked until the last dialog closes', () => {
    const first = (
      <Modal title="First" onClose={() => {}}>
        First content
      </Modal>
    )
    const view = render(
      <>
        {first}
        <Modal title="Second" onClose={() => {}}>
          Second content
        </Modal>
      </>,
    )
    expect(document.body.style.position).toBe('fixed')
    expect(document.documentElement.style.overflow).toBe('hidden')
    view.rerender(first)
    expect(document.body.style.position).toBe('fixed')
    view.unmount()
    expect(document.body.style.position).toBe('')
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('locks and restores the page for explanation overlays too', () => {
    render(<SectionHead title="Example" help="A short explanation." />)
    fireEvent.click(screen.getByRole('button', { name: 'About Example' }))
    expect(document.body.style.position).toBe('fixed')
    fireEvent.click(screen.getByRole('button', { name: 'Close explanation for Example' }))
    expect(document.body.style.position).toBe('')
  })
})

it.each([
  'Calculator',
  'CalendarRange',
  'ChartNoAxesCombined',
  'CloudCheck',
  'CloudUpload',
  'CloudOff',
  'FileUp',
  'FlaskConical',
  'History',
  'Luggage',
  'WalletCards',
])('renders a meaningful %s icon rather than a generic circle', (name) => {
  const view = render(<Icon name={name} />)
  const svg = view.container.querySelector('svg')!
  expect(svg.classList.contains('lucide-circle')).toBe(false)
  expect(svg.querySelector('path,polyline,line,rect')).toBeTruthy()
})

it('mounts sheets above animated or clipped page containers', () => {
  const view = render(
    <div style={{ transform: 'translateY(4px)', overflow: 'hidden' }}>
      <Modal title="Independent sheet" onClose={() => {}}>
        Content
      </Modal>
    </div>,
  )
  expect(screen.getByRole('dialog').closest('.modal-backdrop')?.parentElement).toBe(document.body)
  expect(view.container.querySelector('.modal-backdrop')).toBeNull()
})
