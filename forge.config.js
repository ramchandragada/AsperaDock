const fs = require('node:fs');
const path = require('node:path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

function syncPdfjsRuntime() {
  const src = path.join(
    __dirname,
    'node_modules',
    'pdfjs-dist',
    'legacy',
    'build',
  );
  const dest = path.join(__dirname, 'packaging', 'pdfjs-runtime');
  fs.mkdirSync(dest, { recursive: true });
  for (const file of ['pdf.mjs', 'pdf.worker.mjs']) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
  }
}

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'asperadock',
    name: 'Aspera Hub',
    appBundleId: 'app.asperadock.desktop',
    // Stylized Aspera "A" only — not the full wordmark.
    icon: './assets/icon',
    // Prefer local Electron zip when registry downloads fail (Mint office nets).
    electronZipDir: './.electron-zips',
    extraResource: [
      './assets/icon.png',
      './assets/icon-16.png',
      './assets/icon-24.png',
      './assets/icon-32.png',
      './assets/icon-48.png',
      './assets/icon-64.png',
      './assets/icon-128.png',
      './assets/icon-256.png',
      './assets/icon-512.png',
      './packaging/asperadock-wrapper.sh',
      // Loaded at runtime by Aspera AI PDF text extract (not bundled into asar).
      './packaging/pdfjs-runtime',
    ],
  },
  hooks: {
    generateAssets: async () => {
      syncPdfjsRuntime();
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          name: 'asperadock',
          productName: 'Aspera Hub',
          genericName: 'Aspera Hub',
          description:
            'Aspera Hub — free Linux company workspace for WhatsApp, Arattai, Google Workspace, and Zoho (Mail, CRM, Books, WorkDrive, One)',
          categories: ['Office', 'Network'],
          section: 'utils',
          maintainer: 'Aspera <support@aspera.local>',
          icon: './assets/icon.png',
          // Matches app.setName('asperadock') / --class=asperadock for Mint Cinnamon + XFCE panels.
          desktopTemplate: './packaging/asperadock.desktop.ejs',
          // Install safe /usr/bin wrapper (always passes --disable-gpu*).
          scripts: {
            postinst: './packaging/debian-scripts/postinst',
          },
          // XFCE often needs an AppIndicator / StatusNotifier host for the tray icon.
          recommends: [
            'libayatana-appindicator3-1',
            'libnotify4',
          ],
          productDescription:
            'Aspera Hub — free Linux company workspace for WhatsApp, Arattai, Google Workspace, and Zoho (Mail, CRM, Books, WorkDrive, One). Tuned for Linux Mint (Cinnamon & XFCE).',
        },
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/appMenuPreload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/chromeMenuPreload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/findBarPreload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/webSearchPreload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/notesPreload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/notifCenterPreload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/aiResultPreload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/crmLookupPreload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/forwardPickerPreload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/extensionsPreload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      // Required OFF for A+: dock chrome is served via asperadock:// (see chromeProtocol.js).
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};
