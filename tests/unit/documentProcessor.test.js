/**
 * Unit Tests for DocumentProcessor Service
 * Tests document processing orchestration and workflow
 */

const documentProcessor = require('../../src/services/documentProcessor');
const textExtractor = require('../../src/services/textExtractor');
const aiService = require('../../src/services/aiService');
const fileOrganizer = require('../../src/services/fileOrganizer');

// Mock dependencies
jest.mock('../../src/services/textExtractor');
jest.mock('../../src/services/aiService');
jest.mock('../../src/services/fileOrganizer');

describe('DocumentProcessor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Document Processing Pipeline', () => {
    test('should process document successfully', async () => {
      const mockExtractedText = {
        text: 'Invoice #12345\nDate: 2024-01-15\nAmount: $1,250.00',
        metadata: { pageCount: 1 }
      };

      const mockCategorizationResult = {
        category: 'Invoices',
        confidence: 0.9,
        reasoning: 'Contains invoice information'
      };

      const mockVariableResult = {
        variables: {
          original_name: 'invoice',
          date: '2024-01-15',
          amount: '1250.00'
        }
      };

      // Setup mocks
      textExtractor.extractText.mockResolvedValue(mockExtractedText);
      aiService.categorizeDocument.mockResolvedValue(mockCategorizationResult);
      aiService.extractVariables.mockResolvedValue(mockVariableResult);

      const fileInfo = { path: '/test/invoice.pdf', type: 'pdf' };
      const config = {
        openai_api_key: 'test-key',
        categories: [
          { name: 'Invoices', description: 'Financial invoices', naming_pattern: '{date}_{amount}' }
        ],
        variables: [
          { name: 'original_name', description: 'Original filename', formatting: 'none' },
          { name: 'date', description: 'Document date', formatting: 'none' },
          { name: 'amount', description: 'Total amount', formatting: 'none' }
        ]
      };

      const result = await documentProcessor.processDocument(fileInfo, config);

      expect(result.success).toBe(true);
      expect(result.fileName).toBe('invoice.pdf');
      expect(result.category).toBe('Invoices');
      expect(result.extractedText).toBe(mockExtractedText.text);
      expect(result.variables.date).toBe('2024-01-15');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    test('should handle text extraction failures', async () => {
      textExtractor.extractText.mockRejectedValue(new Error('Extraction failed'));

      const fileInfo = { path: '/test/corrupt.pdf', type: 'pdf' };
      const config = {
        categories: [{ name: 'General', description: 'Other', naming_pattern: '{original_name}' }],
        variables: [{ name: 'original_name', description: 'Original filename' }]
      };

      const result = await documentProcessor.processDocument(fileInfo, config);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle AI service failures gracefully', async () => {
      textExtractor.extractText.mockResolvedValue({
        text: 'Some document text',
        metadata: {}
      });
      aiService.categorizeDocument.mockRejectedValue(new Error('AI service unavailable'));

      const fileInfo = { path: '/test/document.pdf', type: 'pdf' };
      const config = {
        openai_api_key: 'test-key',
        categories: [
          { name: 'General', description: 'Other documents', naming_pattern: '{original_name}' }
        ],
        variables: [
          { name: 'original_name', description: 'Original filename' }
        ]
      };

      const result = await documentProcessor.processDocument(fileInfo, config);

      expect(result.success).toBe(true); // Should still succeed with fallback
      expect(result.category).toBe('General'); // Should fallback to General
    });

    test('should handle missing OpenAI API key', async () => {
      textExtractor.extractText.mockResolvedValue({
        text: 'Document content',
        metadata: {}
      });

      const fileInfo = { path: '/test/document.pdf', type: 'pdf' };
      const config = {
        openai_api_key: '', // Empty API key
        categories: [
          { name: 'General', description: 'Other documents', naming_pattern: '{original_name}' }
        ],
        variables: [
          { name: 'original_name', description: 'Original filename' }
        ]
      };

      const result = await documentProcessor.processDocument(fileInfo, config);

      expect(result.success).toBe(true);
      expect(result.category).toBe('General');
      expect(aiService.categorizeDocument).not.toHaveBeenCalled();
    });
  });

  describe('Variable Processing', () => {
    test('should format variable values correctly', () => {
      const variables = [
        { name: 'test_upper', formatting: 'uppercase' },
        { name: 'test_lower', formatting: 'lowercase' },
        { name: 'test_title', formatting: 'title' },
        { name: 'test_none', formatting: 'none' }
      ];

      const values = {
        test_upper: 'uppercase test',
        test_lower: 'LOWERCASE TEST',
        test_title: 'title case test',
        test_none: 'No Change'
      };

      const formatted = documentProcessor.formatVariableValues(values, variables);

      expect(formatted.test_upper).toBe('UPPERCASE TEST');
      expect(formatted.test_lower).toBe('lowercase test');
      expect(formatted.test_title).toBe('Title Case Test');
      expect(formatted.test_none).toBe('No Change');
    });

    test('should handle missing formatting specification', () => {
      const variables = [
        { name: 'test_var' } // No formatting specified
      ];

      const values = {
        test_var: 'Test Value'
      };

      const formatted = documentProcessor.formatVariableValues(values, variables);
      expect(formatted.test_var).toBe('Test Value'); // Should remain unchanged
    });

    test('should apply naming pattern correctly', () => {
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

    test('should sanitize filenames', () => {
      const pattern = 'File_{name}';
      const values = {
        name: 'Invalid/\\:*?"<>|Characters'
      };

      const result = documentProcessor.applyNamingPattern(pattern, values);
      expect(result).not.toMatch(/[/\\:*?"<>|]/);
    });
  });

  describe('Category Matching', () => {
    test('should find category by name', () => {
      const categories = [
        { name: 'Invoices', description: 'Financial invoices' },
        { name: 'Contracts', description: 'Legal agreements' },
        { name: 'General', description: 'Other documents' }
      ];

      const result = documentProcessor.findCategoryByName(categories, 'Contracts');
      expect(result).toBeDefined();
      expect(result.name).toBe('Contracts');
    });

    test('should return General category when not found', () => {
      const categories = [
        { name: 'Invoices', description: 'Financial invoices' },
        { name: 'General', description: 'Other documents' }
      ];

      const result = documentProcessor.findCategoryByName(categories, 'NonExistent');
      expect(result.name).toBe('General');
    });

    test('should handle missing General category', () => {
      const categories = [
        { name: 'Invoices', description: 'Financial invoices' }
      ];

      const result = documentProcessor.findCategoryByName(categories, 'NonExistent');
      expect(result).toBeDefined();
      expect(result.name).toBe('General'); // Should create fallback
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors', async () => {
      textExtractor.extractText.mockRejectedValue(new Error('ENOENT: File not found'));

      const fileInfo = { path: '/nonexistent/file.pdf', type: 'pdf' };
      const config = {
        categories: [{ name: 'General', description: 'Other' }],
        variables: [{ name: 'original_name', description: 'Original' }]
      };

      const result = await documentProcessor.processDocument(fileInfo, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    test('should record processing time even on failure', async () => {
      textExtractor.extractText.mockRejectedValue(new Error('Processing failed'));

      const fileInfo = { path: '/test/file.pdf', type: 'pdf' };
      const config = {
        categories: [{ name: 'General', description: 'Other' }],
        variables: [{ name: 'original_name', description: 'Original' }]
      };

      const result = await documentProcessor.processDocument(fileInfo, config);

      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Image Processing', () => {
    test('should handle image files with Vision API', async () => {
      textExtractor.extractText.mockResolvedValue({
        text: 'Receipt Store Total: $45.67',
        metadata: { width: 800, height: 600 }
      });

      const mockVisionResult = {
        category: 'Receipts',
        confidence: 0.95,
        variables: {
          vendor: 'Receipt Store',
          amount: '45.67'
        }
      };

      aiService.analyzeImageWithVision.mockResolvedValue(mockVisionResult);

      const fileInfo = { path: '/test/receipt.png', type: 'png' };
      const config = {
        openai_api_key: 'test-key',
        categories: [
          { name: 'Receipts', description: 'Purchase receipts' }
        ],
        variables: [
          { name: 'vendor', description: 'Store name' },
          { name: 'amount', description: 'Total amount' }
        ]
      };

      const result = await documentProcessor.processDocument(fileInfo, config);

      expect(result.success).toBe(true);
      expect(result.category).toBe('Receipts');
      expect(result.variables.vendor).toBe('Receipt Store');
      expect(aiService.analyzeImageWithVision).toHaveBeenCalled();
    });
  });
});

module.exports = {
  testName: 'DocumentProcessor Service Tests',
  description: 'Tests for document processing orchestration and workflow'
};