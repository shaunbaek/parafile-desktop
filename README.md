# ParaFile Desktop

An AI-powered document organization and renaming application that automatically categorizes and renames PDF and Word documents using OpenAI's GPT API.

## Features

- **Automatic Document Monitoring**: Watches folders for new PDF and Word documents
- **AI-Powered Categorization**: Uses OpenAI GPT-4 to intelligently categorize documents
- **Smart Renaming**: Extracts variables from documents to generate meaningful filenames
- **Modern UI**: Clean, intuitive interface for easy configuration
- **Command-Line Mode**: Headless monitoring service for automated workflows
- **Robust Error Handling**: Handles file locks, API failures, and corrupted documents gracefully

## Quick Start

### 1. Setup

```bash
# Clone or download the project
npm install

# Set up your OpenAI API key
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### 2. Configure the Application

```bash
# Start the GUI application
npm start
```

1. **Select a folder** to monitor using the Browse button
2. **Configure categories** - Add categories with descriptions for the AI to understand
3. **Define variables** - Create variables that the AI can extract from documents
4. **Set naming patterns** - Use variables in curly braces like `{date}_{client_name}_{document_type}`

### 3. Start Monitoring

Click "Start Monitoring" in the GUI, or run the CLI version:

```bash
# Run headless monitoring service
npm run monitor
```

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

1. **File Detection**: Monitors your selected folder for new PDF and Word documents
2. **Text Extraction**: Extracts text content from documents
3. **AI Analysis**: Sends text to OpenAI GPT-4 for categorization and variable extraction
4. **File Organization**: Renames and optionally moves files to category subfolders
5. **Error Recovery**: Handles failures gracefully with retry logic and fallbacks

## Requirements

- **Node.js** 16 or higher
- **OpenAI API Key** with GPT-4 access
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

1. **"OpenAI API key not found"**
   - Ensure your `.env` file exists and contains `OPENAI_API_KEY=your_key_here`

2. **Files not being processed**
   - Check that the folder path is correct
   - Ensure files are PDF or Word documents (.pdf, .docx, .doc)
   - Verify the monitoring service is running

3. **AI categorization not working**
   - Check your OpenAI API key has GPT-4 access
   - Ensure you have API credits remaining
   - Check the application logs for error messages

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