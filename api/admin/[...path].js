import handleRequest from '../server.js';

export default async function handler(req, res) {
  let subpath = '';
  if (req.query && req.query.path) {
    const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
    subpath = '/' + segments.join('/');
  }
  const pathStr = '/api/admin' + subpath;

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
