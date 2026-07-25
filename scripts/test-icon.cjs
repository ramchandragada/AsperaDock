const { app, nativeImage, BrowserWindow } = require('electron');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const p = path.join(__dirname, '../assets/icon.png');
  const img = nativeImage.createFromPath(p);
  console.log('empty?', img.isEmpty(), 'size', img.getSize());
  console.log('png bytes', img.toPNG().length);

  const win = new BrowserWindow({
    width: 600,
    height: 400,
    show: true,
    title: 'IconTestWindow',
    icon: img,
  });
  win.setIcon(img);

  await new Promise((r) => setTimeout(r, 1000));

  try {
    const tree = execSync('xwininfo -root -tree', { encoding: 'utf8' });
    const line = tree.split('\n').find((l) => l.includes('IconTestWindow') && !l.includes('mutter'));
    console.log('line', line && line.trim().slice(0, 140));
    const wid = line && line.match(/0x[0-9a-f]+/)?.[0];
    console.log('wid', wid);
    if (wid) {
      const icon = execSync(`xprop -id ${wid} _NET_WM_ICON`, { encoding: 'utf8' });
      const body = icon.includes('=') ? icon.split('=')[1].trim() : '';
      const nums = body ? body.replace(/\n/g, '').split(',').filter((x) => x.trim()) : [];
      console.log('icon ints', nums.length, 'first', nums.slice(0, 4));
    }
  } catch (e) {
    console.log('check fail', e.message);
  }
  app.quit();
});
