import { useRef } from 'react'
import type { BackgroundSettings } from '../types'
import { Panel, SegmentedControl } from './ui'

export function BackgroundPanel({
  background,
  onChange,
}: {
  background: BackgroundSettings
  onChange: (background: BackgroundSettings) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Panel title="Background">
      <div className="mb-3">
        <SegmentedControl
          options={[
            { value: 'color', label: 'Solid color' },
            { value: 'image', label: 'Image' },
            { value: 'transparent', label: 'Transparent' },
          ]}
          value={background.kind}
          onChange={(kind) => onChange({ ...background, kind })}
        />
      </div>

      {background.kind === 'color' && (
        <div className="glass-inset flex items-center gap-3 rounded-lg px-3 py-2">
          <input
            type="color"
            value={background.color}
            onChange={(e) => onChange({ ...background, color: e.target.value })}
            className="h-9 w-9 cursor-pointer rounded-md border border-panel-border bg-transparent p-0"
          />
          <span className="text-xs text-zinc-400">{background.color}</span>
        </div>
      )}

      {background.kind === 'transparent' && (
        <p className="text-xs text-muted">
          Exports as a real transparent GIF (no background at all) — good for overlays and chat apps.
        </p>
      )}

      {background.kind === 'image' && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const url = URL.createObjectURL(file)
              const img = new Image()
              img.onload = () => onChange({ ...background, image: img })
              img.src = url
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-panel-border bg-black/15 py-4 text-center text-xs text-zinc-400 transition-colors hover:border-accent hover:text-zinc-200"
          >
            {background.image ? 'Change background image' : 'Choose background image'}
          </button>
        </div>
      )}
    </Panel>
  )
}
