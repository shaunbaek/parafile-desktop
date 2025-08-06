# ParaFile Desktop

Document organization app that watches folders and automatically renames/organizes PDF and Word files using AI.

## Installation

```bash
git clone https://github.com/shaunbaek/parafile-desktop.git
cd parafile-desktop
npm ci
npm start
```

## Setup

1. First launch shows welcome screen
2. Go to Settings → Add your OpenAI API key → Test Connection → Save
3. Select a folder to monitor
4. Click "Start Monitoring"

## How It Works

ParaFile watches your selected folder (and all subfolders) for new PDF and Word documents. When it finds one:

1. Extracts the text content
2. Sends text to OpenAI to figure out what kind of document it is
3. Renames the file based on your naming patterns
4. Moves it to a category subfolder (if organization is enabled)

## Categories

Categories are how ParaFile decides where to put files.

**Add a category:**
- Click Categories → Add Category
- Name: What to call this category (like "Invoices")
- Description: Tell the AI what belongs here (like "Bills, invoices, payment requests")
- Naming Pattern: How to rename files (like `{date}_{vendor}_{amount}`)

**Default category:**
- "General" category can't be deleted
- Files go here if they don't match other categories

## Variables

Variables are pieces of info ParaFile extracts from documents to use in filenames.

**Add a variable:**
- Click Variables → Add Variable
- Name: Variable name (like "invoice_date")
- Description: What to extract (like "The invoice date in YYYY-MM-DD format")

**Built-in variable:**
- `{original_name}` - Always available, can't be deleted

**AI Suggest:**
- Type what you want in plain English
- AI generates the variable name and description
- Example: "get the total amount from invoices" → creates `invoice_total` variable

## Features & Quirks

**Background operation:**
- Close window → minimizes to system tray
- Global shortcut: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Right-click tray icon for menu

**Processing log:**
- Click "Open Processing Log" to see all processed files
- Shows: original name, new name, category, AI's reasoning
- Click any row to fix wrong categorizations

**Drag and drop:**
- Drop PDF/Word files directly onto the app window
- Processes immediately, even if monitoring is stopped

**Expertise modes:**
- General: Regular documents
- Legal: Better at legal documents (contracts, pleadings, etc.)

**File handling:**
- Only processes truly new files
- Ignores files it already moved
- Waits if file is still being written
- Skips password-protected files

## Command Line Mode

Run without GUI:
```bash
npm run monitor
```

Useful for running on servers or in background. Requires initial GUI setup for API key.

## Settings

**Location of config file:**
- Mac: `~/Library/Application Support/parafile-desktop/config.json`
- Windows: `%APPDATA%\parafile-desktop\config.json`
- Linux: `~/.config/parafile-desktop/config.json`

**What's in the config:**
- Your API key
- Watched folder path
- Categories and variables
- Organization on/off
- Expertise mode

## Building

```bash
# Package the app
npm run package

# Create installer (DMG on Mac, EXE on Windows)
npm run make

# Publish to GitHub releases
npm run publish
```

## Limitations

- Only PDF and Word files (.pdf, .doc, .docx)
- Needs text in documents (scanned images without OCR won't work)
- One file at a time processing
- Max 4000 characters sent to AI per document

## Tips

- Make category descriptions specific - "Invoices from vendors" works better than "money stuff"
- Test variables on a few documents first
- Check the processing log regularly
- Original files are preserved (ParaFile makes copies when organizing)

## Common Issues

**Nothing happening:**
- Check monitoring is started (button should say "Stop Monitoring")
- Make sure you're adding PDF or Word files
- Look at the processing log for errors

**Wrong categorization:**
- Make category descriptions more specific
- Add more examples to variable descriptions
- Use the correction feature in processing log

**Can't start:**
- Delete `node_modules` folder and run `npm ci` again
- Make sure Node.js version 16+

**API errors:**
- Check your OpenAI API key is valid
- Make sure you have GPT-4 access
- Watch your API usage limits