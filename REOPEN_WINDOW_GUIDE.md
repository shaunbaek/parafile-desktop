# How to Reopen ParaFile Window

If the ParaFile window doesn't reopen when you click the tray icon, here are multiple ways to access it:

## Method 1: System Tray Icon
- **Location**: Look for the ParaFile icon in your system tray
  - **Windows**: Bottom-right corner, may be hidden behind the "^" arrow
  - **macOS**: Top-right corner in the menu bar
- **Single-click** the icon to show/hide the window
- **Right-click** the icon and select "Open ParaFile"

## Method 2: Global Keyboard Shortcut
- Press **Ctrl+Shift+P** (Windows/Linux) or **Cmd+Shift+P** (macOS)
- This works from anywhere in your system

## Method 3: Right-Click Context Menu
- **Right-click** the tray icon
- Select **"Open ParaFile"** from the menu
- This should always work even if clicking doesn't

## Method 4: Command Line
```bash
# Navigate to the app directory and run:
npm start
```
This will show the existing window or create a new one.

## Method 5: Task Manager/Activity Monitor
1. Open Task Manager (Windows) or Activity Monitor (macOS)
2. Find "ParaFile" or "electron" process
3. Right-click and select "Bring to Front" or similar option

## Troubleshooting

### If tray icon is not visible:
1. **Windows**: Click the "^" arrow in system tray to show hidden icons
2. **macOS**: The icon might be in the overflow area if menu bar is crowded
3. Check if the app is actually running in Task Manager/Activity Monitor

### If clicking tray icon doesn't work:
1. Try **right-clicking** instead of left-clicking
2. Use the **keyboard shortcut** (Ctrl+Shift+P / Cmd+Shift+P)
3. Select "Open ParaFile" from the right-click menu

### Debug Mode:
1. Close ParaFile completely
2. Open terminal/command prompt
3. Navigate to ParaFile directory
4. Run: `npm start`
5. Check console for any error messages

## Contact Support
If none of these methods work, the issue might be platform-specific. Please provide:
- Your operating system (Windows/macOS/Linux)
- Any error messages in the console
- Whether you can see the tray icon at all