# ParaFile Desktop

An AI-powered document organization and renaming application that automatically categorizes and renames PDF and Word documents using OpenAI's GPT API.

## Features

- **AI-Powered Document Organization**: Uses OpenAI GPT-4 to intelligently categorize and rename documents
- **Modern Glassmorphism UI**: Beautiful, intuitive interface with forest green color scheme
- **Background Operation**: Runs in system tray like Slack/Teams with global shortcuts
- **Guided Setup**: Step-by-step onboarding that ensures proper configuration
- **Built-in Settings**: Configure OpenAI API key and test connection directly in the app
- **Recursive File Monitoring**: Watches folders and ALL subdirectories for PDF and Word documents
- **Custom Categories & Variables**: Define your own organization rules and naming patterns
- **Drag & Drop Processing**: Instant document processing with visual feedback
- **Auto-Launch Support**: Start with your system and run in background
- **Command-Line Mode**: Headless monitoring service for automated workflows
- **Robust Error Handling**: Handles file locks, API failures, and corrupted documents gracefully

## Quick Start

### 1. Installation

```bash
# Clone or download the project
npm install
```

### 2. First Launch & Setup

```bash
# Start the application
npm start
```

**Guided Setup Process:**
1. **Configure OpenAI API Key** - Set up your API key with built-in connection testing
2. **Select Monitor Folder** - Choose a folder to monitor (includes ALL subdirectories automatically)
3. **Customize Categories** (Optional) - Add categories with descriptions for AI understanding
4. **Define Variables** (Optional) - Create variables for custom filename patterns

**No .env file needed!** - All configuration is done through the modern UI.

### 3. Start Monitoring

Click "Start Monitoring" in the GUI (API key is automatically validated), or run the CLI version:

```bash
# Run headless monitoring service (requires prior GUI setup)
npm run monitor
```

### 4. Background Operation

**System Tray Integration:**
- Close window to minimize to system tray
- Right-click tray icon for quick controls
- Global shortcut: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
- Auto-launch option available in settings

## Example Configuration

### Categories
- **Invoices**: "Financial invoices, bills, and payment documents"
  - Pattern: `{date}_{vendor}_{invoice_number}`
- **Contracts**: "Legal agreements, contracts, and terms of service"
  - Pattern: `{contract_type}_{party_name}_{date}`
- **Reports**: "Business reports, analytics, and summaries"
  - Pattern: `{report_type}_{period}_{department}`

### Variables
- **date**: "Extract the main date from the document (format: YYYY-MM-DD)"
- **vendor**: "Extract the vendor or company name"
- **client_name**: "Extract the client or customer name"
- **document_type**: "Identify the type of document (invoice, contract, report, etc.)"

## How It Works

1. **Recursive File Detection**: Monitors your selected folder and ALL subdirectories for new PDF and Word documents
2. **Text Extraction**: Extracts text content from documents at any depth level
3. **AI Analysis**: Sends text to OpenAI GPT-4 for categorization and variable extraction
4. **File Organization**: Renames and optionally moves files to category subfolders
5. **Error Recovery**: Handles failures gracefully with retry logic and fallbacks

### Monitoring Scope
When you select a folder like `/Documents/MyWork/`, ParaFile automatically monitors:
- **Root level**: `/Documents/MyWork/report.pdf`
- **Subdirectories**: `/Documents/MyWork/2024/invoice.pdf`
- **Deep nesting**: `/Documents/MyWork/Projects/ClientA/Contracts/agreement.pdf`
- **Any depth**: No limit on folder hierarchy levels

## Requirements

- **Node.js** 16 or higher
- **OpenAI API Key** with GPT-4 access (configured through the app's Settings)
- **Operating System**: Windows, macOS, or Linux

## Commands

- `npm start` - Launch GUI application
- `npm run monitor` - Run headless monitoring service
- `npm run package` - Package for distribution
- `npm run make` - Create installers

## Configuration File

Settings are stored in your user data directory:
- **Windows**: `%APPDATA%/parafile-desktop/config.json`
- **macOS**: `~/Library/Application Support/parafile-desktop/config.json`
- **Linux**: `~/.config/parafile-desktop/config.json`

## Troubleshooting

### Common Issues

1. **"Cannot start monitoring" errors**
   - Use the built-in API key tester in Settings to verify your key
   - Ensure you have API credits remaining on your OpenAI account
   - Check your internet connection

2. **Files not being processed**
   - Check that the folder path is correct and accessible
   - Ensure files are PDF or Word documents (.pdf, .docx, .doc)
   - Verify the monitoring service is running (green status dot)
   - Check if API key validation is passing
   - Remember: ParaFile monitors ALL subdirectories, so files in nested folders should be detected

3. **Tray icon not working**
   - Try the global shortcut: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
   - Right-click tray icon and select "Open ParaFile"
   - Restart the application if the tray icon is missing

### File Processing Errors

The application handles various edge cases:
- **File locks**: Retries with delays if files are being used
- **Corrupted documents**: Skips invalid files and continues
- **API failures**: Falls back to "General" category
- **Network issues**: Retries API calls with exponential backoff

## Building and Distribution

### Development
```bash
npm start
```

### Package for Distribution
```bash
npm run package
```

### Create Installers
```bash
npm run make
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please check the application logs and ensure your OpenAI API key is properly configured.