// After vite build (which puts Move in dist/anipanel/), puts the VCE portfolio at the root of dist/, so the
// live site is VCE at / and Move at /anipanel/. See vercel.json.
import { cpSync } from 'node:fs'

cpSync(new URL('../vce/', import.meta.url), new URL('../dist/', import.meta.url), { recursive: true })
console.log('VCE added at the root of dist/')
