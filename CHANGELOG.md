# Changelog

All notable changes to ParaFile Desktop will be documented in this file.

## [Unreleased] - 2025-07-30

### Added
- **AI-Powered Variable Generation**: Users can now generate variable names and descriptions using AI
  - Added "AI Suggest" button in the Add Variable modal
  - New AI Variable Suggestion modal for natural language input
  - Integration with OpenAI API to generate appropriate variable names and descriptions
  - One-click application of AI suggestions to the variable form

### Fixed
- **Onboarding Screen Issue**: Fixed welcome screen repeatedly showing after API key configuration
  - Welcome screen now only shows when API key is missing (not when folder is missing)
  - Onboarding completes automatically once API key is configured
  - Proper persistence of onboarding completion state

### Technical Changes

#### Frontend (UI)
- **src/index.html**:
  - Added AI Suggest button to Variable modal (line 210)
  - Created new AI Variable Suggestion modal (lines 296-331)
  - Button positioned absolutely within variable name input field

#### Frontend (Logic)
- **src/renderer.js**:
  - Added AI Suggest button click handler (lines 174-180)
  - Implemented AI suggestion form submission (lines 561-597)
  - Added "Use This Suggestion" functionality (lines 600-614)
  - Fixed onboarding logic to check only API key presence (lines 23-27)
  - Updated onboarding completion to trigger on API key configuration (lines 95-101)

#### Backend
- **src/services/aiService.js**:
  - Added `generateVariableSuggestion()` method (lines 149-184)
  - Uses GPT-4 Turbo to generate variable names and descriptions
  - Returns JSON with machine-friendly variable name and clear description

- **src/index.js**:
  - Imported aiService module (line 10)
  - Added IPC handler `api:generateVariable` (lines 391-407)
  - Validates API key before making AI requests

### User Experience Improvements
1. Simplified variable creation process with AI assistance
2. Natural language input for describing desired variables
3. Automatic generation of proper variable names (lowercase with underscores)
4. Clear, AI-generated descriptions for consistent extraction
5. Seamless integration with existing variable management workflow

## [1.0.0] - 2025-07-29

### Added
- Initial release of ParaFile Desktop
- AI-powered document organization using OpenAI GPT-4
- Automatic PDF and Word document monitoring
- Smart file renaming with customizable patterns
- Modern glassmorphism UI with forest green color scheme (#448649, #DCDCDC, #F2E9DC, #FBFDFB, #232323)
- Libre Baskerville font integration for elegant typography
- System tray integration with background operation
- Auto-launch functionality
- Drag-and-drop file processing
- Real-time notifications
- CLI monitoring mode
- Global keyboard shortcut (Ctrl+Shift+P / Cmd+Shift+P)

### New Features in Final Release
- **Built-in Settings Panel**: Configure OpenAI API key directly in the app
- **API Key Validation**: Test connection before starting monitoring
- **Guided 2-Step Onboarding**: 
  1. Configure API key with connection testing
  2. Select folder to monitor
- **Enhanced Error Handling**: Specific error messages for API issues
- **One-time Welcome Screen**: Shows only on first launch, then never again
- **Pre-monitoring Validation**: Prevents starting without valid API key
- **Recursive Directory Monitoring**: Monitors ALL subdirectories with unlimited depth
- **Consolidated Settings**: Auto-launch and system preferences moved to Settings panel

### UI/UX Improvements
- **Modern Glassmorphism Design**: Translucent panels with backdrop blur
- **Forest Green Color Scheme**: Professional, eye-catching appearance
- **Animated Gradient Orbs**: Dynamic background elements
- **Smooth Transitions**: 300ms cubic-bezier animations throughout
- **Step-by-step Onboarding**: Clear progress indicators and guided setup
- **Real-time Status Updates**: Visual feedback for all operations
- **Tray Integration**: Multiple methods to reopen window (click, shortcut, menu)

### Technical Features
- **Document Processing**: Supports PDF (.pdf) and Word (.doc, .docx) documents
- **AI Categorization**: Uses OpenAI GPT-4 for intelligent document categorization
- **Variable Extraction**: Extracts custom variables from documents for renaming
- **File Organization**: Organizes files into category subfolders
- **Recursive Monitoring**: Watches entire directory trees with unlimited depth
- **Background Monitoring**: Runs in system tray like Slack/Teams
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Robust Error Handling**: Handles file locks, API failures, and corrupted files
- **Configuration Management**: Auto-repair and validation of config files
- **API Key Storage**: Secure local storage with in-app configuration

### System Integration
- **System Tray**: Comprehensive tray menu with monitoring controls
- **Auto-launch**: Start with system login option
- **Global Shortcuts**: Ctrl+Shift+P (Windows/Linux) or Cmd+Shift+P (macOS)
- **Background Operation**: Close to tray functionality
- **Native Notifications**: OS-level notifications when app is hidden

### Technical Implementation
- Built with Electron 37.2.4 and Node.js
- Uses Chokidar for reliable recursive file system monitoring
- Unlimited depth directory watching with `**/*` glob patterns
- PDF text extraction with pdf-parse
- Word document processing with mammoth
- OpenAI API integration with structured JSON responses
- Configuration stored in user data directory
- Persistent settings and preferences
- IPC communication for secure main/renderer separation
- Enhanced ignore patterns for better performance (.git, .DS_Store, etc.)

### Dependencies
- electron: 37.2.4
- chokidar: ^3.6.0
- pdf-parse: ^1.1.1
- mammoth: ^1.8.0
- openai: ^4.85.0
- dotenv: ^16.4.7 (legacy support)
- auto-launch: ^5.0.6
- electron-squirrel-startup: ^1.0.1

### Migration Notes
- **No .env file required**: All configuration moved to built-in settings
- **Automatic config migration**: Existing installations will migrate smoothly
- **Enhanced onboarding**: New users get guided setup experience
- **Recursive monitoring**: Now monitors all subdirectories automatically (no configuration needed)
- **Settings consolidation**: Auto-launch and system preferences moved to Settings panel