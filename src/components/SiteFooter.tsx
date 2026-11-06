import { HalftoneWordmark } from '../landing/halftone-wordmark'
import { to } from '../lib/paths'

type Link = { name: string; href: string }

const MOVE: Link[] = [
  { name: 'Trace', href: to('/docs#logo') },
  { name: 'Reveal', href: to('/docs#animation') },
  { name: 'Looks', href: to('/docs#simple-mode') },
  { name: 'Sequence', href: to('/docs#sequence') },
]
const MORE: Link[] = [
  { name: 'Export', href: to('/docs#export') },
  { name: 'Docs', href: to('/docs') },
  { name: 'Legal', href: to('/legal') },
  { name: 'Open Move', href: to('/app') },
]

function FooterColumn({ title, items }: { title: string; items: readonly Link[] }) {
  return (
    <div className="min-w-36">
      <p className="text-[15px] font-medium">{title}</p>
      <ul className="mt-4 space-y-2.5 text-[14px] text-white/55">
        {items.map((link) => (
          <li key={link.name}>
            <a href={link.href} className="transition-colors hover:text-white">
              {link.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The site footer with the halftone "Move" wordmark. It closes every page except the tool and the landing sphere. */
export function SiteFooter() {
  return (
    <footer className="border-t border-panel-border bg-[#0a0a0a] px-4 pt-16 text-white sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <p className="max-w-xs text-[15px] leading-relaxed text-white/50">Turn any logo into a looping animation.</p>
          <p className="mt-6 flex items-center gap-2 text-[14px] text-white/60">
            <span className="ember-dot" aria-hidden="true" />
            Runs in your browser. Your logo never leaves your device
          </p>
        </div>
        <FooterColumn title="Move" items={MOVE} />
        <FooterColumn title="More" items={MORE} />
      </div>
      <p className="mx-auto mt-16 max-w-6xl text-[13px] text-white/35">© {new Date().getFullYear()} Move</p>
      <HalftoneWordmark className="-mx-4 mt-10 sm:-mx-8" />
    </footer>
  )
}
