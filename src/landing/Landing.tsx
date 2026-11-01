import { useEffect, useState } from 'react';
import { HalftoneWordmark } from './halftone-wordmark';
import { Intro } from './intro';
import { Rise } from './rise';
import { arrivedFromSite } from '../lib/arrival';
import './landing.css';

const OPEN_APP = '/app';
const DOCS = '/docs';

const FEATURES = [
  {
    id: 'trace',
    name: 'Trace',
    text: 'Drop in a PNG or an SVG and Move traces it into clean vector shapes. It works out the colors and the smoothing for you.',
  },
  {
    id: 'reveal',
    name: 'Reveal',
    text: 'Draw it on like a pen, or sweep the color in like a blind opening. Add a ghost of the full logo, a second lap of the pen, a fill that rises like water.',
  },
  {
    id: 'looks',
    name: 'Looks',
    text: 'Pick a look, set the speed, switch on a smooth loop. That’s all Simple mode asks of you. Turn it off when you want every last control.',
  },
  {
    id: 'sequence',
    name: 'Sequence',
    text: 'Big shapes first and the details cascading in, automatically. Or group the shapes yourself, drag the groups into any order and choose exactly where each outline starts.',
  },
  {
    id: 'export',
    name: 'Export',
    text: 'A looping GIF from 384 to 1024 pixels, up to 50 frames a second. Pick a solid color, an image, or no background at all.',
  },
  {
    id: 'private',
    name: 'Private',
    text: 'Everything happens in your browser. Your logo is never uploaded anywhere, and it’s gone when you close the tab.',
  },
] as const;

type Feature = (typeof FEATURES)[number];
type Link = { name: string; href: string };

const HERO_LIST = FEATURES.slice(0, 4);

export default function Landing() {
  // The intro is for visits straight to the site; coming back from the tool or the docs skips it.
  const [intro, setIntro] = useState(() => !arrivedFromSite());

  useEffect(() => {
    document.documentElement.style.overflow = intro ? 'hidden' : '';
  }, [intro]);
  useReveal();

  return (
    <>
      {intro && <Intro onDone={() => setIntro(false)} />}
      <div className="page" data-shown={!intro || undefined}>
        <Banner />
        <Header />
        <main>
          <Hero />
          <Features />
        </main>
        <Footer />
      </div>
    </>
  );
}

function Logo({ className = '' }: { className?: string }) {
  return <img src="/move-logo.svg" alt="" className={`select-none ${className}`} draggable={false} />;
}

const NEWS = 'We updated the site — a new look, Simple mode and a brand-new docs page';

/** A strip of scrolling text above everything, announcing the update. */
function Banner() {
  const items = Array.from({ length: 8 }, (_, i) => (
    <span key={i} className="flex items-center gap-10 pr-10">
      {NEWS}
      <span className="h-1 w-1 rounded-full bg-[#0c0c0d]/40" aria-hidden="true" />
    </span>
  ));
  return (
    <div className="news-banner fixed inset-x-0 top-0 z-50 flex h-9 items-center overflow-hidden bg-[#f4f4f5] text-[13px] font-medium text-[#0c0c0d]" role="status">
      <div className="news-track flex w-max shrink-0 whitespace-nowrap" aria-hidden={false}>
        <div className="flex shrink-0">{items}</div>
        <div className="flex shrink-0" aria-hidden="true">
          {items}
        </div>
      </div>
    </div>
  );
}

function Header() {
  // Like Brilliant: white logo and dark menu over dark sections, black logo and light menu over light ones.
  const [tone, setTone] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    const check = () => {
      // The header sits under the 36px banner, so its middle is about 72px from the top.
      const under = [...document.querySelectorAll<HTMLElement>('[data-tone]:not(.site-header)')].find((section) => {
        const box = section.getBoundingClientRect();
        return box.top <= 72 && box.bottom > 72;
      });
      setTone(under?.dataset.tone === 'light' ? 'light' : 'dark');
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  return (
    <header
      className="site-header fixed inset-x-0 top-9 z-40 flex items-center justify-between px-4 py-3 sm:px-6"
      data-tone={tone}
    >
      <a href="#top" className="rounded-md p-2 outline-offset-4" aria-label="Move, back to top">
        <Logo className="logo h-5 w-auto" />
      </a>
      <nav className="nav-pill flex items-center gap-1 rounded-full p-1 text-[15px]" aria-label="Main">
        {[...HERO_LIST, FEATURES[4]].map((f) => (
          <a
            key={f.id}
            href={`#${f.id}`}
            className="nav-link hidden rounded-full px-3.5 py-1.5 text-white/65 transition-colors hover:text-white md:inline"
          >
            {f.name}
          </a>
        ))}
        <a href={DOCS} className="nav-link hidden rounded-full px-3.5 py-1.5 text-white/65 transition-colors hover:text-white md:inline">
          Docs
        </a>
        <a
          href={OPEN_APP}
          className="nav-cta rounded-full bg-white px-4 py-1.5 font-medium text-neutral-950 transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Open Move
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="top"
      data-tone="dark"
      className="hero relative isolate flex min-h-[100svh] flex-col items-center overflow-hidden bg-black px-4 text-center"
    >
      <div className="stars" aria-hidden="true" />
      <div className="horizon" aria-hidden="true" />
      <div className="sunside" aria-hidden="true" />
      <div className="relative z-10 mt-[25svh] w-full max-w-5xl">
        <Rise
          lines={['Make your logo', 'move.']}
          className="hero-title text-[clamp(2.75rem,6vw,6rem)] font-semibold leading-none tracking-[-0.045em] text-zinc-100"
        />
        <ol className="hero-list mx-auto mt-8 max-w-sm text-left text-[14px]">
          {HERO_LIST.map((f, i) => (
            <li key={f.id}>
              <a
                href={`#${f.id}`}
                className="flex items-center justify-between border-b border-white/10 py-1.5 text-white/55 transition-colors hover:text-white"
              >
                <span className="tabular-nums">({i + 1})</span>
                <span>{f.name}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
      <a
        href="#trace"
        className="scroll-cue absolute bottom-6 z-10 text-sm text-white/45 transition-colors hover:text-white/80"
      >
        Scroll down
      </a>
    </section>
  );
}

function ArrowUpRight({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

function Features() {
  return (
    <section data-tone="light" className="bg-white px-4 py-24 text-[#0c0c0d] sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <p className="reveal mb-6 text-[15px] text-[#8e8e95]">What it does</p>
        <Rise
          as="h2"
          lines={['A few sliders, and a lot', 'of motion.']}
          className="rise-on-view max-w-4xl text-[clamp(2rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em]"
        />
        <ul className="mt-16 border-t border-[#e7e7ea]">
          {FEATURES.map((f, i) => (
            <li key={f.id} id={f.id} className="reveal feature-row scroll-mt-24 border-b border-[#e7e7ea]">
              <div className="grid gap-3 py-8 sm:grid-cols-[3rem_minmax(0,13rem)_minmax(0,1fr)_1.5rem] sm:items-baseline sm:gap-8 sm:py-10">
                <span className="text-[15px] tabular-nums text-[#8e8e95]">({i + 1})</span>
                <h3 className="text-[clamp(1.6rem,2.6vw,2.1rem)] font-semibold tracking-[-0.035em]">{f.name}</h3>
                <p className="max-w-xl text-[17px] leading-relaxed text-[#5d5d63]">{f.text}</p>
                <ArrowUpRight className="feature-arrow hidden h-6 w-6 text-[#8e8e95] sm:block" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="footer" data-tone="dark" className="bg-[#0a0a0a] px-4 pt-16 text-white sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <p className="max-w-xs text-[15px] leading-relaxed text-white/50">
            Turn any logo into a looping animation.
          </p>
          <p className="mt-6 flex items-center gap-2 text-[14px] text-white/60">
            <span className="ember-dot" aria-hidden="true" />
            Runs in your browser. Your logo never leaves your device
          </p>
        </div>
        <FooterColumn title="Move" items={FEATURES.slice(0, 4).map(featureLink)} />
        <FooterColumn title="More" items={[...FEATURES.slice(4).map(featureLink), { name: 'Docs', href: DOCS }, { name: 'Open Move', href: OPEN_APP }]} />
      </div>
      <p className="mx-auto mt-16 max-w-6xl text-[13px] text-white/35">© {new Date().getFullYear()} Move</p>
      <HalftoneWordmark className="-mx-4 mt-10 sm:-mx-8" />
    </footer>
  );
}

const featureLink = (f: Feature): Link => ({ name: f.name, href: `#${f.id}` });

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
  );
}

/** Fades sections in as they scroll into view. */
function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        }),
      { rootMargin: '0px 0px -10% 0px' },
    );
    document.querySelectorAll('.reveal, .rise-on-view').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
