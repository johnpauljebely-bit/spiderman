// Runs api/*.mjs inside the Vite dev and preview servers, so /api/event and /api/admin work on localhost the
// same way they do on Vercel (those files export Web-standard POST/GET handlers).
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'

const ROUTES = { '/api/event': '/api/event.mjs', '/api/admin': '/api/admin.mjs' }

export function moveApi() {
  const mount = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const file = ROUTES[url.pathname]
      if (!file) return next()
      try {
        const mod = server.ssrLoadModule ? await server.ssrLoadModule(file) : await import(pathToFileURL(`${process.cwd()}${file}`).href)
        const handler = mod[req.method ?? 'GET']
        if (!handler) {
          res.statusCode = 405
          return res.end()
        }
        const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
        const request = new Request(url, {
          method: req.method,
          headers: req.headers,
          body: hasBody ? Readable.toWeb(req) : undefined,
          ...(hasBody ? { duplex: 'half' } : {}),
        })
        const response = await handler(request)
        res.statusCode = response.status
        response.headers.forEach((value, name) => res.setHeader(name, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      } catch (error) {
        console.error(error)
        res.statusCode = 500
        res.end('Something went wrong.')
      }
    })
  }
  return { name: 'move-api', configureServer: mount, configurePreviewServer: mount }
}
