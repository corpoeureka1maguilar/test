const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-odoo-target');
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

  const odooTarget = req.headers['x-odoo-target'];

  if (!odooTarget) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { message: 'Missing x-odoo-target header' }
    }));
  }

  let target;
  try {
    target = new URL(odooTarget);
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { message: `Invalid x-odoo-target URL: ${odooTarget}` }
    }));
  }

  const isHttps = target.protocol === 'https:';
  const doReq = isHttps ? https.request : http.request;
  const port = target.port ? parseInt(target.port) : (isHttps ? 443 : 80);

  // Determine path to proxy to Odoo
  let targetPath = url;
  if (targetPath.startsWith('/api/proxy')) {
    targetPath = targetPath.replace(/^\/api\/proxy/, '') || '/';
  }

  const headers = { ...req.headers };
  headers['host'] = target.hostname;
  delete headers['origin'];
  delete headers['referer'];
  delete headers['x-odoo-target'];

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
      outHeaders['access-control-allow-headers'] = 'Content-Type, Authorization, x-odoo-target';
      res.writeHead(proxyRes.statusCode || 200, outHeaders);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on('error', (err) => {
    console.error('[proxy] error Odoo:', err.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { message: `No se pudo conectar con Odoo: ${err.message}` }
      }));
    }
  });

  req.pipe(proxyReq, { end: true });
};
