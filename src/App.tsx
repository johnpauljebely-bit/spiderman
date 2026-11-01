import { useEffect, useMemo, useRef, useState } from 'react'
import { BackgroundPanel } from './components/BackgroundPanel'
import { ExportButton } from './components/ExportButton'
import { PreviewCanvas } from './components/PreviewCanvas'
import { SequenceEditor } from './components/SequenceEditor'
import { SettingsPanel } from './components/SettingsPanel'
import { UploadPanel } from './components/UploadPanel'
import { getTotalDurationMs } from './lib/animate'
import { computeAutoGroups } from './lib/autoSequence'
import { autoCalibrate } from './lib/colorAnalysis'
import { DEFAULT_BACKGROUND, DEFAULT_SETTINGS } from './lib/defaults'
import { combinedBounds, preparePaths, type Bounds, type PreparedPath } from './lib/preparedPath'
import { imageToImageData, loadImageFromFile, parseSvgText, vectorizeImageData, type VectorizeResult } from './lib/vectorize'
import type { AnimSettings, BackgroundSettings, PickMode, SequenceGroup } from './types'
import { AuthGate } from './components/AuthGate'
import { LoadingGate } from './components/LoadingGate'
import { SmoothScroll } from './components/SmoothScroll'
import type { DiscordUser } from './lib/discordAuth'

/** The tool itself: sign in with Discord, then trace, animate and export. Routing lives in main.tsx. */
export default function App() {
  return (
    <>
      <SmoothScroll />
      <LoadingGate>
        <AuthGate>{(user, logout) => <AppContent user={user} onLogout={logout} />}</AuthGate>
      </LoadingGate>
    </>
  )
}

function AppContent({ user, onLogout }: { user: DiscordUser; onLogout: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [isRaster, setIsRaster] = useState(false)
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [numberOfColors, setNumberOfColors] = useState(4)
  const [pathomit, setPathomit] = useState(8)
  const [smoothing, setSmoothing] = useState(60)
  const [preparedPaths, setPreparedPaths] = useState<PreparedPath[]>([])
  const [logoBounds, setLogoBounds] = useState<Bounds>({ x: 0, y: 0, width: 512, height: 512 })
  const [background, setBackground] = useState<BackgroundSettings>(DEFAULT_BACKGROUND)
  const [settings, setSettings] = useState<AnimSettings>(DEFAULT_SETTINGS)
  const [groups, setGroups] = useState<SequenceGroup[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [pickMode, setPickMode] = useState<PickMode>('none')
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoSequence, setAutoSequence] = useState(false)

  const debounceRef = useRef<number | undefined>(undefined)
  const skipNextAutoRetraceRef = useRef(false)

  function applyResult(result: VectorizeResult) {
    const prepared = preparePaths(result.paths)
    setPreparedPaths(prepared)
    setLogoBounds(prepared.length ? combinedBounds(prepared) : { x: 0, y: 0, width: result.width, height: result.height })
    // A fresh trace hands out fresh path ids, so any previous grouping/picks no longer apply.
    setGroups([])
    setActiveGroupId(null)
    setPickMode('none')
    setSelectedPathId(null)
  }

  async function traceImageData(imageData: ImageData, opts: { numberOfColors: number; pathomit: number; smoothing: number }) {
    setLoading(true)
    setError(null)
    try {
      const result = vectorizeImageData(imageData, opts)
      applyResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trace image')
    } finally {
      setLoading(false)
    }
  }

  async function runVectorize(img: HTMLImageElement, opts: { numberOfColors: number; pathomit: number; smoothing: number }) {
    const { imageData } = imageToImageData(img)
    await traceImageData(imageData, opts)
  }

  async function handleFileSelected(file: File) {
    setFileName(file.name)
    setError(null)
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')

    if (isSvg) {
      setIsRaster(false)
      setSourceImage(null)
      try {
        const text = await file.text()
        applyResult(parseSvgText(text))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse SVG')
      }
      return
    }

    setIsRaster(true)
    try {
      const img = await loadImageFromFile(file)
      setSourceImage(img)
      const { imageData } = imageToImageData(img)
      // Auto-calibrate to this image instead of tracing with generic defaults: forcing too many
      // color clusters onto a simple flat logo is what causes the grey/incomplete-looking fill and
      // fragmented, jagged output — detecting the real dominant colors avoids that from the start.
      const calibrated = autoCalibrate(imageData)
      skipNextAutoRetraceRef.current = true
      setNumberOfColors(calibrated.numberOfColors)
      setSmoothing(calibrated.smoothing)
      await traceImageData(imageData, { ...calibrated, pathomit })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image')
    }
  }

  useEffect(() => {
    if (!sourceImage) return
    if (skipNextAutoRetraceRef.current) {
      skipNextAutoRetraceRef.current = false
      return
    }
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      runVectorize(sourceImage, { numberOfColors, pathomit, smoothing })
    }, 300)
    return () => window.clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberOfColors, pathomit, smoothing])

  function handlePickPoint(pathId: string, length: number, field: 'start' | 'end') {
    setPreparedPaths((prev) => prev.map((p) => (p.id === pathId ? { ...p, [field === 'start' ? 'startLength' : 'endLength']: length } : p)))
  }

  function handleAssignShape(pathId: string) {
    if (!activeGroupId) return
    setGroups((prev) =>
      prev.map((g) =>
        g.id === activeGroupId
          ? { ...g, pathIds: g.pathIds.includes(pathId) ? g.pathIds.filter((id) => id !== pathId) : [...g.pathIds, pathId] }
          : g,
      ),
    )
  }

  function handleClearEndPoint() {
    if (!selectedPathId) return
    setPreparedPaths((prev) => prev.map((p) => (p.id === selectedPathId ? { ...p, endLength: null } : p)))
  }

  const scene = useMemo(
    () => (preparedPaths.length ? { paths: preparedPaths, logoBounds, background } : null),
    [preparedPaths, logoBounds, background],
  )

  const autoGroups = useMemo(() => computeAutoGroups(preparedPaths, settings.outlineDrawMs), [preparedPaths, settings.outlineDrawMs])
  const effectiveGroups = autoSequence ? autoGroups : groups

  const loopLengthMs = useMemo(
    () => getTotalDurationMs(settings, preparedPaths, effectiveGroups),
    [settings, preparedPaths, effectiveGroups],
  )

  return (
    <div className="min-h-screen px-6 pb-16 text-ink">
      <div className="mx-auto max-w-6xl">
        <header className="sticky top-0 z-40 -mx-6 flex items-center justify-between gap-4 bg-gradient-to-b from-white from-55% to-white/0 px-6 py-4">
          <a href="/" aria-label="Move home" className="grid h-10 w-10 place-items-center rounded-xl">
            <img src="/move-logo.svg" alt="" className="h-5 w-auto select-none invert" draggable={false} />
          </a>
          <nav className="app-nav-pill" aria-label="Main">
            <a href="/docs" target="_blank" rel="noopener" className="app-nav-link">
              Docs
            </a>
            <span className="flex items-center gap-2 px-2.5">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.06)]">
                  {(user.globalName ?? user.username).slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">{user.globalName ?? user.username}</span>
            </span>
            <button type="button" onClick={onLogout} className="btn btn-primary rounded-full px-4 py-2 text-sm font-medium">
              Log out
            </button>
          </nav>
        </header>

        <div className="pb-8 pt-4">
          <p className="text-[15px] text-faint">Logo animator</p>
          <h1 className="mt-2.5 text-[clamp(2.25rem,4.6vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.05em]">Make your logo move.</h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted">Trace a logo, tune the reveal, export a looping GIF.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div
              className="surface rounded-[20px] p-4"
              style={
                background.kind === 'transparent'
                  ? {
                      backgroundImage:
                        'linear-gradient(45deg, #e4e4e7 25%, transparent 25%), linear-gradient(-45deg, #e4e4e7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e4e4e7 75%), linear-gradient(-45deg, transparent 75%, #e4e4e7 75%)',
                      backgroundSize: '20px 20px',
                      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                      backgroundColor: '#ffffff',
                    }
                  : undefined
              }
            >
              <PreviewCanvas
                scene={scene}
                settings={settings}
                groups={effectiveGroups}
                pickMode={pickMode}
                onPickPoint={handlePickPoint}
                onAssignShape={handleAssignShape}
                selectedPathId={selectedPathId}
                onSelectPath={setSelectedPathId}
              />
            </div>

            {pickMode === 'end' && selectedPathId && preparedPaths.find((p) => p.id === selectedPathId)?.endLength != null && (
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={handleClearEndPoint} className="text-xs text-muted underline hover:text-ink">
                  Clear end point (draw full loop instead)
                </button>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <ExportButton scene={scene} settings={settings} groups={effectiveGroups} />
            </div>

            <SequenceEditor
              paths={preparedPaths}
              groups={groups}
              onGroupsChange={setGroups}
              pickMode={pickMode}
              onPickModeChange={setPickMode}
              activeGroupId={activeGroupId}
              onActiveGroupChange={setActiveGroupId}
              autoSequence={autoSequence}
              onAutoSequenceChange={setAutoSequence}
              autoGroups={autoGroups}
            />
          </div>

          <div className="flex flex-col gap-4">
            <UploadPanel
              onFileSelected={handleFileSelected}
              fileName={fileName}
              isRaster={isRaster}
              numberOfColors={numberOfColors}
              pathomit={pathomit}
              smoothing={smoothing}
              onQualityChange={(opts) => {
                if (opts.numberOfColors !== undefined) setNumberOfColors(opts.numberOfColors)
                if (opts.pathomit !== undefined) setPathomit(opts.pathomit)
                if (opts.smoothing !== undefined) setSmoothing(opts.smoothing)
              }}
              elementCount={preparedPaths.length}
              loading={loading}
              error={error}
            />
            <BackgroundPanel background={background} onChange={setBackground} />
            <SettingsPanel
              settings={settings}
              onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
              loopLengthMs={loopLengthMs}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
