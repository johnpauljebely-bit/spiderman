// Copies what the live site serves besides Move into this repo, from the projects next to this one, so
// Vercel (which only sees this repo) can deploy it. Run it (npm run sync:vce) before committing.
//   vce/                   the VCE site (from ../vce-crowd: index.html and assets/), served at /
//   tools/helloglass/      Hello Glass, built (from ../hello-glass/dist: run npm run build there first)
//   tools/patchpixelizer/  Patch Pixelizer (from ../badge-pixelizer: plain files, no build step)
// scripts/add-vce.mjs puts them into dist/ after vite build; vercel.json routes them.
import { cpSync, existsSync, rmSync } from 'node:fs'

const here = (p) => new URL(`../${p}`, import.meta.url)
const skip = (src) => !src.endsWith('.DS_Store')
function copy(fromDir, toDir, parts) {
  const from = here(fromDir)
  if (!existsSync(new URL(parts[0], from))) throw new Error(`Missing ${new URL(parts[0], from).pathname}`)
  rmSync(here(toDir), { recursive: true, force: true })
  for (const p of parts) cpSync(new URL(p, from), new URL(p, here(toDir)), { recursive: true, filter: skip })
  console.log(`${fromDir} → ${toDir}`)
}

copy('../vce-crowd/', 'vce/', ['index.html', 'assets/'])
copy('../hello-glass/dist/', 'tools/helloglass/', ['index.html', 'app/', 'assets/', 'gate/', 'favicon.svg', 'logo.svg'])
copy('../badge-pixelizer/', 'tools/patchpixelizer/', ['index.html', 'app/', 'landing/', 'src/', 'gate/'])
