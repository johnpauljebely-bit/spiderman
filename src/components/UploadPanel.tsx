import { useRef } from 'react'
import { GooeyLoader } from './GooeyLoader'
import { Panel, SliderRow } from './ui'

export function UploadPanel({
  onFileSelected,
  fileName,
  isRaster,
  numberOfColors,
  pathomit,
  smoothing,
  onQualityChange,
  elementCount,
  loading,
  error,
}: {
  onFileSelected: (file: File) => void
  fileName: string | null
  isRaster: boolean
  numberOfColors: number
  pathomit: number
  smoothing: number
  onQualityChange: (opts: { numberOfColors?: number; pathomit?: number; smoothing?: number }) => void
  elementCount: number
  loading: boolean
  error: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Panel title="Logo">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml,.svg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelected(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mb-3 w-full rounded-xl border border-dashed border-panel-border bg-black/15 py-6 text-center text-xs text-zinc-400 transition-colors hover:border-accent hover:text-zinc-200"
      >
        {fileName ? (
          <span className="font-medium text-ink">{fileName}</span>
        ) : (
          <>Drop a transparent PNG or SVG, or click to browse</>
        )}
      </button>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {fileName && loading && (
        <div className="mb-3 flex items-center gap-2">
          <GooeyLoader className="h-4 text-[3px]" />
          <p className="text-xs text-muted">Tracing…</p>
        </div>
      )}

      {fileName && !loading && (
        <p className="mb-3 text-xs text-muted">{`${elementCount} element${elementCount === 1 ? '' : 's'} detected`}</p>
      )}

      {isRaster && (
        <>
          <SliderRow
            label="Smoothing"
            hint="Refits the traced outline with genuinely smooth curves instead of following pixel edges. Raise it if the outline still looks blocky or staircased; lower it to stay closer to fine detail."
            value={smoothing}
            min={0}
            max={100}
            step={5}
            onChange={(v) => onQualityChange({ smoothing: v })}
            formatValue={(v) => `${v}%`}
          />
          <SliderRow
            label="Colors"
            hint="Match this to how many real colors are in your logo. Set too high, it invents extra shades along soft/anti-aliased edges — a flat 1-2 color icon set to a high number often comes out grey and fragmented instead of solid."
            value={numberOfColors}
            min={2}
            max={24}
            step={1}
            onChange={(v) => onQualityChange({ numberOfColors: v })}
          />
          <SliderRow
            label="Simplify"
            hint="Filters out tiny stray shapes left over from tracing. Raise this if the result looks noisy or speckled."
            value={pathomit}
            min={0}
            max={30}
            step={1}
            onChange={(v) => onQualityChange({ pathomit: v })}
            formatValue={(v) => (v === 0 ? 'Off' : String(v))}
          />
        </>
      )}
    </Panel>
  )
}
