// This creates placeholder icons for the app
// In production, you would use proper designed icons

const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const iconSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#FBFDFB"/>
  <circle cx="256" cy="256" r="200" fill="#448649"/>
  <path d="M 200 200 L 312 200 L 312 250 L 200 250 Z" fill="#FBFDFB"/>
  <path d="M 200 270 L 312 270 L 312 290 L 200 290 Z" fill="#FBFDFB"/>
  <path d="M 200 310 L 280 310 L 280 330 L 200 330 Z" fill="#FBFDFB"/>
</svg>`;

// Create a simple tray icon SVG (16x16)
const trayIconSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <circle cx="8" cy="8" r="7" fill="#448649"/>
  <rect x="5" y="5" width="6" height="1" fill="#FBFDFB"/>
  <rect x="5" y="7" width="6" height="1" fill="#FBFDFB"/>
  <rect x="5" y="9" width="4" height="1" fill="#FBFDFB"/>
</svg>`;

// For now, save as SVG files
// In production, these would be converted to PNG files
fs.writeFileSync(path.join(__dirname, 'icon.svg'), iconSVG);
fs.writeFileSync(path.join(__dirname, 'tray-icon.svg'), trayIconSVG);

// Create placeholder PNG files (1x1 pixel)
const pngData = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
  0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
  0x54, 0x08, 0x5B, 0x63, 0x44, 0x86, 0x49, 0x44,
  0x00, 0x00, 0x02, 0x82, 0x01, 0x3F, 0x50, 0x5B,
  0x7C, 0xDE, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

fs.writeFileSync(path.join(__dirname, 'icon.png'), pngData);
fs.writeFileSync(path.join(__dirname, 'tray-icon.png'), pngData);

console.log('Created placeholder icons in src/assets/');
console.log('For production, replace these with proper icon files.');