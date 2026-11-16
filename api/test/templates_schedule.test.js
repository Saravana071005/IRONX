import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import handleRequest from '../server.js';

function createMockReqRes(method, url, headers = {}, bodyPayload = null) {
  const req = new http.IncomingMessage(null);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000', ...headers };

  let statusCode = 200;
  let resHeaders = {};
  let body = '';

  const res = {
    writeHead(code, h) {
      statusCode = code;
      resHeaders = { ...resHeaders, ...(h || {}) };
    },
    setHeader(k, v) {
      resHeaders[k] = v;
    },
    end(data) {
      if (data) body += data;
    },
    get statusCode() { return statusCode; },
    get body() { return body; },
    get headers() { return resHeaders; }
  };

  if (bodyPayload) {
    req.push(typeof bodyPayload === 'string' ? bodyPayload : JSON.stringify(bodyPayload));
    req.push(null);
  } else {
    req.push(null);
  }

  return { req, res };
}

test('Templates & Schedule: unauthenticated requests to /api/templates return 401', async () => {
  const { req, res } = createMockReqRes('GET', '/api/templates');
  await handleRequest(req, res);
  assert.equal(res.statusCode, 401);
  const data = JSON.parse(res.body);
  assert.equal(data.error, 'not signed in');
});

test('Templates & Schedule: unauthenticated requests to /api/schedule return 401', async () => {
  const { req, res } = createMockReqRes('GET', '/api/schedule');
  await handleRequest(req, res);
  assert.equal(res.statusCode, 401);
  const data = JSON.parse(res.body);
  assert.equal(data.error, 'not signed in');
});
