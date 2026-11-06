import { to } from '@/lib/paths'

// The 21 frames on the sphere: single moments from Move's own logo animation, rendered by the animator
// itself in different looks, colors and crops, plus screenshots of the tool, docs and sign-in. Files live
// in /public/archive as <id>_min.webp (thumbnail) and <id>.webp (full size).
//
// The order matters. The cards sit on the sphere in this order, and the boldly colored ones (orange,
// blue, yellow) are placed so that no two of them are neighbours, and the two of each color are far apart.

export interface Card {
  id: string
  title: string
  place: string
  note: string
  tall?: boolean
}

export const BASE = to('/archive/')
export const thumb = (id: string) => `${BASE}${id}_min.webp`
export const full = (id: string) => `${BASE}${id}.webp`
export const AVATAR = to('/favicon-512.png')

export const CARDS: Card[] = [
  {
    id: 'w-3',
    title: 'Held',
    place: 'Fade Wipe · Cinematic',
    note: 'The sweep has finished and the logo is held, cropped in close, before the loop starts again.',
  },
  {
    id: 'w-1',
    title: 'Any Background',
    place: 'Solid color',
    note: 'A black logo on off-white. Pick a solid color, an image, or nothing at all, and export with it baked in or transparent.',
  },
  {
    id: 'c-orange-1',
    title: 'On Orange',
    place: 'Solid color',
    note: 'The finished logo in black on orange. The same animation works on any color.',
  },
  {
    id: 'c-blue-1',
    title: 'On Blue',
    place: 'Solid color',
    note: 'A white logo on a bold blue, finished and held before the loop starts again.',
  },
  {
    id: 'k-2',
    title: 'Up Close',
    place: 'Draw & Fill · Clean',
    note: 'The finished logo cropped in tight on black, so the two peaks run off the edges of the frame.',
  },
  {
    id: 'w-2',
    title: 'Mid-Stroke',
    place: 'Draw & Fill · Clean',
    note: 'Part-way through the outline pass: the line is still being drawn and the color has not started.',
  },
  {
    id: 'k-4',
    title: 'Second Lap',
    place: 'Draw & Fill · Hand-drawn',
    note: 'With pen laps set to two, the pen goes over each outline twice. Here the outline is complete and the fill has not arrived yet.',
  },
  {
    id: 'k-6',
    title: 'Rising Fill',
    place: 'Fill style · Linear',
    note: 'The color rises from the bottom like water filling a glass, with an edge you can soften or sharpen.',
  },
  {
    id: 'k-3',
    title: 'Fill Fades In',
    place: 'Draw & Fill · Clean',
    note: 'Once the outline is closed, the color fades in behind it, so the logo is still a soft grey here.',
  },
  {
    id: 'c-yellow-1',
    title: 'On Yellow',
    place: 'Solid color',
    note: 'A black logo on yellow, finished.',
  },
  {
    id: 'shot-tall',
    title: 'On a Phone',
    place: 'Responsive',
    note: 'On a small screen the tool stacks into one column, with the same controls.',
    tall: true,
  },
  {
    id: 'shot-tool-1',
    title: 'One Panel',
    place: 'Simple mode',
    note: 'The tool with the Move logo loaded on an orange background. Logo, Background and Animation sit in one column; Simple mode is on by default and keeps the choices to a handful of looks.',
  },
  {
    id: 'w-4',
    title: 'Soft Edge',
    place: 'Fade Wipe · Cinematic',
    note: 'Mid-sweep: the color arrives diagonally from the bottom left, with a soft edge you can see as a gradient.',
  },
  {
    id: 'c-yellow-2',
    title: 'Blue on Yellow',
    place: 'Draw & Fill · Clean',
    note: 'A blue logo on yellow, cropped in so close that the shape runs off the edges.',
  },
  {
    id: 'shot-docs-1',
    title: 'The Docs',
    place: 'Guide',
    note: 'A plain-language guide: the fastest way to a result, every control explained, plus looks and setting combinations worth trying.',
  },
  {
    id: 'c-blue-2',
    title: 'Gold on Blue',
    place: 'Fill style · Linear',
    note: 'A yellow logo on blue, cropped in. The fill is rising from the bottom, and the soft edge is still visible near the top.',
  },
  {
    id: 'shot-signin',
    title: 'Sign In',
    place: 'Discord',
    note: 'One click with Discord keeps you signed in for five days. The tool is open to approved accounts.',
  },
  {
    id: 'k-5',
    title: 'Cropped Sweep',
    place: 'Fade Wipe · Cinematic',
    note: 'The color sweeping in diagonally with a soft edge, cropped in close on black.',
  },
  {
    id: 'w-5',
    title: 'Fading In',
    place: 'Draw & Fill · Clean',
    note: 'The outline has closed and the fill is fading in, so the black logo is still a mid grey.',
  },
  {
    id: 'c-orange-2',
    title: 'Sweeping In',
    place: 'Fade Wipe · Cinematic',
    note: 'A white logo on orange, caught as the color sweeps in diagonally from the bottom left.',
  },
  {
    id: 'k-7',
    title: 'The Peaks',
    place: 'Draw & Fill · Clean',
    note: 'A tight crop of the finished logo: just the two peaks, white on black.',
  },
]
