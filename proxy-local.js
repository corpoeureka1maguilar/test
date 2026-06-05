/**
 * proxy-local.js — corre en cada kiosco
 *
 * No sirve archivos estáticos. Solo:
 *  1. Lee la URL de Odoo desde proxy-config.json (persiste entre reinicios)
 *  2. Expone POST /__odoo-proxy-target para actualizarla desde la app
 *  3. Proxea /jsonrpc y /web hacia el Odoo configurado
 *
 * La app React se sirve desde el servidor central (no desde aquí).
 */

const http  = require('node:http')
const https = require('node:https')
const fs    = require('node:fs')
const path  = require('node:path')
const { URL } = require('node:url')

const PORT        = 9191   // Puerto del proxy local (diferente al app)
const CONFIG_FILE = path.join(__dirname, 'proxy-config.json')

// ── Cargar config persistida ───────────────────────────────────────────────
let odooTarget = ''
try {
  odooTarget = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).target || ''
  if (odooTarget) console.log(`[proxy] → ${odooTarget}`)
} catch { /* primera vez */ }

function saveTarget(t) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify({ target: t })) } catch {}
}

process.on('uncaughtException', e => console.error('[proxy] error:', e.message))

// ── Servidor ───────────────────────────────────────────────────────────────
http.createServer((req, res) => {
  const url = req.url || '/'

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    return res.end()
  }

  // Actualizar target
  if (url === '/__odoo-proxy-target' && req.method === 'POST') {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      try {
        odooTarget = (JSON.parse(body).target || '').replace(/\/$/, '')
        saveTarget(odooTarget)
        console.log(`[proxy] target → ${odooTarget}`)
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.statusCode = 400
        res.end('Bad Request')
      }
    })
    return
  }

  // Proxy Odoo
  if (url.startsWith('/jsonrpc') || url.startsWith('/web')) {
    if (!odooTarget) {
      res.statusCode = 503
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'Proxy no configurado' }))
    }

    const t      = new URL(odooTarget)
    const secure = t.protocol === 'https:'
    const doReq  = secure ? https.request : http.request

    const proxyReq = doReq({
      hostname: t.hostname,
      port: t.port || (secure ? 443 : 80),
      path: url,
      method: req.method,
      headers: { ...req.headers, host: t.hostname },
      rejectUnauthorized: false
    }, proxyRes => {
      const headers = { ...proxyRes.headers, 'access-control-allow-origin': '*' }
      res.writeHead(proxyRes.statusCode || 200, headers)
      proxyRes.pipe(res, { end: true })
    })

    proxyReq.on('error', e => {
      console.error('[proxy] error Odoo:', e.message)
      if (!res.headersSent) {
        res.statusCode = 502
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({ error: e.message }))
      }
    })

    return req.pipe(proxyReq, { end: true })
  }

  // Todo lo demás → 404 (los archivos vienen del servidor central)
  res.statusCode = 404
  res.end()

}).listen(PORT, '0.0.0.0', () => {
  console.log(`FEX Proxy local → http://localhost:${PORT}`)
  if (odooTarget) console.log(`[proxy] listo para → ${odooTarget}`)
})
