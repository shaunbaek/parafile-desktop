# ParaFile Desktop - Product Documentation

> **AI-Powered Document Organization Application**  
> Automatically categorize, rename, and organize your documents with intelligent automation

---

## 📋 Overview

ParaFile Desktop is an AI-powered document organization application that automatically categorizes, renames, and organizes PDF and Word documents using OpenAI's GPT-4 technology. Built with Electron, it runs seamlessly in the background on Windows, macOS, and Linux, monitoring your folders and intelligently organizing documents as they arrive.

---

## 🎯 Key Features

### Core Functionality
- **🤖 AI-Powered Categorization**: Uses GPT-4 to analyze document content and classify files intelligently
- **📁 Automated Organization**: Creates folder structures and moves files to appropriate categories
- **🏷️ Smart Renaming**: Extracts key information to generate meaningful, consistent filenames
- **👀 Real-Time Monitoring**: Watches folders and all subdirectories recursively
- **⚡ Background Operation**: Runs in system tray with global keyboard shortcuts

### Advanced Features
- **🎨 Modern User Interface**: Clean glassmorphism design with intuitive controls
- **🔧 Custom Categories**: Define your own document categories with AI-readable descriptions
- **📊 Processing Log**: View detailed history with AI reasoning for each categorization
- **✏️ Easy Corrections**: Click any log entry to correct categorization mistakes
- **🌐 Cross-Platform**: Native support for Windows, macOS, and Linux

### User Experience
- **2-Step Setup**: Quick onboarding with API key configuration and folder selection
- **Drag-and-Drop**: Instantly process documents by dropping them into the app
- **Global Shortcut**: Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS) to show/hide
- **System Notifications**: Get alerts when documents are processed in the background
- **Minimize to Tray**: Keeps running when closed, just like Slack or Discord

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: Version 16 or higher ([Download](https://nodejs.org/))
- **Git**: For cloning the repository ([Download](https://git-scm.com/))
- **OpenAI API Key**: Required for AI features ([Get API Key](https://platform.openai.com/api-keys))

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/shaunbaek/parafile-desktop.git
cd parafile-desktop
```

#### 2. Install Dependencies
```bash
npm ci
```

#### 3. Launch the Application
```bash
npm start
```

### First-Time Setup

When you first launch ParaFile Desktop, you'll be guided through a simple 2-step setup:

#### Step 1: Configure OpenAI API Key
1. Click "Settings" in the main window
2. Enter your OpenAI API key
3. Click "Test Connection" to verify it works
4. Click "Save Settings"

#### Step 2: Select Monitoring Folder
1. Click "Select Folder" in the main window
2. Choose the folder you want to monitor
3. All subdirectories will be automatically included
4. Click "Start Monitoring" to begin

---

## 📖 How to Use ParaFile Desktop

### Basic Workflow

1. **Start Monitoring**
   - Click "Start Monitoring" after selecting your folder
   - The app will watch for new PDF and Word documents
   - Files are processed automatically as they appear

2. **Document Processing**
   - New documents are detected within seconds
   - AI analyzes the content and categorizes the document
   - Files are renamed based on your patterns
   - Documents move to category-specific subfolders

3. **Background Operation**
   - Close the window to minimize to system tray
   - Right-click the tray icon for quick controls
   - Use the global shortcut to show/hide the window

### Setting Up Categories

Categories tell the AI how to organize your documents:

1. **Open Categories**
   - Click "Categories" in the main window
   
2. **Add a Category**
   - Click "Add Category"
   - Enter a name (e.g., "Invoices")
   - Add a description for the AI (e.g., "Financial invoices, bills, and payment documents")
   - Define a naming pattern using variables (e.g., `{date}_{vendor}_{amount}`)

3. **Example Categories**
   ```
   Name: Contracts
   Description: Legal agreements, contracts, and terms of service
   Pattern: {contract_type}_{party_name}_{date}
   
   Name: Reports
   Description: Business reports, analytics, and performance summaries
   Pattern: {report_type}_{period}_{department}
   ```

### Creating Custom Variables

Variables extract specific information from documents:

1. **Open Variables**
   - Click "Variables" in the main window

2. **Add a Variable**
   - Click "Add Variable"
   - Enter a name (e.g., "invoice_date")
   - Add a description (e.g., "Extract the invoice date in YYYY-MM-DD format")
   - Or use "AI Suggest" to generate variables from natural language

3. **Example Variables**
   ```
   Name: vendor_name
   Description: Extract the vendor or company name from invoices
   
   Name: contract_value
   Description: Extract the total contract value or amount
   
   Name: client_name
   Description: Extract the client or customer name
   ```

### Using the Processing Log

Track and correct document processing:

1. **Open Processing Log**
   - Click "📋 Open Processing Log" button
   - View all processed documents with details

2. **Understanding the Log**
   - **Original Name**: The file's original name
   - **ParaFiled Name**: The new organized name
   - **Category**: Where the document was filed
   - **Reasoning**: AI's explanation for the categorization
   - **Status**: Processing result (Processed, Failed, Corrected)

3. **Correcting Mistakes**
   - Click any row to open the correction dialog
   - Select the correct category from the dropdown
   - Optionally add feedback about why it was wrong
   - Click "Save Correction"

### Command-Line Interface

Run ParaFile Desktop without the GUI:

```bash
# Start monitoring in headless mode
npm run monitor

# This runs the monitoring service without opening a window
# Useful for servers or automated workflows
```

---

## 🛠️ Configuration

### Settings Panel

Access all settings through the Settings button:

1. **API Configuration**
   - OpenAI API Key
   - Test connection functionality

2. **Expertise Mode**
   - General: For common business documents
   - Legal: Specialized for legal documents

3. **System Integration**
   - Keep running in background when closed
   - Start monitoring automatically on launch

### Configuration File

Settings are stored in your user data directory:
- **Windows**: `%APPDATA%\parafile-desktop\config.json`
- **macOS**: `~/Library/Application Support/parafile-desktop/config.json`
- **Linux**: `~/.config/parafile-desktop/config.json`

Example configuration:
```json
{
  "watched_folder": "/Users/username/Documents",
  "enable_organization": true,
  "openai_api_key": "sk-...",
  "expertise": "general",
  "categories": [
    {
      "name": "Invoices",
      "description": "Financial invoices and bills",
      "naming_pattern": "{date}_{vendor}_{amount}"
    }
  ],
  "variables": [
    {
      "name": "date",
      "description": "Extract the document date in YYYY-MM-DD format"
    }
  ]
}
```

---

## 📦 Building & Distribution

### Development Commands

```bash
# Development
npm start              # Launch GUI application
npm run monitor        # Run headless monitoring service

# Building
npm run package        # Create packaged application
npm run make          # Build installers for your platform
npm run publish       # Publish to GitHub releases

# Utilities
npm run generate-icons # Generate app icons from source SVG
```

### Creating Installers

Build distributable installers for each platform:

```bash
# macOS
npm run make    # Creates .dmg installer

# Windows  
npm run make    # Creates .exe installer with auto-updater

# Linux
npm run make    # Creates .deb and .rpm packages
```

### Distribution Files

After building, find installers in:
- `out/make/` - Platform-specific installers
- `out/make/zip/` - ZIP archives for manual distribution

---

## 🔧 Troubleshooting

### Common Issues

**"OpenAI API Key Invalid"**
- Verify your API key at [platform.openai.com](https://platform.openai.com)
- Ensure your account has GPT-4 access
- Check for any leading/trailing spaces in the key

**"No Documents Being Processed"**
- Verify monitoring is started (green status indicator)
- Check that new files are PDF or Word documents
- Ensure files are being added to the monitored folder
- Look for errors in the Processing Log

**"Application Won't Start"**
- Run `npm ci` to ensure all dependencies are installed
- Check Node.js version is 16 or higher: `node --version`
- Try deleting `node_modules` and running `npm ci` again

### File Processing

**Supported Formats**
- PDF files (`.pdf`)
- Word documents (`.doc`, `.docx`)

**Processing Requirements**
- Files must contain extractable text
- Scanned PDFs without OCR won't be processed
- Password-protected files are skipped

### Performance Tips

- **Large Folders**: Initial scan may take time for folders with many files
- **Processing Queue**: Documents are processed one at a time to ensure accuracy
- **API Limits**: Be aware of your OpenAI API rate limits
- **Resource Usage**: Close other applications if experiencing slowdowns

---

## 📊 Advanced Usage

### Naming Pattern Examples

Create sophisticated naming patterns using variables:

```
Invoice Pattern: {year}-{month}_{vendor}_{invoice_number}
Result: 2024-03_Acme Corp_INV-12345.pdf

Contract Pattern: {contract_type}_{client_name}_{effective_date}
Result: Service Agreement_Tech Solutions_2024-03-15.pdf

Report Pattern: {report_type}_{quarter}_{year}_{department}
Result: Financial Report_Q1_2024_Sales.pdf
```

### Category Best Practices

Write clear descriptions for better AI categorization:

**Good Description**:
"Financial invoices, bills, payment requests, and receipts from vendors or suppliers"

**Poor Description**:
"Money stuff"

### Variable Extraction Tips

Be specific about format and context:

**Good Variable**:
```
Name: invoice_total
Description: Extract the total amount from invoices, including currency symbol (e.g., $1,234.56)
```

**Poor Variable**:
```
Name: amount
Description: Get the number
```

---

## 🆘 Support & Resources

### Getting Help

- **Documentation**: This guide and README.md
- **Issues**: [GitHub Issues](https://github.com/shaunbaek/parafile-desktop/issues)
- **Discussions**: [GitHub Discussions](https://github.com/shaunbaek/parafile-desktop/discussions)

### System Requirements

**Minimum Requirements**
- OS: Windows 10, macOS 10.14, Ubuntu 18.04
- RAM: 4GB
- Storage: 500MB free space
- Internet: Required for AI processing

**Recommended Requirements**
- OS: Latest version of Windows, macOS, or Linux
- RAM: 8GB or more
- Storage: 2GB free space
- CPU: Multi-core processor

---

## 🔒 Privacy & Security

### Data Handling
- **Local Storage**: All documents remain on your computer
- **API Calls**: Only document text is sent to OpenAI for categorization
- **No Cloud Storage**: ParaFile never uploads or stores your files
- **Secure Configuration**: API keys are stored locally in your user directory

### Best Practices
- Keep your OpenAI API key confidential
- Regularly review the Processing Log
- Use appropriate categories for sensitive documents
- Enable organization only for trusted folders

---

*ParaFile Desktop - Transform your document chaos into organized intelligence*