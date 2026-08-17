import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setAiResultServerHtml,
  ensureAiResultServer,
  aiResultLocalUrl,
  getAiResultServerPort,
  stopAiResultServer,
} from '../src/aiResultServer.js';

test('AI result local URL is loopback http secure context', async () => {
  setAiResultServerHtml('<!doctype html><title>t</title><body>ok</body>');
  const p = await ensureAiResultServer();
  assert.equal(typeof p, 'number');
  assert.ok(p > 0);
  assert.equal(getAiResultServerPort(), p);
  const url = aiResultLocalUrl(true);
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/\?dark=1$/);

  const res = await fetch(`http://127.0.0.1:${p}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  const policy = res.headers.get('permissions-policy') || '';
  assert.doesNotMatch(policy, /microphone=\(self\)/);
  assert.match(policy, /microphone=\(\)/);
  const body = await res.text();
  assert.match(body, /<title>t<\/title>/);

  await stopAiResultServer();
  assert.equal(getAiResultServerPort(), 0);
});
