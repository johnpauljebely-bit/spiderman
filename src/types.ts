export type AnimStyle = 'draw-fill' | 'fade-wipe'
export type EasingName = 'linear' | 'smooth' | 'ease-in' | 'ease-out' | 'ease-in-out'
export type WipeDirection = 'left-right' | 'right-left' | 'top-bottom' | 'bottom-top' | 'diagonal-up' | 'diagonal-down'
export type FillStyle = 'normal' | 'linear' | 'diagonal'
export type PickMode = 'none' | 'assign' | 'start' | 'end'

export interface TracedPath {
  id: string
  /** The real, unmodified traced shape — always used for the fill/final logo. Never altered by smoothing. */
  d: string
  /** Geometry used only for the animated drawing stroke. Equal to `d` unless smoothing simplified it. */
  strokeD: string
  color: string
  /** Length along strokeD (0..totalLength) where the outline starts drawing from. */
  startLength: number
  /** Length along strokeD (0..totalLength) where the outline stops. null = draws the full closed loop. */
  endLength: number | null
  /** False for stroke-only line art (an SVG path with fill="none") — the animated line still draws, but nothing ever fills in behind it. Always true for raster-traced paths. */
  hasFill: boolean
}

export interface SequenceGroup {
  id: string
  pathIds: string[]
  /** Gap before this group starts, relative to the previous group finishing. Negative overlaps with it. Ignored for the first group. */
  gapMs: number
}

export interface AnimSettings {
  style: AnimStyle
  /** 0..1, where 1 is fastest. */
  speed: number
  /** Fully-revealed hold before the loop cuts to blank and animates; keeps chat-app GIF thumbnails showing the finished logo. */
  startHoldMs: number
  outlineDrawMs: number
  fillFadeMs: number
  holdEndMs: number
  easing: EasingName
  /** Outline thickness in canvas pixels (draw-fill style only). */
  strokeWidth: number
  /** How the fill phase reveals for draw-fill style. */
  fillStyle: FillStyle
  /** Flips linear/diagonal fill direction (e.g. bottom-to-top becomes top-to-bottom). */
  fillStyleReverse: boolean
  wipeDirection: WipeDirection
  /** 0..1 fraction of the sweep that is feathered. Used by fade-wipe and by linear/diagonal fill styles. */
  wipeSoftness: number
  /** How long the finished logo takes to fade out at the end of each loop, before it restarts. 0 = hard cut, no fade. */
  fadeOutMs: number
  /** How much of that fade-out overlaps with the reveal animation starting — 0 means the reveal only starts once the fade finishes. */
  fadeOverlapMs: number
  /** Same mechanics as fillStyle: normal dissolves evenly, linear/diagonal wipe the logo away directionally instead. */
  fadeOutStyle: FillStyle
  /** Flips the fade-out direction — e.g. pair with an unreversed fill style to get bottom-to-top out, top-to-bottom back in. */
  fadeOutReverse: boolean
  /** 0..1 — shows the whole logo faintly at this opacity underneath the reveal, so the full shape is visible before its pieces fill in. 0 = invisible until revealed. */
  ghostOpacity: number
  /** Whether the ghost preview shows as a faint filled silhouette, or just faint outline strokes with no fill. */
  ghostStyle: 'fill' | 'outline'
  /** How many times the pen retraces each shape's outline before moving on to the fill — 1 is a normal single pass, 2-3 gives a sketchy, hand-drawn multi-pass look. Fits within the existing outline draw duration rather than extending it. */
  strokeLaps: number
}

export interface PathFrameState {
  id: string
  dashOffset: number
  drawnLength: number
  totalLength: number
  fillAlpha: number
  wipeProgress: number
}

export interface FrameResult {
  paths: PathFrameState[]
  totalDurationMs: number
  /** 0..1 — how much of the fully-revealed static logo to draw on top as a fading overlay (fade-transition mode). */
  overlayAlpha: number
}

export interface BackgroundSettings {
  kind: 'color' | 'image' | 'transparent'
  color: string
  image: HTMLImageElement | null
}
