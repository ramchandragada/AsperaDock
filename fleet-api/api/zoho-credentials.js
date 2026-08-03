import { handleZohoCredentialsRequest } from '../lib/credentials.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const result = handleZohoCredentialsRequest(req.headers || {}, process.env);
  res.statusCode = result.status;
  res.end(JSON.stringify(result.body));
}
