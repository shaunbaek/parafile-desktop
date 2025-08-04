# Complete Distribution Guide for ParaFile Desktop

This comprehensive guide documents the entire distribution setup for ParaFile Desktop, including all configurations, workflows, and processes implemented for packaging and distributing the application across multiple platforms.

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Configuration Files](#configuration-files)
4. [Build System](#build-system)
5. [Code Signing](#code-signing)
6. [Auto-Updates](#auto-updates)
7. [GitHub Actions](#github-actions)
8. [Distribution Process](#distribution-process)
9. [Platform-Specific Details](#platform-specific-details)
10. [Troubleshooting](#troubleshooting)

## Overview

ParaFile Desktop is configured for professional distribution with:
- Multi-platform support (macOS, Windows, Linux)
- Automated builds via GitHub Actions
- Code signing and notarization
- Auto-update functionality
- Professional packaging (DMG, EXE, DEB, RPM)

## Project Structure

```
parafile-desktop/
├── .github/
│   └── workflows/
│       ├── build.yml                 # CI builds for PRs
│       └── build-and-release.yml     # Release builds
├── src/
│   ├── assets/
│   │   ├── create-icons.js         # Placeholder icon creator
│   │   ├── generate-icons.js       # Production icon generator
│   │   ├── icon.png                # Main app icon
│   │   └── tray-icon.png          # System tray icon
│   └── services/
│       └── autoUpdater.js          # Auto-update service
├── .env.build.example              # Build environment template
├── .gitignore                      # Updated for build artifacts
├── DISTRIBUTION.md                 # Quick distribution guide
├── RELEASE.md                      # Release process documentation
├── entitlements.plist             # macOS app permissions
├── forge.config.js                # Electron Forge configuration
└── package.json                   # Project configuration
```

## Configuration Files

### 1. package.json

Key additions for distribution:

```json
{
  "name": "parafile-desktop",
  "productName": "ParaFile Desktop",
  "version": "1.0.0",
  "description": "AI-powered document organization and renaming application",
  "homepage": "https://github.com/shaunbaek/parafile-desktop",
  "repository": {
    "type": "git",
    "url": "https://github.com/shaunbaek/parafile-desktop.git"
  },
  "bugs": {
    "url": "https://github.com/shaunbaek/parafile-desktop/issues"
  },
  "scripts": {
    "generate-icons": "node src/assets/generate-icons.js",
    "prebuild": "npm run generate-icons"
  },
  "dependencies": {
    "electron-updater": "^6.1.8"
  },
  "devDependencies": {
    "@electron-forge/maker-dmg": "^7.8.1",
    "@electron-forge/publisher-github": "^7.8.1"
  }
}
```

### 2. forge.config.js

Complete Electron Forge configuration:

```javascript
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
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ParaFileDesktop',
        authors: 'Shaun Baek',
        exe: 'ParaFile Desktop.exe',
        description: 'AI-powered document organization',
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
          categories: ['Utility', 'Office']
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          homepage: 'https://github.com/shaunbaek/parafile-desktop',
          categories: ['Utility', 'Office'],
          icon: path.join(__dirname, 'src', 'assets', 'icon.png')
        }
      }
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        overwrite: true,
        name: 'ParaFile Desktop'
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
    })
  ]
};
```

### 3. entitlements.plist

macOS permissions configuration:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>
```

## Build System

### Local Build Commands

```bash
# Install dependencies
npm install

# Generate icons (optional)
npm run generate-icons

# Package application (creates .app bundle)
npm run package

# Create distributables (DMG, EXE, etc.)
npm run make

# Publish to GitHub (requires GITHUB_TOKEN)
npm run publish
```

### Platform-Specific Builds

```bash
# macOS
npm run make -- --platform=darwin --arch=arm64
npm run make -- --platform=darwin --arch=x64
npm run make -- --platform=darwin --arch=universal

# Windows
npm run make -- --platform=win32 --arch=x64
npm run make -- --platform=win32 --arch=ia32

# Linux
npm run make -- --platform=linux --arch=x64
```

## Code Signing

### macOS Code Signing

1. **Requirements:**
   - Apple Developer Account
   - Developer ID Application certificate
   - App-specific password

2. **Setup:**
   ```bash
   # Export certificate as .p12
   # Convert to base64
   base64 -i certificate.p12 -o cert.txt
   ```

3. **Environment Variables:**
   ```bash
   APPLE_ID=your-apple-id@example.com
   APPLE_PASSWORD=app-specific-password
   APPLE_TEAM_ID=YOUR_TEAM_ID
   APPLE_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
   ```

### Windows Code Signing

1. **Requirements:**
   - Code signing certificate from trusted CA
   - Certificate in .pfx format

2. **Setup:**
   ```bash
   # Convert to base64
   base64 -i certificate.pfx -o cert.txt
   ```

3. **Environment Variables:**
   ```bash
   WINDOWS_CERT_FILE=/path/to/certificate.pfx
   WINDOWS_CERT_PASSWORD=certificate-password
   ```

## Auto-Updates

### Implementation

The auto-updater service (`src/services/autoUpdater.js`):

```javascript
const { autoUpdater } = require('electron-updater');

class AutoUpdaterService {
  constructor() {
    this.configureUpdater();
    this.setupEventHandlers();
  }

  configureUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
  }

  checkForUpdates() {
    if (process.env.NODE_ENV !== 'development') {
      autoUpdater.checkForUpdatesAndNotify();
    }
  }
}
```

### Integration in main process:

```javascript
// In src/index.js
app.whenReady().then(() => {
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater = new AutoUpdaterService();
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000);
  }
});
```

### Update Server Configuration

1. **GitHub Releases** (Default):
   - Automatic with GitHub publisher
   - No additional configuration needed

2. **Custom Server**:
   ```bash
   UPDATE_SERVER_URL=https://your-update-server.com
   ```

## GitHub Actions

### 1. Build Workflow (.github/workflows/build.yml)

Runs on every push and PR:
- Multi-platform builds
- Basic testing
- Artifact uploads on failure

### 2. Release Workflow (.github/workflows/build-and-release.yml)

Triggered by version tags:
- Full multi-platform builds
- Code signing and notarization
- Creates draft GitHub release
- Uploads all artifacts
- Generates update metadata

### GitHub Secrets Required

```
APPLE_CERT_BASE64
APPLE_CERT_PASSWORD
APPLE_ID
APPLE_PASSWORD
APPLE_TEAM_ID
APPLE_IDENTITY
WINDOWS_CERT_BASE64
WINDOWS_CERT_PASSWORD
GITHUB_TOKEN (automatic)
```

## Distribution Process

### 1. Version Update

```bash
# Update version
npm version patch  # or minor/major

# Update CHANGELOG.md
echo "## [1.0.1] - $(date +%Y-%m-%d)" >> CHANGELOG.md
```

### 2. Create Release

```bash
# Commit changes
git add .
git commit -m "Release v1.0.1"

# Create and push tag
git tag v1.0.1
git push origin main --tags
```

### 3. Automated Build

GitHub Actions will:
1. Build for all platforms
2. Sign and notarize apps
3. Create distributables
4. Upload to draft release

### 4. Publish Release

1. Go to GitHub Releases
2. Review draft release
3. Add release notes
4. Publish

## Platform-Specific Details

### macOS

**File Types:**
- `.dmg` - Disk image installer
- `.zip` - Direct app bundle

**Installation:**
1. Download DMG
2. Open and drag to Applications
3. First run: right-click → Open

**Requirements:**
- macOS 10.13 or later
- 64-bit processor

### Windows

**File Types:**
- `.exe` - Squirrel installer
- `.nupkg` - Update packages

**Installation:**
1. Download installer
2. Run and follow prompts
3. Auto-creates shortcuts

**Requirements:**
- Windows 10 or later
- 64-bit processor

### Linux

**File Types:**
- `.deb` - Debian/Ubuntu
- `.rpm` - Fedora/RHEL
- `.zip` - Universal

**Installation:**
```bash
# Debian/Ubuntu
sudo dpkg -i parafile-desktop_1.0.0_amd64.deb

# Fedora/RHEL
sudo rpm -i parafile-desktop-1.0.0.x86_64.rpm
```

## Troubleshooting

### Build Issues

1. **Icon errors**:
   ```bash
   npm run generate-icons
   ```

2. **Signing failures**:
   - Check certificate validity
   - Verify environment variables
   - Ensure keychain access (macOS)

3. **Package errors**:
   ```bash
   # Clean build
   rm -rf out/
   npm run package
   ```

### Distribution Issues

1. **GitHub Actions failures**:
   - Check secrets configuration
   - Review workflow logs
   - Verify permissions

2. **Auto-update issues**:
   - Check update server URL
   - Verify version numbers
   - Review update logs

3. **Platform-specific problems**:
   - macOS: Gatekeeper/notarization
   - Windows: SmartScreen
   - Linux: Dependencies

### Common Commands

```bash
# Check Electron version
npx electron --version

# Test packaging locally
npm run package -- --platform=darwin --arch=arm64

# Debug mode
DEBUG=electron-forge:* npm run make

# Clean everything
rm -rf out/ node_modules/
npm install
```

## Best Practices

1. **Version Management**:
   - Use semantic versioning
   - Update CHANGELOG.md
   - Tag releases properly

2. **Testing**:
   - Test on clean systems
   - Verify auto-updates
   - Check all platforms

3. **Security**:
   - Never commit certificates
   - Use environment variables
   - Rotate credentials regularly

4. **Documentation**:
   - Keep README updated
   - Document breaking changes
   - Provide migration guides

## Future Enhancements

1. **Additional Platforms**:
   - Snap packages
   - AppImage
   - Microsoft Store
   - Mac App Store

2. **Improved Updates**:
   - Delta updates
   - Background downloads
   - Rollback capability

3. **Analytics**:
   - Download tracking
   - Update adoption
   - Crash reporting

## Support Resources

- [Electron Forge Documentation](https://www.electronforge.io/)
- [Electron Builder Comparison](https://www.electron.build/vs-forge)
- [Code Signing Guide](https://www.electron.build/code-signing)
- [Auto Update Documentation](https://www.electron.build/auto-update)