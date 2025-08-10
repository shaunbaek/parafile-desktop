/**
 * Integration Tests for Document Processing Pipeline
 * Tests the complete flow from file detection to organization
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Import services
const fileMonitor = require('../../src/services/fileMonitor');
const documentProcessor = require('../../src/services/documentProcessor');
const configManager = require('../../src/config/configManager');
const textExtractor = require('../../src/services/textExtractor');

describe('Document Processing Integration', () => {
  let testDir;
  let testConfig;

  beforeAll(() => {
    // Set up test environment
    testDir = path.join(os.tmpdir(), `parafile-integration-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Create test configuration
    testConfig = {
      watched_folder: testDir,
      enable_organization: true,
      enable_desktop_notifications: false,
      auto_start_monitoring: false,
      openai_api_key: process.env.OPENAI_API_KEY || 'test-api-key',
      expertise: 'general',
      categories: [
        {
          name: 'Invoices',
          description: 'Financial invoices and billing documents',
          naming_pattern: 'Invoice_{date}_{vendor}'
        },
        {
          name: 'Contracts',
          description: 'Legal agreements and contracts',
          naming_pattern: 'Contract_{parties}_{date}'
        },
        {
          name: 'General',
          description: 'Other documents',
          naming_pattern: '{original_name}'
        }
      ],
      variables: [
        { name: 'original_name', description: 'Original filename', formatting: 'none' },
        { name: 'date', description: 'Document date', formatting: 'none' },
        { name: 'vendor', description: 'Vendor name', formatting: 'title' },
        { name: 'parties', description: 'Contract parties', formatting: 'title' }
      ]
    };
  });

  afterAll(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('End-to-End Processing Pipeline', () => {
    test('should process CSV file through complete pipeline', async () => {
      // Create test CSV file
      const csvContent = `Date,Item,Amount,Vendor
2024-01-15,Office Supplies,250.00,OfficeMax
2024-01-16,Software License,1200.00,Microsoft
2024-01-17,Equipment,800.00,Dell`;
      
      const csvPath = path.join(testDir, 'expenses.csv');
      fs.writeFileSync(csvPath, csvContent);

      // Process the file
      const fileInfo = { path: csvPath, type: 'csv' };
      const result = await documentProcessor.processDocument(fileInfo, testConfig);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.fileName).toBe('expenses.csv');
      
      // Should have extracted text content
      expect(result.extractedText).toBeDefined();
      expect(result.extractedText.length).toBeGreaterThan(0);
      
      // Processing time should be recorded
      expect(result.processingTime).toBeGreaterThan(0);
    });

    test('should handle text extraction failures gracefully', async () => {
      // Create invalid/corrupt file
      const corruptPath = path.join(testDir, 'corrupt.pdf');
      fs.writeFileSync(corruptPath, 'This is not a valid PDF file');

      const fileInfo = { path: corruptPath, type: 'pdf' };
      const result = await documentProcessor.processDocument(fileInfo, testConfig);

      expect(result).toBeDefined();
      expect(result.success).toBe(true); // Should still succeed with fallback
      expect(result.category).toBe('General'); // Should fallback to General
    });

    test('should process image file with OCR', async () => {
      // Copy test image if available
      const sourceImage = path.join(__dirname, '../../test-files/Receipt_Store_20241215.png');
      if (!fs.existsSync(sourceImage)) {
        console.log('Skipping image test - no test image available');
        return;
      }

      const imagePath = path.join(testDir, 'test-receipt.png');
      fs.copyFileSync(sourceImage, imagePath);

      const fileInfo = { path: imagePath, type: 'png' };
      const result = await documentProcessor.processDocument(fileInfo, testConfig);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.extractedText).toBeDefined();
      
      // Should have attempted OCR
      expect(result.extractedText.length).toBeGreaterThan(0);
    }, 30000); // OCR can be slow
  });

  describe('Configuration Integration', () => {
    test('should use category descriptions for AI analysis', async () => {
      const csvPath = path.join(testDir, 'invoice-data.csv');
      const csvContent = `Invoice Number,Date,Amount,Customer
INV-001,2024-01-15,1250.00,John Smith Company
INV-002,2024-01-16,800.00,ABC Corporation`;
      
      fs.writeFileSync(csvPath, csvContent);

      const fileInfo = { path: csvPath, type: 'csv' };
      const result = await documentProcessor.processDocument(fileInfo, testConfig);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      
      // The AI should potentially categorize this as an Invoice based on content
      // (though it might also fallback to General in test environment)
      expect(['Invoices', 'General']).toContain(result.category);
    });

    test('should handle missing OpenAI API key', async () => {
      const configWithoutAPI = { ...testConfig, openai_api_key: '' };
      
      const csvPath = path.join(testDir, 'test-no-api.csv');
      fs.writeFileSync(csvPath, 'test,data\n1,2');

      const fileInfo = { path: csvPath, type: 'csv' };
      const result = await documentProcessor.processDocument(fileInfo, configWithoutAPI);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.category).toBe('General'); // Should fallback
    });
  });

  describe('Variable Extraction and Naming', () => {
    test('should apply variable formatting', async () => {
      // Test different formatting options
      const formatTestConfig = {
        ...testConfig,
        variables: [
          { name: 'original_name', description: 'Original filename', formatting: 'none' },
          { name: 'test_upper', description: 'Test variable', formatting: 'uppercase' },
          { name: 'test_lower', description: 'Test variable', formatting: 'lowercase' },
          { name: 'test_title', description: 'Test variable', formatting: 'title' }
        ]
      };

      const testValues = {
        original_name: 'test_file',
        test_upper: 'uppercase test',
        test_lower: 'LOWERCASE TEST',
        test_title: 'title case test'
      };

      const formatted = documentProcessor.formatVariableValues(testValues, formatTestConfig.variables);

      expect(formatted.test_upper).toBe('UPPERCASE TEST');
      expect(formatted.test_lower).toBe('lowercase test');
      expect(formatted.test_title).toBe('Title Case Test');
    });

    test('should generate filename from naming pattern', () => {
      const pattern = 'Invoice_{date}_{vendor}_{amount}';
      const values = {
        date: '2024-01-15',
        vendor: 'Office Supplies Inc',
        amount: '1250.00'
      };

      const result = documentProcessor.applyNamingPattern(pattern, values);
      expect(result).toBe('Invoice_2024-01-15_Office Supplies Inc_1250.00');
    });

    test('should handle missing variables in pattern', () => {
      const pattern = 'Doc_{existing}_{missing}_{original_name}';
      const values = {
        existing: 'value',
        original_name: 'fallback'
      };

      const result = documentProcessor.applyNamingPattern(pattern, values);
      expect(result).toBe('Doc_value_{missing}_fallback');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle file access errors gracefully', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent.pdf');
      
      const fileInfo = { path: nonExistentPath, type: 'pdf' };
      const result = await documentProcessor.processDocument(fileInfo, testConfig);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should recover from AI service failures', async () => {
      const csvPath = path.join(testDir, 'ai-failure-test.csv');
      fs.writeFileSync(csvPath, 'test,data\n1,2');

      // Use invalid API key to trigger AI failure
      const failConfig = { ...testConfig, openai_api_key: 'invalid-key' };
      
      const fileInfo = { path: csvPath, type: 'csv' };
      const result = await documentProcessor.processDocument(fileInfo, failConfig);

      expect(result).toBeDefined();
      expect(result.success).toBe(true); // Should still succeed with fallback
      expect(result.category).toBe('General'); // Should use fallback category
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle multiple concurrent file processing', async () => {
      const files = [];
      const promises = [];

      // Create multiple test files
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testDir, `concurrent-${i}.csv`);
        const content = `Test${i},Data${i}\nValue${i},${i * 100}`;
        fs.writeFileSync(filePath, content);
        
        files.push({ path: filePath, type: 'csv' });
      }

      // Process all files concurrently
      for (const file of files) {
        promises.push(documentProcessor.processDocument(file, testConfig));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.fileName).toBe(`concurrent-${index}.csv`);
      });
    });

    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      const fileCount = 10;
      const promises = [];

      // Create and process multiple files
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(testDir, `load-test-${i}.csv`);
        const content = `Item,Quantity,Price\nTest Item ${i},${i + 1},${(i + 1) * 10}`;
        fs.writeFileSync(filePath, content);
        
        const fileInfo = { path: filePath, type: 'csv' };
        promises.push(documentProcessor.processDocument(fileInfo, testConfig));
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(fileCount);
      expect(results.every(r => r.success)).toBe(true);
      
      // Performance check: should process files reasonably quickly
      const avgTimePerFile = totalTime / fileCount;
      expect(avgTimePerFile).toBeLessThan(5000); // Less than 5 seconds per file
    });
  });
});

module.exports = {
  testName: 'Document Processing Integration Tests',
  description: 'End-to-end tests for the complete document processing pipeline'
};