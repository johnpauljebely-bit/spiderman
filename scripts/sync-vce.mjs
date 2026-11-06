// Copies the VCE portfolio's site (index.html and assets/) into vce/, from its own project next to this
// one. VCE is edited there; run this (npm run sync:vce) before committing so the live site gets the changes.
import { cpSync, existsSync, rmSync } from 'node:fs'

const from = new URL('../../vce-portfolio/', import.meta.url)
const to = new URL('../vce/', import.meta.url)
if (!existsSync(new URL('index.html', from))) throw new Error(`No VCE site at ${from.pathname}`)

rmSync(to, { recursive: true, force: true })
cpSync(new URL('index.html', from), new URL('index.html', to))
cpSync(new URL('assets/', from), new URL('assets/', to), { recursive: true, filter: (src) => !src.endsWith('.DS_Store') })
console.log('VCE copied into vce/')
