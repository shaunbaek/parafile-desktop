# Changelog

All notable changes to ParaFile Desktop will be documented in this file.

## [1.0.0] - 2025-07-29

### Added
- Initial release of ParaFile Desktop
- AI-powered document organization using OpenAI GPT-4
- Automatic PDF and Word document monitoring
- Smart file renaming with customizable patterns
- Modern glassmorphism UI with forest green color scheme
- System tray integration with background operation
- Auto-launch functionality
- Drag-and-drop file processing
- Real-time notifications
- CLI monitoring mode
- Global keyboard shortcut (Ctrl+Shift+P / Cmd+Shift+P)

### Features
- **Document Processing**: Supports PDF (.pdf) and Word (.doc, .docx) documents
- **AI Categorization**: Uses OpenAI GPT-4 for intelligent document categorization
- **Variable Extraction**: Extracts custom variables from documents for renaming
- **File Organization**: Organizes files into category subfolders
- **Background Monitoring**: Runs in system tray like Slack/Teams
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Robust Error Handling**: Handles file locks, API failures, and corrupted files
- **One-time Onboarding**: Welcome screen only shows on first launch

### Technical Details
- Built with Electron and Node.js
- Uses Chokidar for file system monitoring
- PDF text extraction with pdf-parse
- Word document processing with mammoth
- OpenAI API integration with structured responses
- Configuration stored in user data directory
- Persistent settings and preferences

### Dependencies
- electron: 37.2.4
- chokidar: ^3.6.0
- pdf-parse: ^1.1.1
- mammoth: ^1.8.0
- openai: ^4.85.0
- dotenv: ^16.4.7
- auto-launch: ^5.0.6
- electron-squirrel-startup: ^1.0.1