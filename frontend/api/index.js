import handleRequest from './_lib/server.js';

export default async function handler(req, res) {
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.headers['x-original-url'];
  let pathStr = '';
  if (matchedPath && matchedPath.startsWith('/api')) {
    pathStr = matchedPath.split('?')[0];
  } else if (req.query && req.query.path) {
    const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
    pathStr = '/api/' + segments.join('/');
  } else if (req.url && req.url.startsWith('/api')) {
    pathStr = req.url.split('?')[0];
  } else {
    pathStr = '/api';
  }

  let search = '';
  if (req.url && req.url.includes('?')) {
    search = req.url.slice(req.url.indexOf('?'));
  } else if (req.query) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k !== 'path') {
        if (Array.isArray(v)) v.forEach(item => q.append(k, item));
        else if (v !== undefined) q.append(k, v);
      }
    }
    const qs = q.toString();
    if (qs) search = '?' + qs;
  }
  req.url = pathStr + search;

  return handleRequest(req, res);
}
