import { forwardRef, useId, type CSSProperties, type HTMLAttributes } from 'react'
import clsx from 'clsx'

export interface GooeyLoaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Defaults to the app's blue accent. */
  primaryColor?: string
  secondaryColor?: string
  borderColor?: string
}

/** Two blue blobs merging/splitting behind a gooey SVG filter, for any spinner-shaped wait. Size scales
 * with font-size (it's all `em` under the hood) — drop a text size class on it to resize. */
export const GooeyLoader = forwardRef<HTMLDivElement, GooeyLoaderProps>(
  ({ className, primaryColor = 'var(--color-accent)', secondaryColor = '#8fc7ff', borderColor = 'var(--color-panel-border)', style, ...props }, ref) => {
    const filterId = useId()

    return (
      <div
        ref={ref}
        className={clsx('relative inline-flex items-center justify-center text-sm', className)}
        style={style}
        role="status"
        aria-label="Loading"
        {...props}
      >
        <svg className="absolute h-0 w-0">
          <defs>
            <filter id={filterId}>
              <feGaussianBlur in="SourceGraphic" stdDeviation={12} result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 48 -7" result="goo" />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>

        <div
          className="gooey-loader"
          style={
            {
              '--gooey-primary': primaryColor,
              '--gooey-secondary': secondaryColor,
              '--gooey-border': borderColor,
              filter: `url(#${filterId})`,
            } as CSSProperties
          }
        />
      </div>
    )
  },
)
GooeyLoader.displayName = 'GooeyLoader'
