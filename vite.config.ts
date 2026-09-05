import path from 'node:path'
import { defineConfig } from 'vite'

let requestCount = 0

export default defineConfig({
  root: path.resolve('test/fixtures/app'),
  publicDir: path.resolve('public'),
  plugins: [{
    name: 'test-api',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        requestCount += 1
        const body = req.url?.startsWith('/large')
          ? 'x'.repeat(2048)
          : JSON.stringify({ ok: true, path: req.url, requestCount })
        res.statusCode = 200
        res.setHeader('content-type', req.url?.startsWith('/large') ? 'text/plain' : 'application/json')
        res.setHeader('content-length', Buffer.byteLength(body))
        res.end(body)
      })
    },
  }],
})
