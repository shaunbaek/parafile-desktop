# Distribution Guide for ParaFile Desktop

This guide explains how to package and distribute ParaFile Desktop for online platforms.

## Quick Start

### 1. Set Up Environment

Create `.env.build` file from the template:
```bash
cp .env.build.example .env.build
# Edit .env.build with your code signing credentials
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Generate Icons (Optional)

```bash
# Generate all icon formats from source icon
npm run generate-icons
```

### 4. Build for Distribution

#### All Platforms (using GitHub Actions)
```bash
# Push a version tag to trigger automated builds
git tag v1.0.0
git push origin v1.0.0
```

#### Local Build for Current Platform
```bash
# Package the application
npm run package

# Create distributable
npm run make
```

#### Platform-Specific Builds
```bash
# macOS (DMG)
npm run make -- --platform=darwin

# Windows (EXE installer)
npm run make -- --platform=win32

# Linux (DEB/RPM)
npm run make -- --platform=linux
```

## Output Files

After building, find distributables in:
- `out/make/zip/` - ZIP archives
- `out/make/dmg/` - macOS DMG files
- `out/make/squirrel.windows/` - Windows installers
- `out/make/deb/` - Debian packages
- `out/make/rpm/` - RPM packages

## Code Signing

### macOS
- Requires Apple Developer ID certificate
- Set environment variables:
  - `APPLE_IDENTITY`
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`

### Windows
- Requires code signing certificate
- Set environment variables:
  - `WINDOWS_CERT_FILE`
  - `WINDOWS_CERT_PASSWORD`

## Publishing to Platforms

### GitHub Releases
Automated via GitHub Actions when you push a version tag.

### Direct Website Download
1. Upload distributables to your web server
2. Provide download links for each platform
3. Include installation instructions

### Auto-Updates
1. Set `UPDATE_SERVER_URL` in environment
2. Upload `latest.json` with release metadata
3. The app will check for updates automatically

## Platform-Specific Notes

### macOS
- Users may need to right-click and select "Open" on first launch
- Notarization required for smooth installation
- Universal binary supports both Intel and Apple Silicon

### Windows
- SmartScreen may warn about unsigned apps
- Installer handles all dependencies
- Creates Start Menu shortcuts

### Linux
- DEB for Ubuntu/Debian systems
- RPM for Fedora/RHEL systems
- AppImage for universal compatibility (future)

## Testing Distribution

Before releasing:
1. Test installation on clean systems
2. Verify auto-update mechanism
3. Check code signing (no security warnings)
4. Test all core features after installation

## Support

For distribution issues:
- Check GitHub Actions logs for build errors
- Verify all environment variables are set
- Ensure certificates are valid and not expired