// After vite build (which puts Move in dist/anipanel/), puts the VCE portfolio at the root of dist/ and the
// other tools beside Move: VCE at /, Hello Glass at /helloglass/, Patch Pixelizer at /patchpixelizer/.
// npm run sync:vce fills vce/ and tools/. See vercel.json.
import { cpSync } from 'node:fs'

const here = (p) => new URL(`../${p}`, import.meta.url)
cpSync(here('vce/'), here('dist/'), { recursive: true })
cpSync(here('tools/helloglass/'), here('dist/helloglass/'), { recursive: true })
cpSync(here('tools/patchpixelizer/'), here('dist/patchpixelizer/'), { recursive: true })
console.log('VCE added at the root of dist/, Hello Glass and Patch Pixelizer beside Move')
