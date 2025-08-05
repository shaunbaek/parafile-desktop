# ParaFile Desktop - Product Documentation

> **Automating Admin Work for Law Firms**  
> Cut down on non-billable hours spent on administrative tasks

---

## 📋 Overview

ParaFile Desktop automates manual and repetitive administrative workflows for law firms, starting with document organization. Our desktop application helps paralegals and legal staff save 10-20% of their day by automatically organizing, categorizing, and renaming legal documents using AI-powered technology.

Built specifically for the legal industry, ParaFile Desktop understands legal document types, extracts key information, and maintains organized file structures without manual intervention.

---

## 🎯 Why ParaFile?

### The Problem
- Paralegals spend **10-20% of their day** on document organization
- Manual filing is prone to errors and inconsistencies  
- Time spent on admin work is non-billable, reducing firm profitability
- Junior lawyers waste hours on repetitive tasks instead of meaningful legal work

### Our Solution
- **Automated categorization** of legal documents (contracts, pleadings, discovery, etc.)
- **Intelligent file naming** that extracts case numbers, party names, and dates
- **Zero-touch organization** that runs continuously in the background
- **Legal-specific AI** trained to understand legal terminology and document structures

---

## ⚖️ Built for Legal Professionals

### Document Types We Handle
- **Contracts & Agreements**: Service agreements, NDAs, employment contracts
- **Court Documents**: Pleadings, motions, orders, judgments
- **Discovery Materials**: Interrogatories, depositions, document productions
- **Client Communications**: Letters, emails, memoranda
- **Administrative Files**: Invoices, timesheets, expense reports

### Legal-Specific Features
- **Case Number Extraction**: Automatically identifies and extracts case numbers
- **Party Name Recognition**: Detects plaintiff, defendant, and client names
- **Date Intelligence**: Extracts filing dates, deadlines, and effective dates
- **Document Type Classification**: Recognizes 50+ legal document types
- **Bates Numbering Support**: Maintains Bates number sequences

---

## 🚀 Getting Started

### Prerequisites
- **Windows** 10+ or **macOS** 10.14+
- **4GB RAM** minimum (8GB recommended)
- **OpenAI API Key** for AI features

### Quick Installation

1. **Download ParaFile Desktop**
   ```bash
   # For development/testing
   git clone https://github.com/parafile/parafile-desktop.git
   cd parafile-desktop
   npm ci
   npm start
   ```

2. **Configure API Key**
   - Open Settings
   - Enter your OpenAI API key
   - Click "Test Connection"

3. **Select Document Folder**
   - Choose your firm's document folder
   - All subfolders are automatically monitored
   - Click "Start Monitoring"

---

## 📖 How Law Firms Use ParaFile

### Typical Workflow

1. **Documents Arrive**
   - New documents saved to monitored folders
   - Email attachments downloaded to intake folder
   - Scanned documents added to processing queue

2. **Automatic Processing**
   - ParaFile detects new files within seconds
   - AI analyzes content and extracts key information
   - Documents are renamed according to firm standards
   - Files move to appropriate case or matter folders

3. **Background Operation**
   - Runs silently in system tray
   - Processes documents without interrupting work
   - Sends notifications for important documents

### Setting Up Legal Categories

Create categories that match your firm's practice areas:

```
Category: Contracts
Description: Legal agreements, contracts, amendments, and addenda
Pattern: {case_number}_{contract_type}_{party_names}_{execution_date}

Category: Pleadings  
Description: Court filings, motions, complaints, answers, and briefs
Pattern: {case_number}_{document_type}_{filing_date}

Category: Discovery
Description: Discovery requests, responses, and productions
Pattern: {case_number}_DISCOVERY_{document_type}_{date}
```

### Configuring Legal Variables

Extract specific information from legal documents:

```
Variable: case_number
Description: Extract case number in format XX-CV-XXXXX or similar

Variable: opposing_counsel
Description: Extract name of opposing counsel or law firm

Variable: filing_deadline
Description: Extract any filing deadlines mentioned in document

Variable: contract_value  
Description: Extract total contract amount or settlement value
```

---

## 🛠️ Law Firm Configuration

### Recommended Settings

1. **Expertise Mode**: Set to "Legal" for specialized document handling
2. **Naming Conventions**: Configure to match your firm's standards
3. **Folder Structure**: Organize by client/matter or practice area
4. **Processing Rules**: Set up rules for different document types

### Example Configuration

```json
{
  "expertise": "legal",
  "watched_folder": "/Users/firm/Documents/Intake",
  "categories": [
    {
      "name": "Client Contracts",
      "description": "Client engagement letters and fee agreements",
      "naming_pattern": "{client_name}_FeeAgreement_{date}"
    },
    {
      "name": "Court Filings",
      "description": "Documents filed with the court",
      "naming_pattern": "{case_number}_{document_type}_{filing_date}"
    }
  ]
}
```

---

## 📊 Real-World Impact

### Time Savings
- **Before**: 2 hours daily on document organization
- **After**: 10 minutes reviewing automated results
- **Result**: 95% reduction in admin time

### Accuracy Improvements
- Consistent naming across all documents
- No misfiled documents
- Easy retrieval during discovery
- Reduced risk of missing deadlines

### Billable Hours Recovery
- Paralegals focus on billable work
- Junior associates spend time on legal research
- Partners see improved realization rates

---

## 🔧 Troubleshooting for Law Firms

### Common Legal Document Issues

**"Case number not extracted correctly"**
- Ensure case number format is specified in variables
- Add examples: "XX-CV-XXXXX" or "2024-12345"
- Contact support for custom extraction rules

**"Documents going to wrong matter folder"**
- Review category descriptions
- Make categories more specific to practice areas
- Use matter numbers in naming patterns

**"Confidential documents"**
- ParaFile processes everything locally
- No documents leave your computer
- Only text is sent to AI for analysis

---

## 🔒 Security & Compliance

### Data Security
- **100% Local Processing**: Documents never leave your firm
- **No Cloud Storage**: All files remain on your systems
- **Encrypted API Calls**: Only document text sent for AI analysis
- **Access Controls**: Respects Windows/macOS file permissions

### Compliance Features
- Maintains audit trail in processing log
- Preserves original files (copies for organization)
- Supports retention policies
- Compatible with document management systems

---

## 📞 Support for Law Firms

### Getting Help
- **Email**: support@tryparafile.com
- **Documentation**: This guide and quick-start materials
- **Response Time**: Within 24 hours for law firm customers

### Training Resources
- Video tutorials for legal staff
- Best practices for legal document organization  
- Custom category templates for different practice areas
- Integration guides for popular legal software

---

## 🚀 Coming Soon

### Planned Features
- **Email Integration**: Auto-process email attachments
- **OCR Support**: Handle scanned documents
- **DMS Integration**: Connect with iManage, NetDocuments
- **Batch Processing**: Handle large discovery productions
- **Custom Workflows**: Multi-step document processing

---

*ParaFile Desktop - Automating admin work so you can focus on practicing law*