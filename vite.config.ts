import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { request as httpReq } from 'node:http'
import { request as httpsReq } from 'node:https'
import { URL } from 'node:url'

// Mutable target — updated at runtime via /__odoo-proxy-target
let odooTarget = ''

function dynamicOdooProxy() {
  return {
    name: 'dynamic-odoo-proxy',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? ''

        // ── 1. Endpoint para actualizar el target ──────────────────
        if (url === '/__odoo-proxy-target' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              odooTarget = JSON.parse(body).target?.replace(/\/$/, '') ?? ''
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify({ ok: true, target: odooTarget }))
            } catch {
              res.statusCode = 400
              res.end('Bad Request')
            }
          })
          return
        }

        // ── 2. Proxy /jsonrpc y /web hacia Odoo ───────────────────
        if (!url.startsWith('/jsonrpc') && !url.startsWith('/web')) {
          return next()
        }

        if (!odooTarget) {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Proxy target not configured. Guardá la configuración primero.' }))
          return
        }

        const target = new URL(odooTarget)
        const isHttps = target.protocol === 'https:'
        const doRequest = isHttps ? httpsReq : httpReq

        const proxyReq = doRequest(
          {
            hostname: target.hostname,
            port: target.port || (isHttps ? 443 : 80),
            path: url,
            method: req.method,
            headers: { ...req.headers, host: target.hostname },
            rejectUnauthorized: false
          },
          (proxyRes) => {
            const headers: Record<string, string | string[]> = {}
            for (const [k, v] of Object.entries(proxyRes.headers)) {
              if (v !== undefined) headers[k] = v
            }
            headers['access-control-allow-origin'] = '*'
            res.writeHead(proxyRes.statusCode ?? 200, headers)
            proxyRes.pipe(res, { end: true })
          }
        )

        proxyReq.on('error', (err: Error) => {
          res.statusCode = 502
          res.end(`Proxy error: ${err.message}`)
        })

        req.pipe(proxyReq, { end: true })
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), dynamicOdooProxy()],
  server: {
    allowedHosts: true
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  }
})
