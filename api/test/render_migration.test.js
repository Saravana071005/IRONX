import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import handleRequest from '../server.js';

function createMockReqRes(method, url, opts = {}) {
  const req = new http.IncomingMessage(null);
  req.method = method;
  req.url = url;
  req.headers = {
    host: 'opengym-backend.onrender.com',
    ...(opts.headers || {})
  };

  if (opts.body) {
    req.body = opts.body;
  }

  let statusCode = 200;
  let headers = {};
  let body = '';

  const res = {
    writeHead(code, h) {
      statusCode = code;
      headers = { ...headers, ...(h || {}) };
    },
    setHeader(k, v) {
      headers[k] = v;
    },
    getHeader(k) {
      return headers[k];
    },
    end(data) {
      if (data) body += data;
    },
    get statusCode() { return statusCode; },
    get body() { return body; },
    get headers() { return headers; }
  };

  return { req, res };
}

test('Render Migration: CORS preflight (OPTIONS) returns 204 with credentials and caching', async () => {
  const { req, res } = createMockReqRes('OPTIONS', '/api/health', {
    headers: {
      origin: 'https://opengym-frontend.onrender.com',
      'access-control-request-method': 'POST'
    }
  });
  await handleRequest(req, res);

  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://opengym-frontend.onrender.com');
  assert.equal(res.headers['Access-Control-Allow-Credentials'], 'true');
  assert.equal(res.headers['Access-Control-Max-Age'], '86400');
  assert.equal(res.headers['Vary'], 'Origin');
});

test('Render Migration: Cross-origin GET echoes origin and allows credentials', async () => {
  const { req, res } = createMockReqRes('GET', '/api/config', {
    headers: {
      origin: 'https://opengym-frontend.onrender.com'
    }
  });
  await handleRequest(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://opengym-frontend.onrender.com');
  assert.equal(res.headers['Access-Control-Allow-Credentials'], 'true');
  assert.equal(res.headers['Vary'], 'Origin');
  const data = JSON.parse(res.body);
  assert.equal(typeof data.invite_only, 'boolean');
});

test('Render Migration: GET /api/health responds with 200 and healthy status', async () => {
  const { req, res } = createMockReqRes('GET', '/api/health');
  await handleRequest(req, res);

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(typeof data.database, 'string');
  assert.match(data.database, /^(connected|unavailable)$/);
  assert.equal(data.password, undefined);
  assert.equal(data.uri, undefined);
});

test('Render Migration: GET /api/health/db adheres to health probe contract', async () => {
  const { req, res } = createMockReqRes('GET', '/api/health/db');
  await handleRequest(req, res);

  assert.ok(res.statusCode === 200 || res.statusCode === 503);
  const data = JSON.parse(res.body);
  assert.ok(data.database === 'connected' || data.database === 'unavailable');
});

test('Render Migration: WebAuthn register options derives RP_ID from caller origin', async () => {
  const { req, res } = createMockReqRes('POST', '/api/register/options', {
    headers: {
      origin: 'https://opengym-frontend.onrender.com'
    },
    body: { name: 'TestUser' }
  });
  await handleRequest(req, res);

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.ok(data.cid);
  assert.ok(data.options);
  assert.ok(data.options.challenge);
  assert.ok(data.options.rp);
  // Must match frontend origin domain, not the backend host
  assert.equal(data.options.rp.id, 'opengym-frontend.onrender.com');
});

test('Render Migration: Unauthenticated requests to /api/data return 401', async () => {
  const { req, res } = createMockReqRes('GET', '/api/data');
  await handleRequest(req, res);

  assert.equal(res.statusCode, 401);
  const data = JSON.parse(res.body);
  assert.equal(data.error, 'not signed in');
});

test('Render Migration: Unauthenticated state write to /api/data returns 401', async () => {
  const { req, res } = createMockReqRes('PUT', '/api/data', {
    body: { state: { workouts: [] } }
  });
  await handleRequest(req, res);

  assert.equal(res.statusCode, 401);
  const data = JSON.parse(res.body);
  assert.equal(data.error, 'not signed in');
});

test('Render Migration: Logout clears cookie with cross-domain SameSite=None; Secure over HTTPS', async () => {
  const { req, res } = createMockReqRes('POST', '/api/logout', {
    headers: {
      'x-forwarded-proto': 'https',
      origin: 'https://opengym-frontend.onrender.com'
    }
  });
  await handleRequest(req, res);

  assert.equal(res.statusCode, 200);
  const setCookie = res.headers['Set-Cookie'];
  assert.ok(setCookie, 'Set-Cookie must be set');
  assert.match(setCookie, /SameSite=None/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /Max-Age=0/i);
});

test('Render Migration: Daily health log route requires authentication', async () => {
  const { req, res } = createMockReqRes('GET', '/api/nutrition/health-log?date=2026-11-14');
  await handleRequest(req, res);

  assert.equal(res.statusCode, 401);
});
