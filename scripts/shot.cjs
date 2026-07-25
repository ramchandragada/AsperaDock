/** Dev helper: screenshot an HTML file with Electron. Usage: electron scripts/shot.cjs <html> <out.png> [w] [h] */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const [input, output, w, h] = process.argv.slice(2).filter((a) => !a.startsWith('--'));

// Never touch the real app profile: previews use a disposable userData dir.
app.setPath('userData', path.join(app.getPath('temp'), 'asperadock-preview'));

app.disableHardwareAcceleration();

process.on('unhandledRejection', (err) => {
  console.error('shot failed:', err);
  app.exit(1);
});

console.error('shot args:', { input, output, w, h });

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: Number(w) || 1200,
    height: Number(h) || 200,
    show: false,
    frame: false,
  });
  await win.loadFile(path.resolve(input));
  await new Promise((r) => setTimeout(r, 700));
  const image = await win.capturePage();
  fs.writeFileSync(path.resolve(output), image.toPNG());
  console.log('wrote', output);
  app.quit();
});
