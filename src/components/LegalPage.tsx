import { SiteFooter } from './SiteFooter'
import { to } from '../lib/paths'
import { SmoothScroll } from './SmoothScroll'

type Section = { label: string; title: string; paragraphs?: string[]; items?: string[] }

const UPDATED = 'November 4, 2026'

const SECTIONS: Section[] = [
  {
    label: 'Your files',
    title: 'Your logo stays on your device',
    paragraphs: [
      'Move runs entirely in your browser. When you drop in a logo, it is traced, animated and exported on your own computer. It is never uploaded to a server, and it is gone when you close the tab.',
    ],
  },
  {
    label: 'Sign in',
    title: 'What Discord shares with Move',
    paragraphs: [
      'The tool is open to approved accounts and signs you in with Discord. Move asks Discord only for the “identify” permission.',
    ],
    items: [
      'Move receives your Discord ID, username, display name and avatar.',
      'These are kept in your browser’s local storage for five days so you do not have to sign in again, then cleared. Move has no server or database of its own that stores them.',
      'The list of approved accounts is part of the site’s code and is checked in your browser. It decides who sees the tool; it is not a security boundary.',
      'Move never sees your Discord password.',
    ],
  },
  {
    label: 'Stored locally',
    title: 'What else is saved in your browser',
    paragraphs: ['A setting or two, such as whether Simple mode is switched on. Clearing your browser’s site data removes them.'],
  },
  {
    label: 'Counts',
    title: 'Anonymous usage counts',
    paragraphs: ['Move keeps simple totals so its owner can see how the site is used. It does not track you.'],
    items: [
      'It counts visits, which pages are opened, sign-ins, which look is picked, and how many logos are added and GIFs exported.',
      'For each visit it notes your country and whether you are on a phone, tablet or computer, and the name of the site that sent you, if any.',
      'Unique visitors are counted with a hash that changes every day, so nobody can be followed from one day to the next.',
      'No cookies are used for this. IP addresses, Discord accounts and logos are never stored with the counts.',
      'The counts are kept for about 13 months.',
    ],
  },
  {
    label: 'Third parties',
    title: 'Fonts and hosting',
    items: [
      'The site’s fonts (Playfair Display and Inter) are loaded from Google Fonts, so Google receives your IP address when a page loads.',
      'The site is served by its hosting provider, which may keep ordinary server logs, such as your IP address and the pages requested.',
      'Signing in sends you to Discord, which has its own privacy policy.',
    ],
  },
  {
    label: 'Using Move',
    title: 'Terms of use',
    items: [
      'Only animate logos you made or have the right to use. You are responsible for what you create and share with it.',
      'GIFs you export are yours. Move claims no rights over them and adds no watermark.',
      'Move is provided as it is, with no warranty. It may change, break or go away, and access can be removed at any time.',
      'Do not use Move to make anything unlawful or misleading, or to get around the sign-in.',
    ],
  },
]

/** A short, plain-language privacy and terms page, in the docs page's layout. */
export function LegalPage() {
  return (
    <div className="min-h-screen text-ink">
      <SmoothScroll />

      <header className="sticky top-0 z-30 flex items-center gap-3 bg-gradient-to-b from-black from-55% to-black/0 px-4 py-4 sm:px-8">
        <a href={to('/')} aria-label="Move home" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl">
          <img src={to('/move-logo.svg')} alt="" className="h-5 w-auto select-none" draggable={false} />
        </a>
        <span className="font-display shrink-0 text-[17px]">Legal</span>
        <nav className="app-nav-pill ml-auto" aria-label="Main">
          <a href={to('/')} className="app-nav-link hidden sm:inline">
            Home
          </a>
          <a href={to('/docs')} className="app-nav-link hidden sm:inline">
            Docs
          </a>
          <a href={to('/app')} className="btn btn-primary whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium">
            Open Move
          </a>
        </nav>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-8">
        <p className="label">Legal</p>
        <h1 className="font-display mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[1.06] tracking-[-0.005em]">Privacy and terms.</h1>
        <p className="mb-12 mt-4 max-w-xl text-[15px] leading-relaxed text-muted">What Move does with your data, and the ground rules for using it. Last updated {UPDATED}.</p>

        <div className="border-b border-panel-border">
          {SECTIONS.map((section) => (
            <section key={section.label} className="relative flex flex-col gap-4 border-t border-panel-border py-10 md:flex-row md:gap-16">
              <div className="top-24 flex h-min w-40 shrink-0 items-center md:sticky">
                <span className="rounded-full border border-panel-border px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-faint">{section.label}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="font-display mb-3 text-[clamp(1.4rem,2.2vw,1.8rem)] leading-tight tracking-[-0.01em] text-ink">{section.title}</h2>
                {section.paragraphs?.map((text) => (
                  <p key={text} className="mb-3 max-w-xl text-[16px] leading-relaxed text-muted">
                    {text}
                  </p>
                ))}
                {section.items && (
                  <ul className="mt-1 ml-5 max-w-xl space-y-2.5 text-[16px] leading-relaxed text-muted">
                    {section.items.map((item) => (
                      <li key={item} className="list-disc marker:text-faint">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
