import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { PickMode, SequenceGroup } from '../types'
import type { PreparedPath } from '../lib/preparedPath'
import { resolveGroups } from '../lib/animate'
import { Panel, Switch } from './ui'

const PICK_MODE_LABELS: { value: PickMode; label: string }[] = [
  { value: 'assign', label: 'Assign shapes' },
  { value: 'start', label: 'Set start point' },
  { value: 'end', label: 'Set end point' },
]

const PICK_MODE_HINTS: Record<PickMode, string> = {
  none: '',
  assign: 'Click shapes to add or remove them from the selected group below.',
  start: 'Click a shape to drop a red start marker — drag it to fine-tune exactly where the outline starts drawing from.',
  end: "Click a shape to drop an amber end marker — optional; without one the outline just draws the full loop back to its start.",
}

/**
 * A number input needs a local text buffer, not a direct `value={numberState}` binding — while typing
 * "-150" the field passes through intermediate states like "-" that aren't valid numbers yet. Coercing
 * those straight to `Number(...)` gives NaN, which gets written back into state and snaps the field's
 * displayed value away from what was just typed, making it impossible to ever finish typing a negative.
 */
function GapInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  function handleChange(raw: string) {
    setText(raw)
    if (raw === '' || raw === '-') return
    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) onChange(parsed)
  }

  function handleBlur() {
    if (text === '' || text === '-') setText(String(value))
  }

  return (
    <input
      type="number"
      value={text}
      step={10}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      className="glass-inset w-16 rounded px-1 py-0.5 text-zinc-200 outline-none"
    />
  )
}

function Swatches({ paths }: { paths: PreparedPath[] }) {
  return (
    <div className="flex -space-x-1">
      {paths.slice(0, 5).map((p) => (
        <span key={p.id} className="h-2.5 w-2.5 rounded-full border border-canvas" style={{ backgroundColor: p.color }} />
      ))}
      {paths.length > 5 && <span className="pl-1.5 text-[10px] text-muted">+{paths.length - 5}</span>}
    </div>
  )
}

export function SequenceEditor({
  paths,
  groups,
  onGroupsChange,
  pickMode,
  onPickModeChange,
  activeGroupId,
  onActiveGroupChange,
  autoSequence,
  onAutoSequenceChange,
  autoGroups,
}: {
  paths: PreparedPath[]
  groups: SequenceGroup[]
  onGroupsChange: Dispatch<SetStateAction<SequenceGroup[]>>
  pickMode: PickMode
  onPickModeChange: (mode: PickMode) => void
  activeGroupId: string | null
  onActiveGroupChange: (id: string | null) => void
  autoSequence: boolean
  onAutoSequenceChange: (value: boolean) => void
  autoGroups: SequenceGroup[]
}) {
  if (paths.length === 0) return null

  const byId = new Map(paths.map((p) => [p.id, p]))

  const autoToggle = (
    <div className="glass-inset flex items-center justify-between rounded-lg px-3 py-2">
      <Switch checked={autoSequence} onChange={onAutoSequenceChange} label="Auto-sequence" hint="— orders shapes by size for a cascading reveal" />
    </div>
  )

  const pickModeOptions = autoSequence ? PICK_MODE_LABELS.filter((opt) => opt.value !== 'assign') : PICK_MODE_LABELS

  const groupingSection = autoSequence ? (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {autoGroups.map((group, i) => (
          <div key={group.id} className="glass-inset flex items-center gap-1.5 rounded-md px-2 py-1">
            <span className="text-[10px] text-muted">Tier {i + 1}</span>
            <Swatches paths={group.pathIds.map((id) => byId.get(id)).filter((p): p is PreparedPath => !!p)} />
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-snug text-muted">
        Biggest shapes play first, smaller detail shapes cascade in after. Turn this off to group shapes yourself.
      </p>
    </div>
  ) : (
    <ManualGrouping
      paths={paths}
      groups={groups}
      onGroupsChange={onGroupsChange}
      activeGroupId={activeGroupId}
      onActiveGroupChange={onActiveGroupChange}
      onPickModeChange={onPickModeChange}
    />
  )

  return (
    <Panel title="Sequence" className="mt-3 space-y-3">
      {autoToggle}
      <div>
        <div className="glass-inset flex rounded-lg p-1">
          {pickModeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPickModeChange(pickMode === opt.value ? 'none' : opt.value)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                pickMode === opt.value ? 'liquid-btn liquid-btn-accent text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {pickMode !== 'none' && <p className="mt-1.5 text-[11px] leading-snug text-muted">{PICK_MODE_HINTS[pickMode]}</p>}
      </div>

      {groupingSection}
    </Panel>
  )
}

function ManualGrouping({
  paths,
  groups,
  onGroupsChange,
  activeGroupId,
  onActiveGroupChange,
  onPickModeChange,
}: {
  paths: PreparedPath[]
  groups: SequenceGroup[]
  onGroupsChange: Dispatch<SetStateAction<SequenceGroup[]>>
  activeGroupId: string | null
  onActiveGroupChange: (id: string | null) => void
  onPickModeChange: (mode: PickMode) => void
}) {
  const byId = new Map(paths.map((p) => [p.id, p]))
  const assigned = new Set(groups.flatMap((g) => g.pathIds))
  const ungroupedPaths = paths.filter((p) => !assigned.has(p.id))
  const resolved = resolveGroups(groups, paths)
  const firstResolvedId = resolved[0]?.id

  function addGroup() {
    const id = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    onGroupsChange((prev) => [...prev, { id, pathIds: [], gapMs: 0 }])
    onActiveGroupChange(id)
    onPickModeChange('assign')
  }

  function removeGroup(id: string) {
    onGroupsChange((prev) => prev.filter((g) => g.id !== id))
    if (activeGroupId === id) onActiveGroupChange(null)
  }

  function moveGroup(id: string, dir: -1 | 1) {
    onGroupsChange((prev) => {
      const i = prev.findIndex((g) => g.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function updateGap(id: string, gapMs: number) {
    onGroupsChange((prev) => prev.map((g) => (g.id === id ? { ...g, gapMs } : g)))
  }

  function clearAll() {
    onGroupsChange([])
    onActiveGroupChange(null)
    onPickModeChange('none')
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Once you've started building real groups, the automatic "everything else" bucket is just
            clutter — hide it so the workspace shows only what you've deliberately organized. */}
        {ungroupedPaths.length > 0 && groups.length === 0 && (
          <div className="glass-inset flex items-center gap-1.5 rounded-md px-2 py-1">
            <span className="text-[10px] text-muted">Ungrouped · plays first</span>
            <Swatches paths={ungroupedPaths} />
          </div>
        )}

        {groups.map((group, i) => {
          const members = group.pathIds.map((id) => byId.get(id)).filter((p): p is PreparedPath => !!p)
          const isActive = activeGroupId === group.id
          const gapIgnored = group.id === firstResolvedId

          return (
            <div
              key={group.id}
              onClick={() => {
                onActiveGroupChange(group.id)
                onPickModeChange('assign')
              }}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border px-2 py-1.5 transition-colors ${
                isActive ? 'border-accent bg-accent-soft' : 'glass-inset border-panel-border hover:border-zinc-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted">Group {i + 1}</span>
                <Swatches paths={members} />
                <div className="ml-auto flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      moveGroup(group.id, -1)
                    }}
                    disabled={i === 0}
                    className="px-1 text-zinc-500 hover:text-accent disabled:pointer-events-none disabled:opacity-20"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      moveGroup(group.id, 1)
                    }}
                    disabled={i === groups.length - 1}
                    className="px-1 text-zinc-500 hover:text-accent disabled:pointer-events-none disabled:opacity-20"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeGroup(group.id)
                    }}
                    className="px-1 text-zinc-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {!gapIgnored && (
                <label onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-[10px] text-muted">
                  Gap before
                  <GapInput value={group.gapMs} onChange={(gapMs) => updateGap(group.id, gapMs)} />
                  ms
                </label>
              )}
              {gapIgnored && <span className="text-[10px] text-muted">Plays first — no gap</span>}
            </div>
          )
        })}

        <button
          type="button"
          onClick={addGroup}
          className="rounded-md border border-dashed border-panel-border px-2 py-1.5 text-xs text-zinc-400 transition-colors hover:border-accent hover:text-accent"
        >
          + Add group
        </button>

        {groups.length > 0 && (
          <button type="button" onClick={clearAll} className="text-xs text-muted underline hover:text-accent">
            Clear
          </button>
        )}
      </div>
      <p className="text-[11px] leading-snug text-muted">
        A negative gap makes a group start before the previous one finishes, overlapping it.
      </p>
    </>
  )
}
