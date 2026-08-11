import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE_MAX_DURATION_SEC,
  normalizeAudioMime,
  audioFileExtension,
} from '../src/ai/speechToTextUtil.js';

test('normalizeAudioMime defaults webm and strips codec suffix', () => {
  assert.equal(normalizeAudioMime('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(normalizeAudioMime('audio/ogg'), 'audio/ogg');
  assert.equal(normalizeAudioMime(''), 'audio/webm');
  assert.equal(normalizeAudioMime('audio/x-wav'), 'audio/wav');
});

test('audioFileExtension matches mime', () => {
  assert.equal(audioFileExtension('audio/webm'), 'recording.webm');
  assert.equal(audioFileExtension('audio/ogg'), 'recording.ogg');
  assert.equal(audioFileExtension('audio/wav'), 'recording.wav');
});

test('voice max duration matches Sarvam REST limit', () => {
  assert.equal(VOICE_MAX_DURATION_SEC, 30);
});
