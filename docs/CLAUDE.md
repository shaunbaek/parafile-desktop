# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ParaFile Desktop is an AI-powered document organization and renaming application built with Electron. It monitors folders for PDF and Word documents, uses OpenAI's GPT API to analyze content, and automatically categorizes and renames files based on user-defined rules.

## Development Commands

- **Start the GUI application**: `npm start`
- **Run monitoring service (CLI mode)**: `npm run monitor`
- **Package the application**: `npm run package`
- **Create distributables**: `npm run make`
- **Publish the application**: `npm run publish`

## Environment Setup

1. Copy `.env.example` to `.env`
2. Add your OpenAI API key: `OPENAI_API_KEY=your_api_key_here`
3. Run `npm install` to install dependencies

## Architecture

### Main Process (`src/index.js`)
- Handles GUI window creation and IPC communication
- Integrates all services (config, monitoring, processing)
- Supports command-line mode with `npm run monitor`
- Manages file monitoring events and document processing

### Services Layer
- **Configuration Manager** (`src/config/configManager.js`): Manages user settings, categories, and variables
- **File Monitor** (`src/services/fileMonitor.js`): Watches folders using chokidar with file locking detection
- **Text Extractor** (`src/services/textExtractor.js`): Extracts text from PDF (pdf-parse) and Word (mammoth) files
- **AI Service** (`src/services/aiService.js`): Integrates with OpenAI for document categorization and variable extraction
- **Document Processor** (`src/services/documentProcessor.js`): Orchestrates the full processing pipeline
- **File Organizer** (`src/services/fileOrganizer.js`): Handles file moving and renaming with conflict resolution

### UI Components
- **HTML Interface** (`src/index.html`): Modern responsive design with modals for category/variable management
- **Renderer Script** (`src/renderer.js`): Handles UI interactions and IPC communication
- **Styles** (`src/index.css`): Clean, modern CSS with animations and responsive design

### Key Dependencies
- **chokidar**: File system monitoring
- **pdf-parse**: PDF text extraction
- **mammoth**: Word document text extraction
- **openai**: OpenAI API integration
- **dotenv**: Environment variable management

## Configuration Structure

Configuration is stored in JSON format at `app.getPath('userData')/config.json`:

```json
{
  "watched_folder": "/path/to/monitor",
  "enable_organization": true,
  "categories": [
    {
      "name": "CategoryName",
      "description": "AI-readable description",
      "naming_pattern": "{variable1}_{variable2}"
    }
  ],
  "variables": [
    {
      "name": "variable_name",
      "description": "What to extract from documents"
    }
  ]
}
```

## AI Integration

- Uses GPT-4 Turbo for document analysis
- Structured JSON responses for reliable parsing
- Categorization based on document content and user-defined categories
- Variable extraction for dynamic filename generation
- Fallback mechanisms for API failures

## Error Handling

- **Retry Logic**: 3 attempts with 2-second delays for file access
- **Graceful Degradation**: Falls back to "General" category on AI failures
- **File Locking**: Handles files being written by other applications
- **API Failures**: Continues processing with fallback values

## Command-Line Interface

- **GUI Mode**: `npm start` (default)
- **Monitor Mode**: `npm run monitor` (headless background service)

## Background Operation

The application runs naturally in the background like Slack or Teams:

### System Tray Integration
- **Tray Icon**: Always visible in system tray when running
- **Click to Toggle**: Single-click tray icon to show/hide main window
- **Context Menu**: Right-click for quick actions (start/stop monitoring, settings, quit)
- **Status Display**: Shows monitoring status and watched folder in tray menu

### Window Management
- **Close to Tray**: Closing the window minimizes to tray instead of quitting
- **Auto-Hide**: App automatically hides to tray when not needed
- **Focus Management**: Proper window focusing when restored from tray

### Background Features
- **Auto-Launch**: Optional startup with system login
- **Silent Monitoring**: Continues processing files when window is hidden
- **System Notifications**: Native OS notifications for processed files when in background
- **Persistent Operation**: Keeps running even when main window is closed

### User Preferences
- **Start at Login**: Toggle auto-launch with system startup
- **Start Minimized**: Option to start directly to tray
- **Organization Mode**: Toggle file organization behavior

## Important Notes

- Protected categories: "General" cannot be deleted
- Protected variables: "original_name" cannot be deleted
- Configuration auto-repair on corruption
- Atomic file operations to prevent data loss
- DevTools disabled in production builds
- System tray functionality requires platform-specific icons
- Background processing continues regardless of window visibility