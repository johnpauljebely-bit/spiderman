import { useState } from 'react'
import { LoadingGate } from './LoadingGate'
import { SmoothScroll } from './SmoothScroll'
import { Panel } from './ui'
import { THEME_STORAGE_KEY, type Theme } from '../lib/theme'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel title={title} className="space-y-3 text-sm leading-relaxed text-muted">
      {children}
    </Panel>
  )
}

function DocsContent() {
  const [theme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'flat' ? 'flat' : 'liquid'
  })

  return (
    <div data-theme={theme} className="min-h-screen px-6 py-8 text-ink">
      <SmoothScroll />
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="bg-gradient-to-br from-white to-white/60 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
              Logo Animator — Docs
            </h1>
            <p className="text-sm text-muted">How to use it, from a first upload to advanced setting combos.</p>
          </div>
          <a href="/" className="liquid-btn liquid-btn-accent shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white">
            Open the app
          </a>
        </header>

        <div className="space-y-4">
          <Section title="The fastest way to get something working">
            <p>If you just want a result in under a minute:</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Click the Logo box and drop in your logo file. A transparent PNG or an SVG both work —
                transparent PNG is the safer bet if you&apos;re not sure.
              </li>
              <li>Wait a second for it to trace. You&apos;ll see &ldquo;X elements detected&rdquo; once it&apos;s done.</li>
              <li>The big preview should already be playing a reveal animation with the default settings.</li>
              <li>
                Pick a background (solid color is the default, or switch to Transparent if you want to
                drop the GIF over something else later).
              </li>
              <li>Hit Export GIF.</li>
            </ol>
            <p>
              That&apos;s genuinely it for a simple logo. Everything below is for making it look better or
              more specific to your logo.
            </p>
          </Section>

          <Section title="Getting a clean trace">
            <p>
              The tool has to turn your flat image into outlines it can draw — how well that works
              depends on three sliders that only show up after you upload a raster image (PNG/JPG). SVGs
              skip this entirely since they&apos;re already made of clean paths.
            </p>
            <p>
              <span className="font-medium text-ink">Smoothing</span> rounds out the traced outline so it
              doesn&apos;t look like jagged pixel steps. Push it up if fine detail is coming out blocky;
              pull it back down if it&apos;s melting away small details.
            </p>
            <p>
              <span className="font-medium text-ink">Colors</span> controls how many separate color
              regions the tracer looks for. Set it to match how many actual colors are in your logo —
              leave it too high on a flat 2-color icon and it starts inventing extra shades along
              anti-aliased edges, which comes out grey and fragmented instead of solid. When in doubt, go
              lower.
            </p>
            <p>
              <span className="font-medium text-ink">Simplify</span> cleans up tiny leftover specks from
              tracing. Raise it if the result looks noisy or speckled.
            </p>
            <p>The tool auto-guesses reasonable starting values the moment you upload, so for most logos you can leave these alone.</p>
          </Section>

          <Section title="Background">
            <p>
              Three options: Solid color, Image (upload a background photo or graphic), or Transparent,
              which exports a real transparent GIF — no background baked in at all. Use Transparent for a
              video editor, a slide deck, or anywhere with its own background already.
            </p>
          </Section>

          <Section title="The Animation panel">
            <p>
              <span className="font-medium text-ink">Reveal style</span> — Draw &amp; Fill draws the
              outline on like a pen, then fades the color in behind it, the classic &ldquo;logo
              animation&rdquo; look. Fade Wipe sweeps the color in across each shape from one edge
              instead, like a blind opening.
            </p>
            <p>
              <span className="font-medium text-ink">Speed</span> scales the whole animation — higher is
              snappier, lower is slower and more dramatic. Everything in Timing is the exact-millisecond
              version of what Speed is roughly doing.
            </p>
            <p>
              <span className="font-medium text-ink">Look</span> (Draw &amp; Fill only) — Stroke width
              sets how thick the drawn line is. Pen laps re-traces each shape before filling: 1 is a
              normal pass, 2-3 gives a sketchy, hand-drawn feel without slowing anything down. Fill style
              is Normal (fades in evenly), Linear (fills like a glass from the bottom, or top-down with
              Reverse), or Diagonal (sweeps from a corner).
            </p>
            <p>
              <span className="font-medium text-ink">Ghost preview</span> shows a faint version of the
              whole logo from the start, sitting underneath the reveal, instead of an empty canvas. Nice
              touch on logos with a lot of separate pieces.
            </p>
            <p>
              <span className="font-medium text-ink">Timing</span> holds the exact-millisecond controls —
              hold at start, outline/wipe duration, fill fade, hold at end, and an easing dropdown (Ease
              Out is a good default: fast start, slow finish).
            </p>
            <p>
              <span className="font-medium text-ink">Loop fade</span> — off by default, meaning a hard cut
              back to blank when it loops. Switch it on and it dissolves out instead; push Overlap up so
              the next reveal starts before the fade-out finishes, for a loop with no dead air.
            </p>
          </Section>

          <Section title="Sequence — controlling what plays first">
            <p>
              Shows up once your logo has more than one shape. Auto-sequence orders shapes
              biggest-to-smallest automatically — zero setup, a good default for anything with more than
              2-3 elements.
            </p>
            <p>
              Turn it off for manual grouping: assign shapes to groups, then drag a group by its handle to
              reorder what plays first. Each group has a Gap before field — positive waits that long after
              the previous group, negative overlaps it, letting two pieces animate at the same time but
              slightly offset.
            </p>
            <p>
              Set start point and Set end point control exactly where a shape&apos;s outline starts and
              stops drawing — worth using on anything with an obvious start, like a signature or a single
              continuous line.
            </p>
          </Section>

          <Section title="Exporting">
            <p>
              Size: 384 / 512 / 768 / 1024px — 768 is a solid default. Frame rate: 12–50fps, 30 is a good
              middle ground. Colors: 32–256 — flat, simple logos can drop this a lot with no visible
              difference.
            </p>
          </Section>

          <Section title="Presets worth starting from">
            <p><span className="font-medium text-ink">Clean &amp; simple</span> — Draw &amp; Fill, Speed 70%, Stroke width 2px, Pen laps 1, Fill style Normal, Easing Ease Out.</p>
            <p><span className="font-medium text-ink">Hand-drawn / sketchy</span> — Draw &amp; Fill, Speed 50%, Stroke width 3.5px, Pen laps 2-3, Outline draw ~1400ms, Easing Linear or Smooth.</p>
            <p><span className="font-medium text-ink">Snappy loop for social/chat</span> — Draw &amp; Fill, Speed 140%, Outline draw 400ms, Fill fade 200ms, Hold end 400ms, Loop fade on with Fade duration 200ms and Overlap 200ms (max).</p>
            <p><span className="font-medium text-ink">Cinematic reveal</span> — Fade Wipe, Direction Diagonal ↗, Softness 40%, Reveal duration 1800ms, Hold at start 800ms, Hold at end 1400ms, Easing Ease In-Out.</p>
            <p><span className="font-medium text-ink">Glass fill</span> — Draw &amp; Fill, Fill style Linear (not reversed), Fill softness ~30%, Speed 70%.</p>
          </Section>

          <Section title="Combos worth trying">
            <p>Ghost outline + fast reveal — Ghost preview on, Outline only, opacity 15-20%, then a quick Draw &amp; Fill on top. Reads like a coloring book: faint sketch first, then fills in.</p>
            <p>Pen laps 2 + thin stroke + slow speed — makes fine-lined logos look like someone&apos;s sketching them live, twice over.</p>
            <p>Manual groups with a negative gap — set a wordmark&apos;s gap to something like -150ms so it starts just before the icon finishes instead of waiting for it completely.</p>
            <p>Fade Wipe with high softness (50%+) over an image background — reads more like light passing over the logo than a hard reveal.</p>
          </Section>

          <Section title="If something looks off">
            <p>Grey, broken up, or fragmented — the Colors slider is set higher than the logo needs. Bring it down.</p>
            <p>Outline looks blocky or jagged — raise Smoothing.</p>
            <p>Small details missing — lower Simplify.</p>
            <p>Outline starts from a weird spot — use Set start point and drag the marker.</p>
            <p>Loop feels like it has a gap — turn on Loop fade and push the overlap up.</p>
          </Section>
        </div>
      </div>
    </div>
  )
}

export function DocsPage() {
  return (
    <LoadingGate durationMs={3000}>
      <DocsContent />
    </LoadingGate>
  )
}
