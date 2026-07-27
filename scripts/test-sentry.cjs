/**
 * End-to-end Sentry verify: send one test event from Aspera Hub's DSN, then exit.
 * Run: env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron scripts/test-sentry.cjs
 */
const path = require('path');
const { pathToFileURL } = require('url');

// Sentry Electron SDK requires init BEFORE app 'ready'.
const { app } = require('electron');

async function boot() {
  const modPath = pathToFileURL(path.join(__dirname, '../src/sentryMain.js')).href;
  const { initSentryMain, sentryCaptureError, Sentry, resolveSentryDsn } = await import(modPath);

  const ok = initSentryMain({});
  const dsn = resolveSentryDsn({});
  console.log('Sentry init:', ok, 'DSN host:', dsn.split('@')[1]?.split('/')[0]);
  if (!ok) {
    console.error('INIT_FAILED');
    app.exit(1);
    return;
  }

  await app.whenReady();

  const id = `manual-test-${Date.now().toString(36)}`;
  sentryCaptureError('manual-test', {
    id,
    message: 'Manual test report from Aspera Hub verify script',
    reason: 'user-triggered-verify',
    context: { source: 'scripts/test-sentry.cjs' },
  });

  const flushed = Sentry.flush
    ? await Sentry.flush(10000)
    : await new Promise((r) => setTimeout(() => r(true), 4000));

  console.log('SENT', id, 'flushed=', flushed);
  app.exit(0);
}

boot().catch((err) => {
  console.error(err);
  app.exit(1);
});
