const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-odoo-target, x-printer-target');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const url = req.url || '';

  // If it's a test/save target endpoint, just return ok
  if (url.startsWith('/__odoo-proxy-target')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true }));
  }

  const targetHeader = req.headers['x-printer-target'] || req.headers['x-odoo-target'];

  if (!targetHeader) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { message: 'Missing target header (x-odoo-target or x-printer-target)' }
    }));
  }

  let target;
  try {
    target = new URL(targetHeader);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { message: `Invalid target URL: ${targetHeader}` }
    }));
  }

  const isHttps = target.protocol === 'https:';
  const doReq = isHttps ? https.request : http.request;
  const port = target.port ? parseInt(target.port) : (isHttps ? 443 : 80);

  // Determine path to proxy
  let targetPath = url;
  if (targetPath.startsWith('/api/proxy')) {
    targetPath = targetPath.replace(/^\/api\/proxy/, '') || '/';
  }
  if (targetPath.startsWith('/printer-proxy')) {
    targetPath = targetPath.replace(/^\/printer-proxy/, '') || '/';
  }

  const headers = { ...req.headers };
  headers['host'] = target.hostname;
  delete headers['origin'];
  delete headers['referer'];
  delete headers['x-odoo-target'];
  delete headers['x-printer-target'];

  const proxyReq = doReq(
    {
      hostname: target.hostname,
      port,
      path: targetPath,
      method: req.method,
      headers,
      rejectUnauthorized: false
    },
    (proxyRes) => {
      const outHeaders = { ...proxyRes.headers };
      outHeaders['access-control-allow-origin'] = '*';
      outHeaders['access-control-allow-headers'] = 'Content-Type, Authorization, x-odoo-target, x-printer-target';
      res.writeHead(proxyRes.statusCode || 200, outHeaders);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on('error', (err) => {
    console.error('[proxy] error Target:', err.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { message: `No se pudo conectar con el destino: ${err.message}` }
      }));
    }
  });

  req.pipe(proxyReq, { end: true });
};
