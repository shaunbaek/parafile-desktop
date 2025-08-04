# Release Process for ParaFile Desktop

This document outlines the process for creating and distributing releases of ParaFile Desktop.

## Prerequisites

### Code Signing Certificates

#### macOS
1. Apple Developer Account with Developer ID Application certificate
2. Create app-specific password at https://appleid.apple.com
3. Export certificate as .p12 file
4. Convert to base64: `base64 -i certificate.p12 -o cert.txt`

#### Windows
1. Code signing certificate from a trusted CA
2. Export as .pfx file with password
3. Convert to base64: `base64 -i certificate.pfx -o cert.txt`

### GitHub Secrets

Set these secrets in your GitHub repository:

- `APPLE_CERT_BASE64` - Base64 encoded macOS certificate
- `APPLE_CERT_PASSWORD` - Password for macOS certificate
- `APPLE_ID` - Your Apple ID email
- `APPLE_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Your Apple Developer Team ID
- `APPLE_IDENTITY` - Certificate identity (e.g., "Developer ID Application: Name (TEAMID)")
- `WINDOWS_CERT_BASE64` - Base64 encoded Windows certificate
- `WINDOWS_CERT_PASSWORD` - Password for Windows certificate

## Release Process

### 1. Update Version

```bash
# Update version in package.json
npm version patch  # or minor/major
```

### 2. Update Changelog

Edit `CHANGELOG.md` with release notes:

```markdown
## [1.0.1] - 2024-01-15

### Added
- New feature description

### Fixed
- Bug fix description

### Changed
- Changed behavior description
```

### 3. Create Release Tag

```bash
git add .
git commit -m "Release v1.0.1"
git tag v1.0.1
git push origin main --tags
```

### 4. GitHub Actions

The workflow will automatically:
1. Build for all platforms (macOS, Windows, Linux)
2. Code sign the applications
3. Create distributable packages
4. Create a draft GitHub release
5. Upload all artifacts

### 5. Finalize Release

1. Go to GitHub Releases
2. Review the draft release
3. Update release notes if needed
4. Publish the release

## Manual Build Process

### Local Development Build

```bash
# Install dependencies
npm install

# Generate icons
npm run generate-icons

# Package for current platform
npm run package

# Create distributable
npm run make
```

### Platform-Specific Builds

#### macOS
```bash
# Requires macOS machine
npm run make -- --platform=darwin --arch=universal
```

#### Windows
```bash
# Can be built on any platform with Wine
npm run make -- --platform=win32 --arch=x64
```

#### Linux
```bash
# Requires Linux or Docker
npm run make -- --platform=linux --arch=x64
```

## Distribution Channels

### Direct Download
- Host releases on GitHub Releases
- Provide direct download links on website

### Auto-Update Server
1. Set up update server (e.g., using GitHub Pages)
2. Configure `UPDATE_SERVER_URL` in environment
3. Upload `latest.json` with release metadata

### Platform Stores (Future)
- Mac App Store: Requires additional sandboxing
- Microsoft Store: Use MSIX packaging
- Snap Store: Create snap package

## Testing Releases

### Pre-release Checklist
- [ ] Test on clean installation
- [ ] Test auto-update functionality
- [ ] Verify code signing (no security warnings)
- [ ] Test all core features
- [ ] Check system tray functionality
- [ ] Verify file monitoring works
- [ ] Test OpenAI integration

### Platform-Specific Testing

#### macOS
- [ ] Gatekeeper allows app to run
- [ ] Notarization successful
- [ ] System tray icon displays correctly

#### Windows
- [ ] No SmartScreen warnings
- [ ] Installer works correctly
- [ ] Uninstaller removes all files

#### Linux
- [ ] .deb installs on Ubuntu/Debian
- [ ] .rpm installs on Fedora
- [ ] Desktop entry created correctly

## Troubleshooting

### Build Failures
- Check GitHub Actions logs
- Ensure all secrets are set correctly
- Verify certificates haven't expired

### Code Signing Issues
- macOS: Check keychain access and certificate validity
- Windows: Ensure timestamp server is accessible

### Auto-Update Issues
- Verify `latest.json` format
- Check server CORS settings
- Ensure version numbers follow semver