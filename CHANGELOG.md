# Changelog

All notable changes to ParaFile Desktop will be documented in this file.

## [Unreleased] - 2025-07-30

### Added
- **AI-Powered Variable Generation**: Users can now generate variable names and descriptions using AI
  - Added "AI Suggest" button in the Add Variable modal
  - New AI Variable Suggestion modal for natural language input
  - Integration with OpenAI API to generate appropriate variable names and descriptions
  - One-click application of AI suggestions to the variable form

- **Enhanced Variable Description Evaluation**: AI now evaluates variable descriptions for adequacy
  - Loading modal appears during evaluation process
  - Comprehensive legal document guidelines included in AI evaluation
  - Suggestion modal with two options: "Keep Original" or "Save Edited"
  - Enhanced evaluation includes legal document patterns and terminology

- **Smart Variable Display System**: Variables now show concise summaries with detailed popups
  - AI-generated short descriptions (3-5 words) for easy scanning
  - Clickable variable items to view full details in popup modal
  - Variable Details modal shows name, short description, and full description
  - Entire variable box is clickable with hover effects

- **Simplified System Integration**: Streamlined tray behavior settings
  - Removed auto-launch functionality
  - Added "Keep running in background when window is closed" toggle
  - X button behavior based on user preference (minimize to tray vs quit)

### Fixed
- **Onboarding Screen Issue**: Fixed welcome screen repeatedly showing after API key configuration
  - Welcome screen now only shows when API key is missing (not when folder is missing)
  - Onboarding completes automatically once API key is configured
  - Proper persistence of onboarding completion state

- **Categories and Variables Loading**: Fixed loading state issues
  - Added safety checks for config loading
  - Proper rendering order to prevent stuck loading states
  - Force re-render after UI state changes

### Technical Changes

#### Frontend (UI)
- **src/index.html**:
  - Added AI Suggest button to Variable modal (line 210)
  - Created AI Variable Suggestion modal (lines 296-331)
  - Added Description Suggestion modal with issue analysis (lines 333-374)
  - Created Variable Details popup modal (lines 364-393)
  - Added Loading modal for AI operations (lines 395-405)
  - Simplified system integration settings (lines 260-275)
  - Removed redundant close button from Variable Details modal

#### Frontend (Logic)
- **src/renderer.js**:
  - Added AI Suggest button click handler (lines 174-180)
  - Implemented AI suggestion form submission (lines 569-605)
  - Added variable description evaluation with loading state (lines 544-567)
  - Created `showDescriptionSuggestion()` function (lines 752-768)
  - Added `showVariableDetails()` function for popup (lines 764-774)
  - Updated `renderVariables()` to show short descriptions and make entire item clickable (lines 392-409)
  - Enhanced `saveVariable()` to generate short descriptions at final step (lines 723-751)
  - Added loading modal helpers (lines 771-774)
  - Updated settings handling for minimize to tray preference (lines 658-681)
  - Fixed onboarding logic to check only API key presence (lines 25-47)

#### Backend
- **src/services/aiService.js**:
  - Added `generateVariableSuggestion()` method (lines 149-184)
  - Added `evaluateVariableDescription()` method with legal document expertise (lines 223-265)
  - Added `generateShortDescription()` method for final step generation (lines 186-221)
  - Enhanced evaluation prompts with comprehensive legal document guidelines
  - Includes patterns for contracts, leases, court documents, corporate documents
  - Addresses legal terminology variations and formatting conventions

- **src/index.js**:
  - Imported aiService module (line 9)
  - Added IPC handler `api:generateVariable` (lines 392-408)
  - Added IPC handler `api:evaluateDescription` (lines 410-426)
  - Added IPC handler `api:generateShortDescription` (lines 428-444)
  - Updated window close behavior to check minimize preference (lines 47-61)
  - Removed auto-launch related code and imports

#### Styling
- **src/index.css**:
  - Added hover effects for clickable variable items (lines 486-490)
  - Enhanced list item interactivity with smooth transitions

### User Experience Improvements

#### Variable Management
1. **AI-Assisted Creation**: Natural language input generates appropriate variable names and descriptions
2. **Smart Evaluation**: AI analyzes descriptions for legal document processing adequacy
3. **Loading Feedback**: Clear loading states during AI operations
4. **Simplified Display**: Concise short descriptions with detailed popup on click
5. **Enhanced Interaction**: Entire variable boxes are clickable with visual feedback

#### Legal Document Support
1. **Comprehensive Guidelines**: AI evaluation includes extensive legal document patterns
2. **Document Type Awareness**: Specific patterns for contracts, leases, court documents
3. **Legal Terminology**: Handles variations in legal terms and formatting
4. **Jurisdictional Considerations**: Accounts for different legal document standards

#### System Integration
1. **Simplified Settings**: Removed complex auto-launch options
2. **Intuitive Tray Behavior**: Single toggle for background operation
3. **User Control**: X button behavior matches user preference

### Workflow Changes
1. **Variable Creation Flow**:
   - User creates variable → AI evaluates description → User finalizes → AI generates short description → Save
2. **Description Evaluation**:
   - Loading modal during evaluation → Issues displayed if found → User can keep original or save edited version
3. **Variable Display**:
   - Short descriptions shown in list → Click anywhere for full details popup → Clean modal without redundant buttons

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