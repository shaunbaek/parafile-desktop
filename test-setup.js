const fs = require('fs');
const path = require('path');

// Create a test folder structure
const testDir = path.join(__dirname, 'test-documents');

// Create directories
const dirs = [
  testDir,
  path.join(testDir, 'incoming'),
  path.join(testDir, 'processed')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Create a sample PDF-like text file for testing
const sampleInvoice = `INVOICE
Invoice Number: INV-2024-001
Date: January 15, 2024
Vendor: Acme Corporation

Bill To:
John Smith
123 Main Street
Anytown, USA

Description: Professional Services
Amount Due: $5,000.00

Thank you for your business!`;

const sampleContract = `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of March 1, 2024,
between ABC Company ("Service Provider") and XYZ Corporation ("Client").

1. SERVICES
The Service Provider agrees to provide software development services
as described in Exhibit A.

2. TERM
This Agreement shall commence on March 1, 2024 and continue for
a period of 12 months.

3. COMPENSATION
Client agrees to pay Service Provider $10,000 per month for services rendered.

SIGNED:
Service Provider: _________________
Client: _________________`;

// Save sample files
fs.writeFileSync(
  path.join(testDir, 'incoming', 'sample_invoice.txt'),
  sampleInvoice
);

fs.writeFileSync(
  path.join(testDir, 'incoming', 'sample_contract.txt'),
  sampleContract
);

console.log(`
Test setup complete!

Test directories created:
- ${testDir}/incoming (place test documents here)
- ${testDir}/processed (organized documents will appear here)

Sample text files created for testing.

To test the app:
1. Start the application: npm start
2. Set the watched folder to: ${testDir}/incoming
3. Enable organization to see files moved to: ${testDir}/processed
4. Add test PDF or Word documents to the incoming folder
`);