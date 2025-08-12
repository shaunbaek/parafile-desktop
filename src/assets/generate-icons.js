const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Icon sizes needed for different platforms
const iconSizes = {
  mac: [16, 32, 64, 128, 256, 512, 1024],
  windows: [16, 24, 32, 48, 64, 128, 256],
  linux: [16, 24, 32, 48, 64, 128, 256, 512]
};

async function generateIcons() {
  console.log('Generating application icons...');
  
  const sourceIcon = path.join(__dirname, 'icon.png');
  const iconsDir = path.join(__dirname, 'icons');
  
  try {
    // Create icons directory
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
      console.log('Created icons directory');
    }
    
    // Check if source icon exists
    if (!fs.existsSync(sourceIcon)) {
      console.error('Source icon not found at:', sourceIcon);
      console.log('Creating a default icon...');
      await createDefaultIcon(sourceIcon);
    }
    
    // Verify source icon exists after potential creation
    if (!fs.existsSync(sourceIcon)) {
      console.error('Could not create or find source icon. Exiting.');
      process.exit(0); // Exit gracefully instead of failing
    }
  } catch (error) {
    console.error('Error setting up icon generation:', error);
    process.exit(0); // Exit gracefully
  }
  
  try {
    // Generate PNG files for all sizes
    console.log('Generating PNG files...');
    const allSizes = [...new Set([...iconSizes.mac, ...iconSizes.windows, ...iconSizes.linux])];
    
    for (const size of allSizes) {
      const outputFile = path.join(iconsDir, `icon_${size}x${size}.png`);
      try {
        // Try sips first (macOS)
        await execAsync(`sips -z ${size} ${size} "${sourceIcon}" --out "${outputFile}"`);
        console.log(`Created ${size}x${size} icon using sips`);
      } catch (error) {
        try {
          // Fallback to ImageMagick (Linux/Windows)
          await execAsync(`convert "${sourceIcon}" -resize ${size}x${size} "${outputFile}"`);
          console.log(`Created ${size}x${size} icon using ImageMagick`);
        } catch (error2) {
          console.log(`Failed to create ${size}x${size} icon:`, error2.message);
        }
      }
    }
    
    // Generate Windows ICO file
    console.log('Generating Windows ICO file...');
    const icoFile = path.join(__dirname, 'icon.ico');
    
    // Try different methods for ICO generation
    try {
      // Try ImageMagick first (available on most CI systems)
      const icoInputs = iconSizes.windows.map(size => 
        path.join(iconsDir, `icon_${size}x${size}.png`)
      ).filter(file => fs.existsSync(file));
      
      if (icoInputs.length > 0) {
        await execAsync(`convert ${icoInputs.join(' ')} "${icoFile}"`);
        console.log('Created icon.ico using ImageMagick');
      } else {
        throw new Error('No input files found for ICO generation');
      }
    } catch (error) {
      try {
        // Fallback to png2ico if available
        const icoInputs = iconSizes.windows.map(size => 
          path.join(iconsDir, `icon_${size}x${size}.png`)
        ).filter(file => fs.existsSync(file)).join(' ');
        
        await execAsync(`png2ico "${icoFile}" ${icoInputs}`);
        console.log('Created icon.ico using png2ico');
      } catch (error2) {
        console.log('Could not generate icon.ico. Trying to copy existing PNG...');
        // Use the largest PNG as fallback
        const fallback = path.join(iconsDir, 'icon_256x256.png');
        if (fs.existsSync(fallback)) {
          fs.copyFileSync(fallback, icoFile);
          console.log('Copied PNG as ICO fallback');
        }
      }
    }
    
    // Generate macOS ICNS file
    console.log('Generating macOS ICNS file...');
    const icnsFile = path.join(__dirname, 'icon.icns');
    const iconsetDir = path.join(iconsDir, 'icon.iconset');
    
    if (!fs.existsSync(iconsetDir)) {
      fs.mkdirSync(iconsetDir, { recursive: true });
    }
    
    // Copy and rename files for iconset
    const icnsMapping = {
      16: 'icon_16x16.png',
      32: 'icon_16x16@2x.png',
      32: 'icon_32x32.png',
      64: 'icon_32x32@2x.png',
      128: 'icon_128x128.png',
      256: 'icon_128x128@2x.png',
      256: 'icon_256x256.png',
      512: 'icon_256x256@2x.png',
      512: 'icon_512x512.png',
      1024: 'icon_512x512@2x.png'
    };
    
    for (const [size, filename] of Object.entries(icnsMapping)) {
      const source = path.join(iconsDir, `icon_${size}x${size}.png`);
      const dest = path.join(iconsetDir, filename);
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, dest);
      }
    }
    
    // Generate ICNS file
    await execAsync(`iconutil -c icns "${iconsetDir}" -o "${icnsFile}"`);
    console.log('Created icon.icns');
    
    // Create DMG background
    console.log('Creating DMG background...');
    await createDMGBackground();
    
    console.log('Icon generation complete!');
    
  } catch (error) {
    console.error('Error generating icons:', error);
    console.log('Make sure you have the necessary tools installed.');
  }
}

async function createDefaultIcon(outputPath) {
  // Create a simple default icon using canvas
  const canvas = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#448649;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2d5a2f;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="10" stdDeviation="20" flood-opacity="0.2"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1024" height="1024" fill="#FBFDFB"/>
  
  <!-- Main circle with gradient -->
  <circle cx="512" cy="512" r="450" fill="url(#bg)" filter="url(#shadow)"/>
  
  <!-- Document icon -->
  <g transform="translate(512, 512)">
    <!-- Document body -->
    <rect x="-200" y="-280" width="400" height="560" rx="20" fill="#FBFDFB"/>
    
    <!-- Document fold -->
    <path d="M 100 -280 L 200 -180 L 200 -280 Z" fill="#e8ebe8"/>
    
    <!-- Lines representing text -->
    <rect x="-150" y="-180" width="250" height="20" rx="10" fill="#448649" opacity="0.8"/>
    <rect x="-150" y="-120" width="300" height="20" rx="10" fill="#448649" opacity="0.6"/>
    <rect x="-150" y="-60" width="200" height="20" rx="10" fill="#448649" opacity="0.6"/>
    
    <!-- AI spark -->
    <g transform="translate(0, 80)">
      <path d="M -40 0 L -20 -30 L 0 0 L 20 -30 L 40 0" 
            stroke="#448649" stroke-width="12" fill="none" 
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="-20" cy="-30" r="8" fill="#448649"/>
      <circle cx="20" cy="-30" r="8" fill="#448649"/>
    </g>
  </g>
</svg>`;
  
  // Save SVG first
  const svgPath = outputPath.replace('.png', '.svg');
  fs.writeFileSync(svgPath, canvas);
  
  // Convert to PNG 
  try {
    // Try sips first (macOS)
    await execAsync(`sips -s format png "${svgPath}" --out "${outputPath}" --resampleHeightWidthMax 1024`);
    console.log('Created default icon using sips');
  } catch (error) {
    try {
      // Fallback to ImageMagick
      await execAsync(`convert "${svgPath}" -resize 1024x1024 "${outputPath}"`);
      console.log('Created default icon using ImageMagick');
    } catch (error2) {
      console.log('Could not convert SVG to PNG. Please install ImageMagick or create icon.png manually.');
      console.log('Error:', error2.message);
    }
  }
}

async function createDMGBackground() {
  const dmgBg = `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FBFDFB;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f0f3f0;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="800" height="600" fill="url(#bgGrad)"/>
  
  <!-- Subtle pattern -->
  <g opacity="0.05">
    <pattern id="pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
      <circle cx="50" cy="50" r="40" fill="#448649"/>
    </pattern>
    <rect width="800" height="600" fill="url(#pattern)"/>
  </g>
  
  <!-- Title -->
  <text x="400" y="100" font-family="Arial, sans-serif" font-size="36" 
        font-weight="bold" text-anchor="middle" fill="#448649">
    ParaFile Desktop
  </text>
  
  <!-- Subtitle -->
  <text x="400" y="140" font-family="Arial, sans-serif" font-size="18" 
        text-anchor="middle" fill="#666">
    AI-powered document organization
  </text>
  
  <!-- Arrow -->
  <g transform="translate(400, 350)">
    <path d="M -100 0 L 100 0" stroke="#448649" stroke-width="4" 
          marker-end="url(#arrowhead)" opacity="0.5"/>
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="10" 
              refX="9" refY="3" orient="auto" fill="#448649">
        <polygon points="0 0, 10 3, 0 6"/>
      </marker>
    </defs>
  </g>
  
  <!-- Instructions -->
  <text x="192" y="500" font-family="Arial, sans-serif" font-size="16" 
        text-anchor="middle" fill="#666">
    Drag to Applications
  </text>
</svg>`;
  
  const outputPath = path.join(__dirname, 'dmg-background.png');
  const svgPath = outputPath.replace('.png', '.svg');
  
  fs.writeFileSync(svgPath, dmgBg);
  
  try {
    // Try sips first (macOS)
    await execAsync(`sips -s format png "${svgPath}" --out "${outputPath}" --resampleHeightWidthMax 800`);
    console.log('Created DMG background using sips');
  } catch (error) {
    try {
      // Fallback to ImageMagick
      await execAsync(`convert "${svgPath}" -resize 800x600 "${outputPath}"`);
      console.log('Created DMG background using ImageMagick');
    } catch (error2) {
      console.log('Could not create DMG background:', error2.message);
    }
  }
}

// Create a proper tray icon
async function createTrayIcon() {
  console.log('Creating tray icon...');
  
  const trayIconSVG = `
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <!-- Document icon in black for template -->
  <rect x="3" y="2" width="8" height="11" fill="black"/>
  <!-- Document fold -->
  <path d="M 11 2 L 13 4 L 11 4 Z" fill="black"/>
  <!-- Text lines -->
  <rect x="5" y="5" width="4" height="1" fill="white"/>
  <rect x="5" y="7" width="5" height="1" fill="white"/>
  <rect x="5" y="9" width="3" height="1" fill="white"/>
</svg>`;
  
  const trayIconPath = path.join(__dirname, 'tray-icon.svg');
  const trayIconPngPath = path.join(__dirname, 'tray-icon.png');
  
  // Save SVG
  fs.writeFileSync(trayIconPath, trayIconSVG);
  
  // Convert to PNG
  try {
    // Try sips first (macOS)
    await execAsync(`sips -s format png "${trayIconPath}" --out "${trayIconPngPath}" --resampleHeightWidthMax 16`);
    console.log('Created tray icon using sips');
  } catch (error) {
    try {
      // Fallback to ImageMagick
      await execAsync(`convert "${trayIconPath}" -resize 16x16 "${trayIconPngPath}"`);
      console.log('Created tray icon using ImageMagick');
    } catch (error2) {
      console.log('Could not create tray icon:', error2.message);
      // Copy a fallback icon
      const fallback = path.join(__dirname, 'icons/icon_16x16.png');
      if (fs.existsSync(fallback)) {
        fs.copyFileSync(fallback, trayIconPngPath);
        console.log('Used fallback icon for tray');
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  generateIcons().then(() => {
    return createTrayIcon();
  }).catch(console.error);
}

module.exports = { generateIcons, createTrayIcon };