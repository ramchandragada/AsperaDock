const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'asperadock',
    name: 'Aspera Hub',
    appBundleId: 'app.asperadock.desktop',
    // Stylized Aspera "A" only — not the full wordmark.
    icon: './assets/icon',
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
    ],
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
            'Aspera Hub — free Linux company workspace for WhatsApp, Arattai, Google Workspace, and Zoho',
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
            'Aspera Hub — free Linux company workspace for WhatsApp, Arattai, Google Workspace, and Zoho. Tuned for Linux Mint (Cinnamon & XFCE).',
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
