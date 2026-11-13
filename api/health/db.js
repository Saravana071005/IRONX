import handleRequest from '../server.js';

export default async function handler(req, res) {
  req.url = '/api/health/db';
  return handleRequest(req, res);
}
