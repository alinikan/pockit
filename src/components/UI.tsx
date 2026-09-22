import type { ReactNode } from 'react'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bike,
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
  Clapperboard,
  Cloud,
  CreditCard,
  Download,
  Dumbbell,
  Ellipsis,
  Flag,
  Folders,
  Fuel,
  Gamepad2,
  Gift,
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
  Search,
  Settings2,
  Shapes,
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
        ArrowDownLeft,
        ArrowLeft,
        ArrowLeftRight,
        ArrowRight,
        ArrowUp,
        ArrowUpRight,
        Bike,
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
        Clapperboard,
        Cloud,
        CreditCard,
        Download,
        Dumbbell,
        Ellipsis,
        Flag,
        Folders,
        Fuel,
        Gamepad2,
        Gift,
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
        Search,
        Settings2,
        Shapes,
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
      <div className="brand-mark">
        p<span>.</span>
      </div>
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
  return (
    <div className="section-head">
      <div className="section-title">
        {title}
        {help && (
          <button
            className="help"
            aria-label={`About ${title}`}
            title={help}
            onClick={() => window.alert(help)}
          >
            ?
          </button>
        )}
      </div>
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
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <Icon name="X" />
          </button>
        </div>
        {children}
      </div>
    </div>
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
  onChange: (value: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
    </label>
  )
}
