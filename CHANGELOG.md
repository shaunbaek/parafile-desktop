# Changelog

All notable changes to ParaFile Desktop will be documented in this file.

## [Unreleased] - 2025-08-04

### Fixed
- **Missing Dependency**: Added `electron-log@^5.4.2` to dependencies to fix auto-updater service initialization error
  - Fixed `Error: Cannot find module 'electron-log'` in `src/services/autoUpdater.js:3`
  - Auto-updater service now initializes properly without module resolution errors
  
- **DMG Build Configuration**: Fixed appdmg build configuration in `forge.config.js`
  - Removed invalid `additionalDMGOptions` property that was causing `Error: data has additional properties`
  - DMG creation now works correctly with `npm run make` command
  - Maintained essential DMG properties: format, overwrite, and name

### Documentation Issues Identified
- **Environment Setup Inconsistency**: CLAUDE.md references `.env.example` file that doesn't exist
  - Only `.env.build.example` exists for build/signing environment variables
  - Need to create `.env.example` with `OPENAI_API_KEY=your_api_key_here` for development
  
- **README vs CLAUDE.md Conflict**: Contradictory environment setup instructions
  - README states "No .env file needed!" (GUI-first approach)
  - CLAUDE.md provides manual `.env` setup instructions (developer approach)
  - Need to reconcile these two approaches for clarity
  
- **AI Model Version Mismatch**: Documentation vs implementation discrepancy
  - Documentation claims "GPT-4 Turbo" in general terms
  - Code specifically uses `gpt-4-turbo-preview` model in all API calls
  - Should specify exact model version in documentation

### Deployment Testing
- ✅ Successfully packaged application for macOS (arm64)
- ✅ Created DMG installer (128MB) at `out/make/ParaFile Desktop.dmg`
- ✅ Verified packaged app launches independently without development dependencies
- ✅ Confirmed distribution files are properly generated (DMG, ZIP)
- ✅ All build commands working: `package`, `make`, `publish`

### Technical Details
#### Files Modified
- **package.json**: Added `electron-log@^5.4.2` dependency
- **forge.config.js**: Removed `additionalDMGOptions` from DMG maker configuration

#### Build Commands Verified
- `npm start` - Launch GUI application ✅
- `npm run monitor` - Run headless monitoring service ✅  
- `npm run package` - Package application ✅
- `npm run make` - Create distribution files (DMG, ZIP) ✅
- `npm run publish` - Publish to GitHub releases (configured) ✅

#### Architecture Verification
- All documented file paths and module locations are accurate
- Core dependencies match documentation specifications
- Configuration structure matches documented JSON format
- Service layer architecture aligns with documentation

## [Previous Release] - 2025-07-30

### Added - Processing Log System
- **Comprehensive Processing Log**: Added dedicated processing log window accessible via "📋 Open Processing Log" button
  - Separate log window (1400x800px) with detailed processing history table
  - Columns: Original Name, ParaFiled Name, Category, Reasoning, Date, Status
  - Real-time updates when new documents are processed or corrections are made
  - Processing status badges: Processed (blue), Failed (red), Corrected (green)

- **AI-Generated Categorization Reasoning**: Enhanced AI service to provide detailed explanations
  - 2-3 sentence explanations of why documents were categorized into specific categories
  - Key indicators and document characteristics analysis
  - Expertise-aware reasoning (General vs Legal document patterns)
  - Reasoning stored and displayed in processing log for transparency

- **Interactive Categorization Correction System**: Click any log row to fix categorization errors
  - Correction modal shows original file name, current category, and AI reasoning
  - Dropdown to select correct category from available options
  - Optional feedback field to explain why categorization was incorrect
  - Correction history tracking with timestamps and user feedback
  - Corrected entries visually distinguished in log with green highlighting

- **User File Movement Detection**: System now detects and logs when users manually move files
  - Distinguishes between ParaFile-moved files and user-moved files
  - Logs user moves as "User Moved" entries with location information
  - No reprocessing of user-moved files, only acknowledgment logging

- **Duplicate Processing Prevention**: Comprehensive system to prevent duplicate log entries
  - Smart file tracking by filename for 10-minute windows
  - Only processes files on 'add' events, ignoring 'change' events
  - Marks ParaFile-moved files to prevent recursive processing
  - Console logging for debugging file detection and processing decisions

### Technical Implementation - Processing Log

#### Backend Components
- **src/config/configManager.js**:
  - Added `loadLog()`, `saveLog()`, `addLogEntry()`, `clearLog()` methods (lines 160-253)
  - Log storage in `processing-log.json` with automatic 100-entry limit
  - Added `addLogCorrection()` method for tracking categorization fixes
  - Log entries include: ID, timestamp, file names, category, reasoning, success status, corrections array

- **src/services/fileMonitor.js**:
  - Enhanced with smart duplicate prevention system (lines 10-12, 81-129)
  - Added `processedFiles` and `parafileMovedFiles` tracking sets
  - Added `markFileAsMoved()` method to prevent recursive processing (lines 131-139)
  - Added `file-moved-by-user` event emission for user file movements (lines 96-105)
  - Only processes 'add' events, ignores 'change' events to prevent duplicates

- **src/services/fileOrganizer.js**:
  - Integrated with file monitor to mark moved files (lines 25-26)
  - Calls `fileMonitor.markFileAsMoved()` after successful file operations

- **src/services/aiService.js**:
  - Enhanced `categorizeDocument()` method with expertise parameter (line 20)
  - Updated to generate detailed reasoning (2-3 sentences) explaining categorization decisions (lines 39-40)
  - Expertise-aware prompts for General vs Legal document processing

#### Frontend Components
- **src/processing-log.html**: New dedicated log window interface
  - Full-featured log table with sorting and interaction capabilities
  - Correction modal integrated into log window
  - Refresh and clear log functionality
  - Responsive design matching main application styling

- **src/processing-log-renderer.js**: Complete log window functionality
  - Real-time log loading and rendering with status badges
  - Interactive row clicking for corrections
  - Modal handling for categorization corrections
  - IPC communication with main process for log operations

- **src/index.js**:
  - Added `createLogWindow()` function for separate log window (lines 67-96)
  - Added IPC handlers for log operations: `log:load`, `log:clear`, `log:addCorrection` (lines 478-502)
  - Added `window:openLog` handler to open log window (lines 499-502)
  - Enhanced file processing event handler to log results (lines 512-528)
  - Added `file-moved-by-user` event handler for user file movements (lines 578-606)

- **src/index.html**:
  - Replaced embedded log table with simple "Open Processing Log" button (lines 93-105)
  - Maintains clean main interface while providing easy access to detailed logs

- **src/renderer.js**:
  - Added event listener for "Open Processing Log" button (lines 90-93)
  - IPC communication to request log window opening

#### Styling and UX
- **src/index.css**:
  - Added log table styles with hover effects and transitions (lines 418-440)
  - Sticky table headers for better navigation in long logs
  - Smooth hover animations and visual feedback

### User Experience Improvements - Processing Log

#### Processing Transparency
1. **Detailed Reasoning**: Users can see exactly why AI categorized each document
2. **Processing History**: Complete audit trail of all document processing activities
3. **Error Correction**: Easy correction system for improving categorization accuracy
4. **User Action Tracking**: System acknowledges when users manually organize files

#### Categorization Improvement Workflow
1. **Process Documents**: Files are automatically categorized with AI reasoning
2. **Review Results**: Open processing log to review categorization decisions
3. **Make Corrections**: Click incorrect entries to fix categorization
4. **Provide Feedback**: Optional feedback helps understand correction reasoning
5. **Track Improvements**: Corrected entries are visually marked for reference

#### File Management
1. **Duplicate Prevention**: Each file is processed exactly once, preventing log spam
2. **User Respect**: System respects user file movements without interference
3. **Smart Detection**: Distinguishes between ParaFile actions and user actions
4. **Transparent Logging**: All file activities are logged with clear reasoning

### Bug Fixes - Processing Log
- **Fixed Duplicate Processing**: Comprehensive prevention of duplicate log entries
  - Files moved by ParaFile no longer trigger reprocessing
  - Smart tracking prevents the same file from being processed multiple times
  - Only truly new files are processed, existing files are left alone

- **Fixed Recursive Processing Loop**: 
  - ParaFile moving files to category subfolders no longer triggers new processing
  - File monitor marks ParaFile-moved files to prevent recursive detection
  - Temporary tracking sets clean up automatically to prevent memory leaks

### Migration Notes - Processing Log
- **Automatic Log Creation**: Processing log is created automatically on first use
- **Backward Compatibility**: Existing configurations continue to work unchanged  
- **Performance Impact**: Minimal impact with automatic log rotation (100 entries max)
- **Storage Location**: Logs stored in user data directory alongside configuration

## [Previous Entries] - 2025-07-30

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

- **AI Expertise System**: Configurable AI assistant specialization
  - Added Expertise section to Settings with General and Legal options
  - Default setting is General for backward compatibility
  - AI suggestions, evaluations, and descriptions adapt based on selected expertise
  - Legal expertise includes specialized legal document patterns and terminology
  - General expertise focuses on common business and personal documents

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
  - Added Expertise section with radio buttons to Settings (lines 260-276)
  - Simplified system integration settings (lines 278-290)
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
  - Updated settings handling for expertise and minimize to tray preferences (lines 656-682)
  - Enhanced `showSettingsModal()` to load expertise setting (lines 464-469)
  - Fixed onboarding logic to check only API key presence (lines 25-47)

#### Backend
- **src/services/aiService.js**:
  - Enhanced `generateVariableSuggestion()` method with expertise context (lines 149-184)
  - Enhanced `evaluateVariableDescription()` method with expertise-specific guidelines (lines 241-305)
  - Enhanced `generateShortDescription()` method with expertise-aware examples (lines 192-239)
  - Legal expertise includes comprehensive legal document patterns and terminology
  - General expertise focuses on common business and personal document types
  - All methods now accept expertise parameter with context-aware prompts

- **src/index.js**:
  - Imported aiService module (line 9)
  - Enhanced IPC handler `api:generateVariable` to pass expertise (lines 392-408)
  - Enhanced IPC handler `api:evaluateDescription` to pass expertise (lines 410-426)
  - Enhanced IPC handler `api:generateShortDescription` to pass expertise (lines 428-444)
  - Updated window close behavior to check minimize preference (lines 47-61)
  - Removed auto-launch related code and imports

- **src/config/configManager.js**:
  - Added `expertise: 'general'` to default configuration (line 12)
  - Updated `validateAndRepair()` method to include expertise field (line 64)
  - Ensures backward compatibility with existing configurations

#### Styling
- **src/index.css**:
  - Added hover effects for clickable variable items (lines 486-490)
  - Added custom radio button styles for expertise selection (lines 375-416)
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

#### AI Expertise System
1. **Configurable Specialization**: Choose between General and Legal expertise modes
2. **Context-Aware Responses**: AI suggestions adapt to selected expertise level
3. **Legal Document Focus**: Specialized legal terminology and document patterns when Legal mode is selected
4. **General Business Focus**: Common business and personal document patterns in General mode
5. **Persistent Settings**: Expertise preference is saved and applied to all AI operations

### Workflow Changes
1. **Variable Creation Flow**:
   - User creates variable → AI evaluates description (using selected expertise) → User finalizes → AI generates short description → Save
2. **Description Evaluation**:
   - Loading modal during evaluation → Issues displayed if found (expertise-specific) → User can keep original or save edited version
3. **Variable Display**:
   - Short descriptions shown in list → Click anywhere for full details popup → Clean modal without redundant buttons
4. **Expertise Configuration**:
   - Settings → Expertise section → Select General or Legal → All AI operations use selected expertise level

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