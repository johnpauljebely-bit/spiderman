import { motion } from 'motion/react'

import { cn } from '@/lib/utils'

const STAGGER = 0.035

/** Text that rolls up letter by letter on hover, the next copy sliding in from below. */
export default function TextRoll({
  children,
  className,
  center = false,
  lineHeight = 0.85,
}: {
  children: string
  className?: string
  center?: boolean
  /** Unitless line height. The default is tight, which clips descenders in lowercase text, so mixed-case callers raise it. */
  lineHeight?: number
}) {
  // An inline-block holding only a space collapses to nothing, so spaces are swapped for non-breaking ones.
  const letters = children.split('').map((l) => (l === ' ' ? ' ' : l))
  const delayFor = (i: number) => (center ? STAGGER * Math.abs(i - (letters.length - 1) / 2) : STAGGER * i)

  return (
    <motion.span
      initial="initial"
      whileHover="hovered"
      className={cn('relative block overflow-hidden text-black dark:text-white/90', className)}
      style={{ lineHeight }}
    >
      {/* Top text (slides up and out) */}
      <div>
        {letters.map((l, i) => (
          <motion.span
            variants={{ initial: { y: 0 }, hovered: { y: '-100%' } }}
            transition={{ ease: 'easeInOut', delay: delayFor(i) }}
            className="inline-block"
            key={i}
          >
            {l}
          </motion.span>
        ))}
      </div>

      {/* Bottom text (slides in from below) */}
      <div className="absolute inset-0">
        {letters.map((l, i) => (
          <motion.span
            variants={{ initial: { y: '100%' }, hovered: { y: 0 } }}
            transition={{ ease: 'easeInOut', delay: delayFor(i) }}
            className="inline-block"
            key={i}
          >
            {l}
          </motion.span>
        ))}
      </div>
    </motion.span>
  )
}
