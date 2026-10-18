import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { pockitSpring } from '../lib/motion'
import { dialogReturnTarget } from '../lib/dialogFocus'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'
import { usePhoneViewport } from '../lib/usePhoneViewport'
import {
  Bell,
  Calculator,
  CalendarRange,
  ChartNoAxesCombined,
  CloudAlert,
  CloudUpload,
  CloudOff,
  FilePenLine,
  FileUp,
  FlaskConical,
  History,
  Luggage,
  MapPin,
  Pin,
  Trash2,
  WalletCards,
  ArrowDown,
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bike,
  Baby,
  BookOpen,
  Cigarette,
  Leaf,
  Laptop,
  Puzzle,
  Shirt,
  Armchair,
  Ticket,
  Wine,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Car,
  CarTaxiFront,
  ChartPie,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleDot,
  CircleHelp,
  Clapperboard,
  Columns3,
  Cloud,
  CreditCard,
  Download,
  Dumbbell,
  Ellipsis,
  Eye,
  Fingerprint,
  Flag,
  Folders,
  Fuel,
  Gamepad2,
  Gift,
  GitCompareArrows,
  GraduationCap,
  Grid2X2,
  GripVertical,
  HandCoins,
  HandHeart,
  HardDrive,
  Heart,
  HeartHandshake,
  HeartPulse,
  House,
  Info,
  KeyRound,
  Landmark,
  Layers3,
  ListFilter,
  ListOrdered,
  LockKeyhole,
  LogOut,
  Moon,
  Palette,
  PawPrint,
  Percent,
  PiggyBank,
  Plane,
  Play,
  Plus,
  Receipt,
  ReceiptText,
  RefreshCcw,
  Repeat2,
  ScanEye,
  ScanLine,
  Scissors,
  Search,
  Settings2,
  Shapes,
  SlidersHorizontal,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Sun,
  Tags,
  Target,
  TrainFront,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wallet,
  Waves,
  Wifi,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { MonthKey } from '../types'
import { monthLabel, shiftMonth } from '../lib/finance'

export function Icon({
  name,
  size = 20,
  ...props
}: { name: string; size?: number } & Omit<LucideProps, 'size'>) {
  const Component =
    (
      {
        Bell,
        Calculator,
        CalendarRange,
        ChartNoAxesCombined,
        CloudAlert,
        CloudCheck: Cloud,
        CloudUpload,
        CloudOff,
        FilePenLine,
        FileUp,
        FlaskConical,
        History,
        Luggage,
        MapPin,
        Pin,
        Trash2,
        WalletCards,
        ArrowDown,
        ArrowDownLeft,
        ArrowLeft,
        ArrowLeftRight,
        ArrowRight,
        ArrowUp,
        ArrowUpRight,
        Bike,
        Baby,
        BookOpen,
        Cigarette,
        Leaf,
        Laptop,
        Puzzle,
        Shirt,
        Armchair,
        Ticket,
        Wine,
        CalendarCheck2,
        CalendarClock,
        CalendarDays,
        Car,
        CarTaxiFront,
        ChartPie,
        Check,
        CheckCircle2,
        ChevronDown,
        ChevronLeft,
        ChevronRight,
        ChevronUp,
        Circle,
        CircleDot,
        CircleHelp,
        Clapperboard,
        Columns3,
        Cloud,
        CreditCard,
        Download,
        Dumbbell,
        Ellipsis,
        Eye,
        Fingerprint,
        Flag,
        Folders,
        Fuel,
        Gamepad2,
        Gift,
        GitCompareArrows,
        GraduationCap,
        Grid2X2,
        GripVertical,
        HandCoins,
        HandHeart,
        HardDrive,
        Heart,
        HeartHandshake,
        HeartPulse,
        House,
        Info,
        KeyRound,
        Landmark,
        Layers3,
        ListFilter,
        ListOrdered,
        LockKeyhole,
        LogOut,
        Moon,
        Palette,
        PawPrint,
        Percent,
        PiggyBank,
        Plane,
        Play,
        Plus,
        Receipt,
        ReceiptText,
        RefreshCcw,
        Repeat2,
        ScanEye,
        ScanLine,
        Scissors,
        Search,
        Settings2,
        Shapes,
        SlidersHorizontal,
        Shield,
        ShieldCheck,
        ShoppingBag,
        ShoppingBasket,
        Smartphone,
        Sparkles,
        Sun,
        Tags,
        Target,
        TrainFront,
        TrendingDown,
        TrendingUp,
        Utensils,
        Wallet,
        Waves,
        Wifi,
        Wrench,
        X,
        Zap,
      } as Record<string, React.ComponentType<LucideProps>>
    )[name] || Circle
  return <Component size={size} strokeWidth={1.8} {...props} />
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">p</div>
      {!compact && (
        <span className="brand-word">
          pockit<span>.</span>
        </span>
      )}
    </div>
  )
}
export function MonthPicker({
  month,
  setMonth,
}: {
  month: MonthKey
  setMonth: (month: MonthKey) => void
}) {
  return (
    <div className="month-picker">
      <button aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
        <Icon name="ChevronLeft" size={17} />
      </button>
      <span>{monthLabel(month)}</span>
      <button aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
        <Icon name="ChevronRight" size={17} />
      </button>
    </div>
  )
}
export function SectionHead({
  title,
  aside,
  help,
}: {
  title: string
  aside?: ReactNode
  help?: string
}) {
  const [open, setOpen] = useState(false)
  useBodyScrollLock(open)
  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])
  return (
    <div className="section-head">
      <h2 className="section-title">
        {title}
        {help && (
          <span className="help-wrap">
            <button
              className="help"
              aria-label={`About ${title}`}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <Icon name="Info" size={15} />
            </button>
            {open &&
              createPortal(
                <div className="help-overlay" onClick={() => setOpen(false)}>
                  <div
                    className="help-popover"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${title}, explained`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Icon name="Sparkles" size={20} />
                    <div>
                      <strong>{title}, explained</strong>
                      <p>{help}</p>
                    </div>
                    <button
                      aria-label={`Close explanation for ${title}`}
                      onClick={() => setOpen(false)}
                    >
                      <Icon name="X" size={19} />
                    </button>
                  </div>
                </div>,
                document.body,
              )}
          </span>
        )}
      </h2>
      {aside}
    </div>
  )
}
export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: string
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={25} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  )
}
export function Progress({ value, color = 'var(--lime)' }: { value: number; color?: string }) {
  return (
    <div className="progress">
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  )
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useBodyScrollLock(true)
  const viewport = usePhoneViewport()
  const reduceMotion = useReducedMotion()
  const controls = useAnimationControls()
  const dialog = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const mounted = useRef(true)
  const closeCallback = useRef(onClose)
  closeCallback.current = onClose
  const dismiss = async () => {
    if (closing.current) return
    closing.current = true
    if (!reduceMotion)
      await controls.start({
        opacity: 0,
        y: 10,
        scale: 0.99,
        transition: { duration: 0.14, ease: 'easeIn' },
      })
    if (mounted.current) closeCallback.current()
  }
  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss
  useEffect(() => {
    mounted.current = true
    controls.start({ opacity: 1, y: 0, scale: 1 })
    const previous = dialogReturnTarget()
    dialog.current?.focus({ preventScroll: true })
    const keydown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]')
      if (dialogs[dialogs.length - 1] !== dialog.current) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        void dismissRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const elements = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex="0"]',
        ) || []),
      ].filter(
        (item) => !item.hasAttribute('disabled') && !item.closest('[hidden]') && item.tabIndex >= 0,
      )
      const first = elements[0],
        last = elements.at(-1)
      if (!first) {
        event.preventDefault()
        return
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog.current)
      ) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialog.current)
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      mounted.current = false
      document.removeEventListener('keydown', keydown)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [controls])
  return createPortal(
    <div
      className="modal-backdrop"
      style={
        viewport
          ? ({
              height: viewport.height,
              top: viewport.top,
              bottom: 'auto',
              '--overlay-height': `${viewport.height}px`,
            } as CSSProperties)
          : undefined
      }
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) void dismiss()
      }}
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={controls}
        ref={dialog}
        tabIndex={-1}
        transition={reduceMotion ? { duration: 0 } : pockitSpring}
        className={`modal studio-modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={() => void dismiss()}>
            <Icon name="X" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>,
    document.body,
  )
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean, origin: Element) => void
  label: string
  description?: string
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) =>
          onChange(e.target.checked, e.currentTarget.nextElementSibling || e.currentTarget)
        }
      />
      <span className="toggle-track" />
    </label>
  )
}
