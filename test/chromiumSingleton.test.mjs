import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { clearStaleChromiumSingleton } from '../src/chromiumSingleton.js';

function fakeIo({
  lockTarget = null,
  lockAlive = false,
  socketDangling = false,
  hasLock = true,
  hasSocket = true,
} = {}) {
  const removed = [];
  const files = new Map();
  if (hasLock && lockTarget != null) {
    files.set('SingletonLock', { link: lockTarget });
  }
  if (hasSocket) {
    files.set('SingletonSocket', { link: '/tmp/fake-socket', dangling: socketDangling });
  }
  files.set('SingletonCookie', { link: 'cookie' });

  const resolve = (p) => path.basename(p);

  return {
    removed,
    io: {
      join: path.join,
      lstatSync(p) {
        const name = resolve(p);
        if (!files.has(name)) {
          const err = new Error('ENOENT');
          err.code = 'ENOENT';
          throw err;
        }
        return { isSymbolicLink: () => true };
      },
      statSync(p) {
        const name = resolve(p);
        const entry = files.get(name);
        if (!entry || entry.dangling) {
          const err = new Error('ENOENT');
          err.code = 'ENOENT';
          throw err;
        }
        return {};
      },
      readlinkSync(p) {
        const name = resolve(p);
        const entry = files.get(name);
        if (!entry) {
          const err = new Error('ENOENT');
          err.code = 'ENOENT';
          throw err;
        }
        return entry.link;
      },
      unlinkSync(p) {
        removed.push(resolve(p));
        files.delete(resolve(p));
      },
      kill(pid, signal) {
        if (signal === 0 && lockAlive) return true;
        const err = new Error('ESRCH');
        err.code = 'ESRCH';
        throw err;
      },
    },
  };
}

test('live lock owner is never cleared even if socket is dangling', () => {
  const { io, removed } = fakeIo({
    lockTarget: 'host-4242',
    lockAlive: true,
    socketDangling: true,
  });
  assert.equal(
    clearStaleChromiumSingleton('/tmp/Aspera Dock', io),
    'kept-live',
  );
  assert.deepEqual(removed, []);
});

test('dead lock owner is cleaned', () => {
  const { io, removed } = fakeIo({
    lockTarget: 'host-4242',
    lockAlive: false,
    socketDangling: false,
  });
  assert.equal(clearStaleChromiumSingleton('/tmp/Aspera Dock', io), 'cleaned');
  assert.ok(removed.includes('SingletonLock'));
  assert.ok(removed.includes('SingletonCookie'));
  assert.ok(removed.includes('SingletonSocket'));
});

test('dangling socket with no lock is cleaned', () => {
  const { io, removed } = fakeIo({
    hasLock: false,
    hasSocket: true,
    socketDangling: true,
  });
  assert.equal(clearStaleChromiumSingleton('/tmp/Aspera Dock', io), 'cleaned');
  assert.ok(removed.includes('SingletonSocket'));
});

test('intact lock+socket with no cleanup needed is a noop when unlockable', () => {
  // No lock symlink and no dangling socket → nothing to do.
  const { io, removed } = fakeIo({
    hasLock: false,
    hasSocket: false,
  });
  assert.equal(clearStaleChromiumSingleton('/tmp/Aspera Dock', io), 'noop');
  assert.deepEqual(removed, []);
});
