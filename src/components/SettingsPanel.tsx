import type { AnimSettings } from '../types'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { EASING_OPTIONS } from '../lib/easing'
import { Badge, FieldRow, Panel, Section, SegmentedControl, Select, SliderRow } from './ui'

const FINE_TUNE_KEYS = [
  'startHoldMs',
  'outlineDrawMs',
  'fillFadeMs',
  'holdEndMs',
  'easing',
  'wipeDirection',
  'wipeSoftness',
  'fadeOutMs',
  'fadeOverlapMs',
  'fadeOutStyle',
  'fadeOutReverse',
  'fillStyleReverse',
  'strokeLaps',
] as const satisfies (keyof AnimSettings)[]

const STYLE_DESCRIPTIONS: Record<AnimSettings['style'], string> = {
  'draw-fill': 'Outline draws itself on like a pen, then the color fades in behind it.',
  'fade-wipe': 'The color sweeps in across each shape from one edge, like a blind opening.',
}

const WIPE_DIRECTION_OPTIONS: { value: AnimSettings['wipeDirection']; label: string }[] = [
  { value: 'left-right', label: 'Left → Right' },
  { value: 'right-left', label: 'Right → Left' },
  { value: 'top-bottom', label: 'Top → Bottom' },
  { value: 'bottom-top', label: 'Bottom → Top' },
  { value: 'diagonal-up', label: 'Diagonal ↗' },
  { value: 'diagonal-down', label: 'Diagonal ↙' },
]

const FILL_STYLE_OPTIONS: { value: AnimSettings['fillStyle']; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'linear', label: 'Linear' },
  { value: 'diagonal', label: 'Diagonal' },
]

function fillStyleHint(style: AnimSettings['fillStyle'], reversed: boolean): string {
  if (style === 'normal') return 'The color fades in evenly across the whole shape at once.'
  if (style === 'linear') {
    return reversed ? 'The color comes down from the top, like drawing a blind.' : 'The color rises up from the bottom, like a glass filling.'
  }
  return reversed
    ? 'The color sweeps in from the top-right corner toward the bottom-left.'
    : 'The color sweeps in from the bottom-left corner toward the top-right.'
}

function ReverseToggle({ reversed, onChange }: { reversed: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!reversed)}
      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
        reversed ? 'border-accent bg-accent text-white' : 'border-panel-border text-zinc-400 hover:text-zinc-200'
      }`}
    >
      Reverse
    </button>
  )
}

export function SettingsPanel({
  settings,
  onChange,
  loopLengthMs,
}: {
  settings: AnimSettings
  onChange: (patch: Partial<AnimSettings>) => void
  loopLengthMs: number
}) {
  return (
    <Panel title="Animation" className="space-y-2.5">
      <Section title="Reveal style" subtitle={`${(loopLengthMs / 1000).toFixed(1)}s per loop`} defaultOpen>
        <SegmentedControl
          options={[
            { value: 'draw-fill', label: 'Draw & Fill' },
            { value: 'fade-wipe', label: 'Fade Wipe' },
          ]}
          value={settings.style}
          onChange={(style) => onChange({ style })}
        />
        <p className="mb-4 mt-2 text-xs text-muted">{STYLE_DESCRIPTIONS[settings.style]}</p>

        <SliderRow
          label="Speed"
          hint="Scales the whole animation. Higher = faster and snappier, lower = slower and more dramatic."
          value={Math.round(settings.speed * 100)}
          min={10}
          max={200}
          step={5}
          onChange={(v) => onChange({ speed: v / 100 })}
          formatValue={(v) => `${v}%`}
        />
        <p className="text-[11px] leading-snug text-muted">
          Use "Assign shapes" under the preview to group shapes and control what plays after what.
        </p>
      </Section>

      {settings.style === 'draw-fill' && (
        <Section title="Look" subtitle="Stroke, pen laps, fill style">
          <SliderRow
            label="Stroke width"
            hint="How thick the drawn outline is."
            value={settings.strokeWidth}
            min={0.5}
            max={12}
            step={0.5}
            onChange={(v) => onChange({ strokeWidth: v })}
            formatValue={(v) => `${v}px`}
          />
          <SliderRow
            label="Pen laps"
            hint="How many times the pen retraces each shape's outline before filling — 1 is a normal single pass, 2-3 gives a sketchy, hand-drawn feel. Fits inside the same outline-draw duration."
            value={settings.strokeLaps}
            min={1}
            max={3}
            step={1}
            onChange={(v) => onChange({ strokeLaps: v })}
            formatValue={(v) => `${v}x`}
          />
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-zinc-400">Fill style</span>
              {settings.fillStyle !== 'normal' && (
                <ReverseToggle reversed={settings.fillStyleReverse} onChange={(fillStyleReverse) => onChange({ fillStyleReverse })} />
              )}
            </div>
            <SegmentedControl options={FILL_STYLE_OPTIONS} value={settings.fillStyle} onChange={(fillStyle) => onChange({ fillStyle })} />
            <p className="mt-1 text-[11px] leading-snug text-muted">{fillStyleHint(settings.fillStyle, settings.fillStyleReverse)}</p>
          </div>
        </Section>
      )}

      <Section
        title="Ghost preview"
        subtitle="Faint full-shape preview before it's revealed"
        badge={settings.ghostOpacity > 0 ? <Badge tone="accent">on</Badge> : undefined}
      >
        <SliderRow
          label="Opacity"
          hint="Shows the whole logo faintly from the start, underneath the reveal, instead of staying invisible until each piece draws in."
          value={Math.round(settings.ghostOpacity * 100)}
          min={0}
          max={60}
          step={5}
          onChange={(v) => onChange({ ghostOpacity: v / 100 })}
          formatValue={(v) => (v === 0 ? 'off' : `${v}%`)}
        />
        {settings.ghostOpacity > 0 && (
          <div>
            <SegmentedControl
              options={[
                { value: 'fill', label: 'Filled' },
                { value: 'outline', label: 'Outline only' },
              ]}
              value={settings.ghostStyle}
              onChange={(ghostStyle) => onChange({ ghostStyle })}
            />
            <p className="mt-1 text-[11px] leading-snug text-muted">
              {settings.ghostStyle === 'fill'
                ? 'A faint filled silhouette of the whole logo shows underneath the reveal.'
                : 'Only faint outline strokes show underneath the reveal — no fill.'}
            </p>
          </div>
        )}
      </Section>

      <Section
        title="Timing"
        subtitle="Exact-millisecond controls behind Speed"
        right={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange(Object.fromEntries(FINE_TUNE_KEYS.map((key) => [key, DEFAULT_SETTINGS[key]])))
            }}
            className="text-[11px] text-muted transition-colors hover:text-accent"
          >
            Reset
          </button>
        }
      >
        <SliderRow
          label="Hold at start"
          hint="Shows the finished logo before the animation resets and plays. Keeps GIF previews in Discord/Slack looking like your logo instead of an empty frame."
          value={settings.startHoldMs}
          min={0}
          max={3000}
          step={50}
          onChange={(v) => onChange({ startHoldMs: v })}
          formatValue={(v) => `${v}ms`}
        />

        {settings.style === 'draw-fill' ? (
          <>
            <SliderRow
              label="Outline draw"
              hint="How long it takes each shape's outline to draw itself in."
              value={settings.outlineDrawMs}
              min={100}
              max={4000}
              step={50}
              onChange={(v) => onChange({ outlineDrawMs: v })}
              formatValue={(v) => `${v}ms`}
            />
            <SliderRow
              label="Fill fade"
              hint="How long the color takes to fade/sweep in after the outline finishes drawing."
              value={settings.fillFadeMs}
              min={0}
              max={2000}
              step={50}
              onChange={(v) => onChange({ fillFadeMs: v })}
              formatValue={(v) => `${v}ms`}
            />
            {settings.fillStyle !== 'normal' && (
              <SliderRow
                label="Fill softness"
                hint="How blurry the fill sweep's edge is. 0% is a hard line, higher is a wider, softer gradient."
                value={Math.round(settings.wipeSoftness * 100)}
                min={0}
                max={100}
                step={5}
                onChange={(v) => onChange({ wipeSoftness: v / 100 })}
                formatValue={(v) => `${v}%`}
              />
            )}
          </>
        ) : (
          <>
            <SliderRow
              label="Reveal duration"
              hint="How long the wipe takes to sweep across each shape."
              value={settings.outlineDrawMs}
              min={100}
              max={4000}
              step={50}
              onChange={(v) => onChange({ outlineDrawMs: v, fillFadeMs: 0 })}
              formatValue={(v) => `${v}ms`}
            />
            <FieldRow label="Direction" hint="Which way the wipe sweeps across each shape.">
              <Select value={settings.wipeDirection} onChange={(wipeDirection) => onChange({ wipeDirection })} options={WIPE_DIRECTION_OPTIONS} />
            </FieldRow>
            <SliderRow
              label="Softness"
              hint="How blurry the wipe's edge is. 0% is a hard line, higher is a wider, softer gradient."
              value={Math.round(settings.wipeSoftness * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(v) => onChange({ wipeSoftness: v / 100 })}
              formatValue={(v) => `${v}%`}
            />
          </>
        )}

        <SliderRow
          label="Hold at end"
          hint="How long the finished logo stays fully visible before the loop restarts."
          value={settings.holdEndMs}
          min={0}
          max={4000}
          step={50}
          onChange={(v) => onChange({ holdEndMs: v })}
          formatValue={(v) => `${v}ms`}
        />

        <FieldRow label="Easing" hint="The pacing within each step — try Ease Out for a fast-start, slow-finish feel.">
          <Select value={settings.easing} onChange={(easing) => onChange({ easing })} options={EASING_OPTIONS} />
        </FieldRow>
      </Section>

      <Section
        title="Loop fade"
        subtitle="Dissolve at the end of each loop instead of a hard cut"
        badge={settings.fadeOutMs > 0 ? <Badge tone="accent">on</Badge> : undefined}
      >
        <SliderRow
          label="Fade out at loop end"
          hint="Dissolves the finished logo away at the end of each loop instead of hard-cutting back to blank. 0 = hard cut."
          value={settings.fadeOutMs}
          min={0}
          max={3000}
          step={50}
          onChange={(v) => onChange({ fadeOutMs: v, fadeOverlapMs: Math.min(settings.fadeOverlapMs, v) })}
          formatValue={(v) => (v === 0 ? 'off' : `${v}ms`)}
        />

        {settings.fadeOutMs > 0 && (
          <>
            <SliderRow
              label="Overlap with next reveal"
              hint="How early the next loop's reveal starts, before this fade-out finishes — higher overlaps the two more."
              value={settings.fadeOverlapMs}
              min={0}
              max={settings.fadeOutMs}
              step={50}
              onChange={(v) => onChange({ fadeOverlapMs: v })}
              formatValue={(v) => `${v}ms`}
            />
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs text-zinc-400">Fade out style</span>
                {settings.fadeOutStyle !== 'normal' && (
                  <ReverseToggle reversed={settings.fadeOutReverse} onChange={(fadeOutReverse) => onChange({ fadeOutReverse })} />
                )}
              </div>
              <SegmentedControl options={FILL_STYLE_OPTIONS} value={settings.fadeOutStyle} onChange={(fadeOutStyle) => onChange({ fadeOutStyle })} />
              <p className="mt-1 text-[11px] leading-snug text-muted">
                Same mechanics as Fill style, but for the dissolve. {fillStyleHint(settings.fadeOutStyle, settings.fadeOutReverse)}
              </p>
            </div>
          </>
        )}
      </Section>
    </Panel>
  )
}
