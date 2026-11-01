import { useEffect, useRef, useState } from 'react';
import { LiquidGlassLogo } from './liquid-glass-logo';

const LOGO = '/move-logo.svg';
// The glass settles onto the logo at 1.8 s (the component's logo ending); let the finished logo sit for a second, then reveal the page.
const SETTLE_MS = 1800;
const HOLD_MS = 1000;
const FADE_MS = 600;
const GIVE_UP_MS = 5000; // no WebGL or the logo didn't load: don't keep anyone waiting

/** Plays the liquid-glass logo before the page shows, then fades away. Click or Esc skips it. */
export function Intro({ onDone }: { onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  const skip = useRef(() => {});

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let leaveTimer = 0;
    let goneTimer = 0;
    const leave = () => {
      if (goneTimer) return;
      clearTimeout(leaveTimer);
      setLeaving(true);
      goneTimer = window.setTimeout(() => done.current(), reduced ? 200 : FADE_MS);
    };
    const later = (ms: number) => {
      clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(leave, ms);
    };

    // Start the clock when the glass actually starts drawing (the logo has to load first).
    const ready = () => box.current?.querySelector('[data-liquid-glass-ready]');
    const watcher = new MutationObserver(() => {
      if (ready()) {
        watcher.disconnect();
        later(reduced ? 500 : SETTLE_MS + HOLD_MS);
      }
    });
    if (box.current) watcher.observe(box.current, { attributes: true, subtree: true });
    later(GIVE_UP_MS);

    skip.current = leave;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && leave();
    window.addEventListener('keydown', onKey);
    return () => {
      watcher.disconnect();
      clearTimeout(leaveTimer);
      clearTimeout(goneTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={box} className="intro" data-leaving={leaving || undefined} onClick={() => skip.current()}>
      <LiquidGlassLogo
        logo={LOGO}
        ending="logo"
        theme={'light'}
        style={{ height: 480 }}
        aria-label="Move"
      />
    </div>
  );
}
