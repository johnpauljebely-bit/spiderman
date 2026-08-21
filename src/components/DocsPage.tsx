import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LoadingGate } from './LoadingGate'
import { SmoothScroll } from './SmoothScroll'
import { THEME_STORAGE_KEY, type Theme } from '../lib/theme'

type DocEntry = {
  label: string
  title: string
  description?: string
  items?: string[]
}

const ENTRIES: DocEntry[] = [
  {
    label: 'Quick start',
    title: 'The fastest way to get something working',
    description: 'If you just want a result in under a minute:',
    items: [
      "Click the Logo box and drop in your logo file. A transparent PNG or an SVG both work — transparent PNG is the safer bet if you're not sure.",
      "Wait a second for it to trace. You'll see “X elements detected” once it's done.",
      'The big preview should already be playing a reveal animation with the default settings.',
      'Pick a background (solid color is the default, or switch to Transparent if you want to drop the GIF over something else later).',
      'Hit Export GIF — that’s genuinely it for a simple logo. Everything below is for making it look better or more specific to your logo.',
    ],
  },
  {
    label: 'Logo',
    title: 'Getting a clean trace',
    description:
      'The tool has to turn your flat image into outlines it can draw — how well that works depends on three sliders that only show up after you upload a raster image (PNG/JPG). SVGs skip this entirely since they’re already made of clean paths.',
    items: [
      "Smoothing rounds out the traced outline so it doesn't look like jagged pixel steps. Push it up if fine detail is coming out blocky; pull it back down if it's melting away small details.",
      'Colors controls how many separate color regions the tracer looks for. Set it to match how many actual colors are in your logo — leave it too high on a flat 2-color icon and it starts inventing extra shades along anti-aliased edges, which comes out grey and fragmented instead of solid. When in doubt, go lower.',
      'Simplify cleans up tiny leftover specks from tracing. Raise it if the result looks noisy or speckled.',
      'The tool auto-guesses reasonable starting values the moment you upload, so for most logos you can leave these alone.',
    ],
  },
  {
    label: 'Background',
    title: 'Background',
    description:
      'Three options: Solid color, Image (upload a background photo or graphic), or Transparent, which exports a real transparent GIF — no background baked in at all. Use Transparent for a video editor, a slide deck, or anywhere with its own background already.',
  },
  {
    label: 'Animation',
    title: 'The Animation panel',
    items: [
      'Reveal style — Draw & Fill draws the outline on like a pen, then fades the color in behind it, the classic “logo animation” look. Fade Wipe sweeps the color in across each shape from one edge instead, like a blind opening.',
      'Speed scales the whole animation — higher is snappier, lower is slower and more dramatic. Everything in Timing is the exact-millisecond version of what Speed is roughly doing.',
      "Look (Draw & Fill only) — Stroke width sets how thick the drawn line is. Pen laps re-traces each shape before filling: 1 is a normal pass, 2-3 gives a sketchy, hand-drawn feel without slowing anything down. Fill style is Normal (fades in evenly), Linear (fills like a glass from the bottom, or top-down with Reverse), or Diagonal (sweeps from a corner).",
      'Ghost preview shows a faint version of the whole logo from the start, sitting underneath the reveal, instead of an empty canvas. Nice touch on logos with a lot of separate pieces.',
      'Timing holds the exact-millisecond controls — hold at start, outline/wipe duration, fill fade, hold at end, and an easing dropdown (Ease Out is a good default: fast start, slow finish).',
      'Loop fade — off by default, meaning a hard cut back to blank when it loops. Switch it on and it dissolves out instead; push Overlap up so the next reveal starts before the fade-out finishes, for a loop with no dead air.',
    ],
  },
  {
    label: 'Sequence',
    title: 'Controlling what plays first',
    items: [
      'Auto-sequence orders shapes biggest-to-smallest automatically — zero setup, a good default for anything with more than 2-3 elements.',
      "Turn it off for manual grouping: assign shapes to groups, then drag a group by its handle to reorder what plays first. Each group has a Gap before field — positive waits that long after the previous group, negative overlaps it, letting two pieces animate at the same time but slightly offset.",
      "Set start point and Set end point control exactly where a shape's outline starts and stops drawing — worth using on anything with an obvious start, like a signature or a single continuous line.",
    ],
  },
  {
    label: 'Export',
    title: 'Exporting',
    description:
      'Size: 384 / 512 / 768 / 1024px — 768 is a solid default. Frame rate: 12–50fps, 30 is a good middle ground. Colors: 32–256 — flat, simple logos can drop this a lot with no visible difference.',
  },
  {
    label: 'Presets',
    title: 'Presets worth starting from',
    items: [
      'Clean & simple — Draw & Fill, Speed 70%, Stroke width 2px, Pen laps 1, Fill style Normal, Easing Ease Out.',
      'Hand-drawn / sketchy — Draw & Fill, Speed 50%, Stroke width 3.5px, Pen laps 2-3, Outline draw ~1400ms, Easing Linear or Smooth.',
      'Snappy loop for social/chat — Draw & Fill, Speed 140%, Outline draw 400ms, Fill fade 200ms, Hold end 400ms, Loop fade on with Fade duration 200ms and Overlap 200ms (max).',
      'Cinematic reveal — Fade Wipe, Direction Diagonal ↗, Softness 40%, Reveal duration 1800ms, Hold at start 800ms, Hold at end 1400ms, Easing Ease In-Out.',
      'Glass fill — Draw & Fill, Fill style Linear (not reversed), Fill softness ~30%, Speed 70%.',
    ],
  },
  {
    label: 'Combos',
    title: 'Combos worth trying',
    items: [
      'Ghost outline + fast reveal — Ghost preview on, Outline only, opacity 15-20%, then a quick Draw & Fill on top. Reads like a coloring book: faint sketch first, then fills in.',
      "Pen laps 2 + thin stroke + slow speed — makes fine-lined logos look like someone's sketching them live, twice over.",
      'Manual groups with a negative gap — set a wordmark’s gap to something like -150ms so it starts just before the icon finishes instead of waiting for it completely.',
      'Fade Wipe with high softness (50%+) over an image background — reads more like light passing over the logo than a hard reveal.',
    ],
  },
  {
    label: 'Troubleshooting',
    title: 'If something looks off',
    items: [
      'Grey, broken up, or fragmented — the Colors slider is set higher than the logo needs. Bring it down.',
      'Outline looks blocky or jagged — raise Smoothing.',
      'Small details missing — lower Simplify.',
      'Outline starts from a weird spot — use Set start point and drag the marker.',
      'Loop feels like it has a gap — turn on Loop fade and push the overlap up.',
    ],
  },
]

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function matchesQuery(entry: DocEntry, query: string): boolean {
  if (!query) return true
  const haystack = [entry.label, entry.title, entry.description, ...(entry.items ?? [])].join(' ').toLowerCase()
  return haystack.includes(query)
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

const HAMBURGER_ICON = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
)

const SEARCH_ICON = (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={2} />
    <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
)

const ARROW_ICON = (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** A compact search box that expands into a results dropdown on focus — same interaction shape
 * (debounced filter, arrow-key navigation, footer shortcut hint, icon swap while typing) as the
 * ActionSearchBar used on other projects, rebuilt here with plain CSS instead of framer-motion so it
 * doesn't drag in a whole animation library for one input. */
function NavSearchBar({ onJump }: { onJump: (slug: string) => void }) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebouncedValue(query, 150).trim().toLowerCase()

  const results = useMemo(() => (debouncedQuery ? ENTRIES.filter((e) => matchesQuery(e, debouncedQuery)) : ENTRIES), [debouncedQuery])

  useEffect(() => {
    setActiveIndex(-1)
  }, [results])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      const isSlash = e.key === '/' && document.activeElement !== inputRef.current
      if (isShortcut || isSlash) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function jumpTo(entry: DocEntry) {
    onJump(slugify(entry.label))
    setQuery('')
    setIsFocused(false)
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      jumpTo(results[activeIndex])
    } else if (e.key === 'Escape') {
      setIsFocused(false)
      inputRef.current?.blur()
    }
  }

  const open = isFocused

  return (
    <div className="relative w-full max-w-[280px]">
      <div className="glass-inset flex items-center gap-2 rounded-full px-3.5 py-2">
        <span className="text-muted">{query ? ARROW_ICON : SEARCH_ICON}</span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Search docs…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        {!query && <kbd className="shrink-0 rounded border border-panel-border px-1.5 py-0.5 text-[10px] text-muted">/</kbd>}
      </div>

      <div
        className={clsx(
          'absolute left-0 right-0 top-[calc(100%+8px)] z-20 origin-top overflow-hidden rounded-xl border border-panel-border bg-canvas shadow-2xl transition-all duration-200',
          open ? 'max-h-80 scale-100 opacity-100' : 'pointer-events-none max-h-0 scale-95 opacity-0',
        )}
      >
        <ul role="listbox" className="max-h-64 overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-2 text-xs text-muted">No matches</li>}
          {results.map((entry, i) => (
            <li
              key={entry.label}
              role="option"
              aria-selected={activeIndex === i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => jumpTo(entry)}
              className={clsx(
                'flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                activeIndex === i ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-white/5 hover:text-ink',
              )}
            >
              <span className="truncate">{entry.title}</span>
              <span className="ml-3 shrink-0 text-[10px] text-muted">{entry.label}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-panel-border px-3 py-2 text-[10px] text-muted">
          <span>↵ to jump</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  )
}

function ChangelogEntry({ entry }: { entry: DocEntry }) {
  return (
    <div id={slugify(entry.label)} data-doc-section className="relative flex scroll-mt-24 flex-col gap-3 md:flex-row md:gap-16">
      <div className="top-24 flex h-min w-40 shrink-0 items-center md:sticky">
        <span className="glass-inset rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-muted">
          {entry.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col border-b border-panel-border pb-10">
        <h2 className="mb-2.5 text-lg font-semibold leading-tight text-ink">{entry.title}</h2>
        {entry.description && <p className="text-sm leading-relaxed text-muted">{entry.description}</p>}
        {entry.items && (
          <ul className="mt-3 ml-4 space-y-2 text-sm leading-relaxed text-muted">
            {entry.items.map((item, i) => (
              <li key={i} className="list-disc marker:text-accent">
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function DocsContent() {
  const [theme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'flat' ? 'flat' : 'liquid'
  })
  function jumpTo(slug: string) {
    document.getElementById(slug)?.scrollIntoView({ block: 'start' })
  }

  return (
    <div data-theme={theme} className="min-h-screen text-ink">
      <SmoothScroll />

      <header className="glass sticky top-0 z-30 flex items-center gap-4 rounded-none border-x-0 border-t-0 px-6 py-3.5">
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          className="liquid-btn liquid-btn-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
        >
          {HAMBURGER_ICON}
        </button>
        <span className="shrink-0 text-sm font-semibold tracking-tight text-ink">Logo Animator Docs</span>

        <div className="ml-auto flex items-center gap-3">
          <NavSearchBar onJump={jumpTo} />
          <a href="/" className="liquid-btn liquid-btn-accent shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white">
            Open the app
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-2 bg-gradient-to-br from-white to-white/60 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
          Logo Animator — Docs
        </h1>
        <p className="mb-10 text-sm text-muted">How to use it, from a first upload to advanced setting combos.</p>

        <div className="space-y-10">
          {ENTRIES.map((entry) => (
            <ChangelogEntry key={entry.label} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DocsPage() {
  return (
    <LoadingGate durationMs={3000}>
      <DocsContent />
    </LoadingGate>
  )
}
