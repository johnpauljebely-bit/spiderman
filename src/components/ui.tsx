import clsx from 'clsx'
import { useId, useState, type CSSProperties, type ReactNode } from 'react'

export function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('glass rounded-2xl p-5', className)}>
      {title && <h3 className="mb-3 text-sm font-semibold tracking-tight text-ink">{title}</h3>}
      {children}
    </div>
  )
}

/**
 * A collapsible, glass-styled dropdown section — the building block for grouping settings into
 * named, expandable groups instead of one long flat scroll. `badge` renders a small pill next to
 * the title (e.g. an on/off state or a count) so you can tell what's inside without opening it.
 */
export function Section({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  right,
  children,
}: {
  title: string
  subtitle?: string
  badge?: ReactNode
  defaultOpen?: boolean
  right?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div className="glass-raised overflow-hidden rounded-xl border">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex flex-1 items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.03]"
        >
          <svg
            viewBox="0 0 20 20"
            className={clsx('h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200', open && 'rotate-90 text-accent')}
            fill="none"
          >
            <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">{title}</span>
              {badge}
            </div>
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-muted">{subtitle}</p>}
          </div>
        </button>
        {right && <div className="pr-3.5">{right}</div>}
      </div>
      {open && (
        <div id={contentId} className="accordion-content border-t border-panel-border px-3.5 pb-4 pt-3.5">
          {children}
        </div>
      )}
    </div>
  )
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' }) {
  return (
    <span
      className={clsx(
        'rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
        tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-white/10 text-muted',
      )}
    >
      {children}
    </span>
  )
}

/** A proper on/off switch — used for the header Godmode toggle, Auto-sequence, and similar booleans. */
export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: ReactNode; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 select-none">
      <span
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150',
          checked ? 'bg-accent' : 'bg-white/15',
        )}
      >
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 m-0 cursor-pointer opacity-0" />
        <span
          className={clsx(
            'inline-block h-3.5 w-3.5 transform rounded-full bg-black shadow transition-transform duration-150',
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
          )}
        />
      </span>
      <span className="text-xs text-zinc-200">
        {label}
        {hint && <span className="ml-1 text-muted">{hint}</span>}
      </span>
    </label>
  )
}

export function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}: {
  label: string
  /** Short plain-language explanation shown under the slider. */
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
}) {
  const fillPct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="font-medium text-ink">{formatValue ? formatValue(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${fillPct}%` } as CSSProperties}
        className="w-full"
      />
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  )
}

export function FieldRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        {children}
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  )
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="glass-inset flex rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value ? 'liquid-btn liquid-btn-accent text-white' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="glass-inset rounded-md px-2 py-1 text-xs text-zinc-200 outline-none"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#14171b] text-zinc-200">
          {opt.label}
        </option>
      ))}
    </select>
  )
}
