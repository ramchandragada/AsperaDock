import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBearerToken,
  handleZohoCredentialsRequest,
  timingSafeEqualString,
} from '../fleet-api/lib/credentials.js';
import {
  buildFleetCredentialsUrl,
  normalizeFleetApiUrl,
  parseFleetCredentialsBody,
} from '../src/zohoCrm/fleetPull.js';

test('timingSafeEqualString matches equal strings only', () => {
  assert.equal(timingSafeEqualString('abc', 'abc'), true);
  assert.equal(timingSafeEqualString('abc', 'abd'), false);
  assert.equal(timingSafeEqualString('abc', 'abcd'), false);
});

test('extractBearerToken parses Authorization header', () => {
  assert.equal(extractBearerToken('Bearer secret-token'), 'secret-token');
  assert.equal(extractBearerToken('bearer secret-token'), 'secret-token');
  assert.equal(extractBearerToken('Basic x'), '');
  assert.equal(extractBearerToken(''), '');
});

test('handleZohoCredentialsRequest rejects missing or wrong bearer', () => {
  const env = {
    FLEET_BEARER_TOKEN: 'fleet-secret',
    ZOHO_CRM_CLIENT_ID: 'id',
    ZOHO_CRM_CLIENT_SECRET: 'sec',
    ZOHO_CRM_REFRESH_TOKEN: 'ref',
    ZOHO_CRM_DC: 'in',
  };
  assert.equal(handleZohoCredentialsRequest({}, env).status, 401);
  assert.equal(
    handleZohoCredentialsRequest({ authorization: 'Bearer wrong' }, env).status,
    401,
  );
  const ok = handleZohoCredentialsRequest(
    { authorization: 'Bearer fleet-secret' },
    env,
  );
  assert.equal(ok.status, 200);
  assert.equal(ok.body.clientId, 'id');
  assert.equal(ok.body.refreshToken, 'ref');
  assert.equal(ok.body.dc, 'in');
});

test('handleZohoCredentialsRequest returns 503 when Zoho env incomplete', () => {
  const result = handleZohoCredentialsRequest(
    { authorization: 'Bearer fleet-secret' },
    { FLEET_BEARER_TOKEN: 'fleet-secret', ZOHO_CRM_CLIENT_ID: 'id' },
  );
  assert.equal(result.status, 503);
});

test('normalizeFleetApiUrl requires https and strips trailing slash', () => {
  assert.equal(
    normalizeFleetApiUrl('https://fleet.vercel.app/'),
    'https://fleet.vercel.app',
  );
  assert.equal(normalizeFleetApiUrl('http://fleet.vercel.app'), '');
  assert.equal(normalizeFleetApiUrl('not a url'), '');
});

test('buildFleetCredentialsUrl appends api path', () => {
  assert.equal(
    buildFleetCredentialsUrl('https://fleet.vercel.app'),
    'https://fleet.vercel.app/api/zoho-credentials',
  );
  assert.equal(
    buildFleetCredentialsUrl(
      'https://fleet.vercel.app/api/zoho-credentials',
    ),
    'https://fleet.vercel.app/api/zoho-credentials',
  );
});

test('parseFleetCredentialsBody validates required fields', () => {
  assert.equal(parseFleetCredentialsBody(null).ok, false);
  assert.equal(parseFleetCredentialsBody({ error: 'nope' }).ok, false);
  const ok = parseFleetCredentialsBody({
    clientId: 'a',
    clientSecret: 'b',
    refreshToken: 'c',
    dc: 'in',
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.clientId, 'a');
  assert.equal(ok.dc, 'in');
});
