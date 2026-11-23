import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import handleRequest from '../server.js';

function createMockReqRes(method, url) {
  const req = new http.IncomingMessage(null);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000' };

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
    end(data) {
      if (data) body += data;
    },
    get statusCode() { return statusCode; },
    get body() { return body; },
    get headers() { return headers; }
  };

  return { req, res };
}

test('GET / returns 200 informational payload', async () => {
  const { req, res } = createMockReqRes('GET', '/');
  await handleRequest(req, res);

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.deepEqual(data, {
    status: 'ok',
    service: 'IRONX API',
    message: 'Backend server is running'
  });
});

test('GET /api/health returns valid database status without leaking secrets', async () => {
  const { req, res } = createMockReqRes('GET', '/api/health');
  await handleRequest(req, res);

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(typeof data.database, 'string');
  assert.match(data.database, /^(connected|unavailable)$/);
  // Ensure no sensitive fields are present
  assert.equal(data.password, undefined);
  assert.equal(data.uri, undefined);
  assert.equal(data.connectionString, undefined);
  assert.equal(data.stack, undefined);
});

test('GET /api/health/db returns simple {"database":"connected"} or {"database":"unavailable"}', async () => {
  const { req, res } = createMockReqRes('GET', '/api/health/db');
  await handleRequest(req, res);

  assert.ok(res.statusCode === 200 || res.statusCode === 503);
  const data = JSON.parse(res.body);
  assert.ok(data.database === 'connected' || data.database === 'unavailable');
  // Strict check on keys: only database must be present
  assert.deepEqual(Object.keys(data), ['database']);
});
