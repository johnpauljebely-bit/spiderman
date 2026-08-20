declare module 'gifenc' {
  export type RGB = number[]

  export interface QuantizeOptions {
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
    oneBitAlpha?: boolean | number
    clearAlpha?: boolean
    clearAlphaThreshold?: number
    clearAlphaColor?: number
  }

  export function quantize(rgba: Uint8ClampedArray | Uint8Array, maxColors: number, opts?: QuantizeOptions): RGB[]

  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: RGB[],
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array

  export interface WriteFrameOptions {
    transparent?: boolean
    transparentIndex?: number
    delay?: number
    palette?: RGB[]
    repeat?: number
    colorDepth?: number
    dispose?: number
    first?: boolean
  }

  export interface GIFEncoderInstance {
    reset(): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    writeHeader(): void
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOptions): void
    readonly buffer: ArrayBuffer
  }

  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GIFEncoderInstance
}
