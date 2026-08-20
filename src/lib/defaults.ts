import type { AnimSettings, BackgroundSettings } from '../types'

export const DEFAULT_SETTINGS: AnimSettings = {
  style: 'draw-fill',
  speed: 0.7,
  startHoldMs: 500,
  outlineDrawMs: 900,
  fillFadeMs: 400,
  holdEndMs: 900,
  easing: 'ease-out',
  strokeWidth: 2.5,
  fillStyle: 'normal',
  fillStyleReverse: false,
  wipeDirection: 'left-right',
  wipeSoftness: 0.25,
  fadeOutMs: 0,
  fadeOverlapMs: 250,
  fadeOutStyle: 'normal',
  fadeOutReverse: false,
  ghostOpacity: 0,
  ghostStyle: 'fill',
  strokeLaps: 1,
}

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  kind: 'color',
  color: '#0f1115',
  image: null,
}
