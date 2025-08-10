/**
 * Unit Tests for AIService
 * Tests OpenAI integration and document analysis
 */

const aiServiceModule = require('../../src/services/aiService');

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

describe('AIService', () => {
  let aiService;
  let mockOpenAI;

  beforeEach(() => {
    const OpenAI = require('openai');
    mockOpenAI = new OpenAI();
    aiService = aiServiceModule;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with valid API key', () => {
      const apiKey = 'test-api-key';
      aiService.initialize(apiKey);
      
      expect(aiService.openai).toBeDefined();
    });

    test('should handle missing API key', () => {
      console.warn = jest.fn();
      aiService.initialize('');
      
      expect(aiService.openai).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('OpenAI API key not provided');
    });

    test('should handle null API key', () => {
      console.warn = jest.fn();
      aiService.initialize(null);
      
      expect(aiService.openai).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('OpenAI API key not provided');
    });
  });

  describe('Document Categorization', () => {
    beforeEach(() => {
      aiService.initialize('test-api-key');
    });

    test('should categorize document successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              category: 'Invoices',
              confidence: 0.9,
              reasoning: 'Contains invoice number and billing information'
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const categories = [
        { name: 'Invoices', description: 'Financial invoices' },
        { name: 'General', description: 'Other documents' }
      ];

      const result = await aiService.categorizeDocument('Invoice #123...', categories);

      expect(result.category).toBe('Invoices');
      expect(result.confidence).toBe(0.9);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const categories = [
        { name: 'General', description: 'Other documents' }
      ];

      await expect(aiService.categorizeDocument('test text', categories))
        .rejects.toThrow('API Error');
    });

    test('should throw error when not initialized', async () => {
      aiService.openai = null;

      const categories = [
        { name: 'General', description: 'Other documents' }
      ];

      await expect(aiService.categorizeDocument('test text', categories))
        .rejects.toThrow('OpenAI client not initialized');
    });

    test('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'invalid json'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const categories = [
        { name: 'General', description: 'Other documents' }
      ];

      await expect(aiService.categorizeDocument('test text', categories))
        .rejects.toThrow();
    });

    test('should include expertise context', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              category: 'Contracts',
              confidence: 0.8
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const categories = [
        { name: 'Contracts', description: 'Legal agreements' }
      ];

      await aiService.categorizeDocument('Agreement text...', categories, 'legal');

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('legal document categorization expert');
    });
  });

  describe('Variable Extraction', () => {
    beforeEach(() => {
      aiService.initialize('test-api-key');
    });

    test('should extract variables successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              variables: {
                date: '2024-01-15',
                vendor: 'Office Supply Co',
                amount: '1250.00'
              }
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const variables = [
        { name: 'date', description: 'Document date' },
        { name: 'vendor', description: 'Vendor name' },
        { name: 'amount', description: 'Total amount' }
      ];

      const result = await aiService.extractVariables('Invoice content...', variables);

      expect(result.variables.date).toBe('2024-01-15');
      expect(result.variables.vendor).toBe('Office Supply Co');
      expect(result.variables.amount).toBe('1250.00');
    });

    test('should handle missing variables', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              variables: {
                date: '2024-01-15'
                // vendor and amount missing
              }
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const variables = [
        { name: 'date', description: 'Document date' },
        { name: 'vendor', description: 'Vendor name' },
        { name: 'amount', description: 'Total amount' }
      ];

      const result = await aiService.extractVariables('Limited content...', variables);

      expect(result.variables.date).toBe('2024-01-15');
      expect(result.variables.vendor).toBeUndefined();
      expect(result.variables.amount).toBeUndefined();
    });
  });

  describe('Image Analysis with Vision API', () => {
    beforeEach(() => {
      aiService.initialize('test-api-key');
    });

    test('should analyze image with Vision API', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              category: 'Receipts',
              confidence: 0.95,
              variables: {
                vendor: 'Grocery Store',
                amount: '45.67'
              }
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const config = {
        categories: [
          { name: 'Receipts', description: 'Purchase receipts' }
        ],
        variables: [
          { name: 'vendor', description: 'Store name' },
          { name: 'amount', description: 'Total amount' }
        ]
      };

      const result = await aiService.analyzeImageWithVision('/path/to/image.png', config);

      expect(result.category).toBe('Receipts');
      expect(result.variables.vendor).toBe('Grocery Store');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o', // Should use updated model
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'image_url' })
              ])
            })
          ])
        })
      );
    });

    test('should handle image file read errors', async () => {
      jest.spyOn(require('fs'), 'readFileSync').mockImplementation(() => {
        throw new Error('File not found');
      });

      const config = {
        categories: [{ name: 'General', description: 'Other' }],
        variables: []
      };

      await expect(aiService.analyzeImageWithVision('/nonexistent.png', config))
        .rejects.toThrow('File not found');
    });
  });

  describe('Feedback Learning', () => {
    beforeEach(() => {
      aiService.initialize('test-api-key');
    });

    test('should include feedback in categorization prompt', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              category: 'Contracts',
              confidence: 0.8
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const categories = [
        { name: 'Contracts', description: 'Legal agreements' }
      ];

      const feedback = {
        recentCorrections: {
          categories: [{
            was: 'General',
            correctedTo: 'Contracts',
            because: 'Contains legal agreement terms'
          }]
        }
      };

      await aiService.categorizeDocument('Agreement text...', categories, 'general', feedback);

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('IMPORTANT LEARNING FROM USER CORRECTIONS');
      expect(callArgs.messages[0].content).toContain('corrected to "Contracts"');
    });
  });
});

module.exports = {
  testName: 'AIService Tests',
  description: 'Tests for OpenAI integration and document analysis'
};