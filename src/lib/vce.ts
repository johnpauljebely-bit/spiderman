/**
 * The VCE portfolio's main page. VCE's menu has an "ANI PANEL" item that opens Move, so Move links back to
 * it. On the live site VCE is the root of the same address (Move is under /anipanel/, see paths.ts); while
 * developing it's VCE's own dev server.
 */
export const VCE_URL: string = import.meta.env.VITE_VCE_URL || (import.meta.env.DEV ? 'http://localhost:5203/' : '/')
