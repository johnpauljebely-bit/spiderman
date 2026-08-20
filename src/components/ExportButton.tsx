import { useState } from 'react'
import type { AnimSettings, SequenceGroup } from '../types'
import { downloadBlob, exportGif } from '../lib/gifExport'
import type { RenderScene } from '../lib/render'
import { Select, SliderRow } from './ui'

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: '384', label: '384px' },
  { value: '512', label: '512px' },
  { value: '768', label: '768px' },
  { value: '1024', label: '1024px' },
]

export function ExportButton({ scene, settings, groups }: { scene: RenderScene | null; settings: AnimSettings; groups: SequenceGroup[] }) {
  const [size, setSize] = useState(768)
  const [fps, setFps] = useState(30)
  const [maxColors, setMaxColors] = useState(256)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showQuality, setShowQuality] = useState(false)

  async function handleExport() {
    if (!scene || scene.paths.length === 0) return
    setError(null)
    setProgress(0)
    try {
      const blob = await exportGif(scene, settings, groups, { width: size, height: size, fps, maxColors }, setProgress)
      downloadBlob(blob, 'logo-animation.gif')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setProgress(null)
    }
  }

  const disabled = !scene || scene.paths.length === 0 || progress !== null

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-end">
        <button type="button" onClick={() => setShowQuality((v) => !v)} className="text-xs text-muted hover:text-accent">
          {showQuality ? 'Hide' : 'Export quality'} {showQuality ? '▾' : '▸'}
        </button>
      </div>

      {showQuality && (
        <div className="glass-inset accordion-content mb-3 rounded-xl p-3.5">
          <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
            <span>Size</span>
            <Select value={String(size)} onChange={(v) => setSize(Number(v))} options={SIZE_OPTIONS} />
          </div>
          <SliderRow
            label="Frame rate"
            hint="More frames per second = smoother motion, but a bigger file."
            value={fps}
            min={12}
            max={50}
            step={2}
            onChange={setFps}
            formatValue={(v) => `${v}fps`}
          />
          <SliderRow
            label="Colors"
            hint="More colors = more accurate gradients and shading, at a larger file size."
            value={maxColors}
            min={32}
            max={256}
            step={16}
            onChange={setMaxColors}
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleExport}
        disabled={disabled}
        className="liquid-btn liquid-btn-accent w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {progress !== null ? `Rendering… ${Math.round(progress * 100)}%` : 'Export GIF'}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}
