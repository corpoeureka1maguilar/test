const http = require('node:http')
const https = require('node:https')
const fs = require('node:fs')
const path = require('node:path')
const { URL } = require('node:url')

const PORT = 4173
const DIST = path.join(__dirname, 'dist')
const CONFIG_FILE = path.join(__dirname, 'proxy-config.json')

// ── Cargar target persistido (sobrevive reinicios del servidor) ─────────────
let odooTarget = ''
try {
  const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  odooTarget = saved.target || ''
  if (odooTarget) console.log(`[proxy] target cargado: ${odooTarget}`)
} catch { /* primera vez, sin config */ }

function saveTarget(target) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify({ target })) } catch {}
}

// ── Prevenir crashes del proceso ────────────────────────────────────────────
process.on('uncaughtException', (err) => console.error('[server] uncaughtException:', err.message))
process.on('unhandledRejection', (err) => console.error('[server] unhandledRejection:', err))

// ── MIME types ───────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.ico':  'image/x-icon',
}

const server = http.createServer((req, res) => {
  const url = req.url || '/'

  // ── CORS preflight ─────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    res.end()
    return
  }

  // ── Endpoint para setear el proxy target ───────────────────────────────────
  if (url === '/__odoo-proxy-target' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const newTarget = (JSON.parse(body).target || '').replace(/\/$/, '')
        odooTarget = newTarget
        saveTarget(newTarget)
        console.log(`[proxy] target actualizado: ${newTarget}`)
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({ ok: true, target: newTarget }))
      } catch (e) {
        res.statusCode = 400
        res.end('Bad Request')
      }
    })
    return
  }

  // ── Proxy para la impresora fiscal ─────────────────────────────────────────
  if (url.startsWith('/printer-proxy')) {
    const headerTarget = req.headers['x-printer-target']
    if (!headerTarget) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.end(JSON.stringify({ error: 'Falta la cabecera x-printer-target' }))
      return
    }

    let target
    try {
      target = new URL(headerTarget)
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.end(JSON.stringify({ error: 'Cabecera x-printer-target no es una URL válida' }))
      return
    }

    const isHttps = target.protocol === 'https:'
    const doReq = isHttps ? https.request : http.request
    const port = target.port ? parseInt(target.port) : (isHttps ? 443 : 80)
    const pathName = url.replace(/^\/printer-proxy/, '') // /printer-proxy/Estado -> /Estado
    const targetPath = (target.pathname.replace(/\/$/, '') + pathName).replace(/\/+/g, '/')

    console.log(`[proxy-printer] ${req.method} ${url} → ${headerTarget}`)

    const headers = Object.assign({}, req.headers)
    headers['host'] = target.hostname
    delete headers['origin']
    delete headers['referer']
    delete headers['x-printer-target']

    const proxyReq = doReq(
      { hostname: target.hostname, port, path: targetPath, method: req.method, headers, rejectUnauthorized: false },
      (proxyRes) => {
        const outHeaders = Object.assign({}, proxyRes.headers)
        outHeaders['access-control-allow-origin'] = '*'
        outHeaders['access-control-allow-headers'] = 'Content-Type, Authorization, x-printer-target'
        res.writeHead(proxyRes.statusCode || 200, outHeaders)
        proxyRes.pipe(res, { end: true })
      }
    )

    proxyReq.on('error', (err) => {
      console.error('[proxy-printer] error al conectar con la impresora:', err.message)
      if (!res.headersSent) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({ error: `Error de proxy de impresora: ${err.message}` }))
      }
    })

    req.pipe(proxyReq, { end: true })
    return
  }

  // ── Proxy hacia Odoo ───────────────────────────────────────────────────────
  if (url.startsWith('/jsonrpc') || url.startsWith('/web')) {
    const headerTarget = req.headers['x-odoo-target']
    const currentTarget = headerTarget || odooTarget

    if (!currentTarget) {
      console.warn('[proxy] /jsonrpc bloqueado: odooTarget no configurado')
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { message: 'Proxy target not configured. Save your settings first.' } }))
      return
    }

    let target
    try { target = new URL(currentTarget) }
    catch {
      res.statusCode = 500
      res.end('Invalid proxy target URL')
      return
    }

    const isHttps = target.protocol === 'https:'
    const doReq = isHttps ? https.request : http.request
    const port = target.port ? parseInt(target.port) : (isHttps ? 443 : 80)

    console.log(`[proxy] ${req.method} ${url} → ${currentTarget}`)

    // Construir headers sin los que causan problemas
    const headers = Object.assign({}, req.headers)
    headers['host'] = target.hostname
    delete headers['origin']
    delete headers['referer']
    delete headers['x-odoo-target']

    const proxyReq = doReq(
      { hostname: target.hostname, port, path: url, method: req.method, headers, rejectUnauthorized: false },
      (proxyRes) => {
        const outHeaders = Object.assign({}, proxyRes.headers)
        outHeaders['access-control-allow-origin'] = '*'
        outHeaders['access-control-allow-headers'] = 'Content-Type, Authorization'
        res.writeHead(proxyRes.statusCode || 200, outHeaders)
        proxyRes.pipe(res, { end: true })
      }
    )

    proxyReq.on('error', (err) => {
      console.error('[proxy] error al conectar con Odoo:', err.message)
      if (!res.headersSent) {
        res.statusCode = 502
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { message: `No se pudo conectar con Odoo: ${err.message}` } }))
      }
    })

    req.pipe(proxyReq, { end: true })
    return
  }

  // ── Archivos estáticos (SPA) ───────────────────────────────────────────────
  let filePath = path.join(DIST, url === '/' ? 'index.html' : url)
  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(DIST, 'index.html')
  } catch {
    filePath = path.join(DIST, 'index.html')
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.statusCode = 404; res.end('Not Found'); return }
    const ext = path.extname(filePath).toLowerCase()
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
    res.end(data)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`FEX Autopago → http://localhost:${PORT}`)
  if (odooTarget) console.log(`[proxy] listo para → ${odooTarget}`)
  else console.log(`[proxy] esperando configuración...`)
})
