const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'src', 'assets', 'icon'),
    appBundleId: 'com.shaunbaek.parafile-desktop',
    appCategoryType: 'public.app-category.productivity',
    osxSign: process.env.APPLE_IDENTITY ? {
      identity: process.env.APPLE_IDENTITY,
      'hardened-runtime': true,
      'gatekeeper-assess': false,
      entitlements: 'entitlements.plist',
      'entitlements-inherit': 'entitlements.plist',
      'signature-flags': 'library'
    } : false,
    osxNotarize: process.env.APPLE_ID ? {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    } : false,
    extraResource: [
      'src/assets/icon.png',
      'src/assets/tray-icon.png'
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ParaFileDesktop',
        authors: 'Shaun Baek',
        exe: 'ParaFile Desktop.exe',
        description: 'AI-powered document organization and renaming application',
        iconUrl: 'https://raw.githubusercontent.com/shaunbaek/parafile-desktop/main/src/assets/icon.ico',
        setupIcon: path.join(__dirname, 'src', 'assets', 'icon.ico'),
        certificateFile: process.env.WINDOWS_CERT_FILE,
        certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
        noMsi: true
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Shaun Baek',
          homepage: 'https://github.com/shaunbaek/parafile-desktop',
          icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
          categories: ['Utility', 'Office'],
          description: 'AI-powered document organization and renaming application'
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          homepage: 'https://github.com/shaunbaek/parafile-desktop',
          categories: ['Utility', 'Office'],
          description: 'AI-powered document organization and renaming application',
          icon: path.join(__dirname, 'src', 'assets', 'icon.png')
        }
      }
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        format: 'ULFO',
        overwrite: true,
        name: 'ParaFile Desktop',
        additionalDMGOptions: {
          quiet: true
        }
      }
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'shaunbaek',
          name: 'parafile-desktop'
        },
        prerelease: false,
        draft: true
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};