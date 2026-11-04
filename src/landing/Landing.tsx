import { useCallback, useEffect, useRef, useState } from 'react'
import { arrivedFromSite } from '../lib/arrival'
import { mountArchive, type Archive } from './archive'
import { Intro } from './intro'
import './archive.css'

/** The landing page. The sphere is plain DOM code in archive.ts; React gives it a root and plays the grey
 * liquid-glass intro on top of it. The intro is for visits straight to the site; coming back from the
 * tool or the docs skips it. */
export default function Landing() {
  const root = useRef<HTMLDivElement>(null)
  const archive = useRef<Archive | null>(null)
  // Decided once, before the first render.
  const [playIntro] = useState(() => !arrivedFromSite())
  const [introShown, setIntroShown] = useState(playIntro)

  useEffect(() => {
    if (!root.current) return
    const mounted = mountArchive(root.current)
    archive.current = mounted
    if (!playIntro) mounted.reveal()
    return () => {
      archive.current = null
      mounted.dispose()
    }
  }, [playIntro])

  const reveal = useCallback(() => archive.current?.reveal(), [])
  const done = useCallback(() => setIntroShown(false), [])

  return (
    <>
      <div id="archive" ref={root} />
      {introShown && <Intro onLeave={reveal} onDone={done} />}
    </>
  )
}
