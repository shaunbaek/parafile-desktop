/**
 * Comprehensive Tests for Enhanced Feedback System
 * Tests variable feedback, learning patterns, and echo prevention
 */

const configManager = require('../../src/config/configManager');
const aiService = require('../../src/services/aiService');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

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

describe('Enhanced Feedback System', () => {
  let testConfigPath;
  let testFeedbackPath;
  let mockOpenAI;

  beforeEach(async () => {
    // Create temporary directories for testing
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parafile-feedback-test-'));
    testConfigPath = path.join(tempDir, 'config.json');
    testFeedbackPath = path.join(tempDir, 'feedback.json');
    const testLogPath = path.join(tempDir, 'processing-log.json');
    
    // Set test paths
    configManager.configPath = testConfigPath;
    configManager.feedbackPath = testFeedbackPath;
    configManager.logPath = testLogPath;
    
    // Setup mock AI service
    const OpenAI = require('openai');
    mockOpenAI = new OpenAI();
    aiService.initialize('test-api-key');
    aiService.openai = mockOpenAI;
    
    // Mock model selector
    aiService.modelSelector = {
      selectModel: jest.fn().mockResolvedValue({
        selectedModel: 'gpt-4o-mini',
        reasoning: 'Test model selection',
        estimatedCost: 0.001,
        confidence: 90
      })
    };
    
    // Setup base config
    const baseConfig = {
      categories: [
        {
          name: 'Financial',
          description: 'Financial documents like invoices and receipts',
          naming_pattern: '{client_name}_{date}_{amount}'
        },
        {
          name: 'Legal',
          description: 'Legal contracts and agreements',
          naming_pattern: '{party_a}_{contract_type}_{date}'
        }
      ],
      variables: [
        {
          name: 'client_name',
          description: 'Name of the client or company'
        },
        {
          name: 'date',
          description: 'Document date in YYYY-MM-DD format'
        },
        {
          name: 'amount',
          description: 'Total amount or value mentioned in the document'
        }
      ]
    };
    
    await fs.writeFile(testConfigPath, JSON.stringify(baseConfig, null, 2));
  });

  afterEach(async () => {
    jest.clearAllMocks();
    
    // Cleanup test files
    try {
      await fs.unlink(testConfigPath);
      await fs.unlink(testFeedbackPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Variable Feedback Storage', () => {
    test('should store variable corrections with context', async () => {
      const variableCorrection = {
        variableName: 'client_name',
        originalValue: 'ABC Corp',
        correctedValue: 'ABC Corporation Ltd',
        feedback: 'Use full legal name from signature block',
        confidence: 85,
        documentContext: 'This agreement is between ABC Corp and...',
        extractionContext: 'Found in header section',
        userConfidence: 95
      };

      // Create a test log entry first
      const logEntry = await configManager.addLogEntry({
        originalName: 'contract.pdf',
        parafileName: 'ABC_Corp_Contract_2025-08-12.pdf',
        category: 'Legal',
        reasoning: 'Legal contract document',
        success: true
      });

      const result = await configManager.addVariableCorrection(logEntry.id, variableCorrection);
      
      expect(result).toBeTruthy();
      expect(result.variableCorrections).toHaveLength(1);
      expect(result.variableCorrections[0].variableName).toBe('client_name');
      expect(result.variableCorrections[0].correctedValue).toBe('ABC Corporation Ltd');

      // Verify feedback was stored
      const feedback = await configManager.loadFeedback();
      expect(feedback.variableCorrections).toHaveLength(1);
      expect(feedback.variableCorrections[0].variableName).toBe('client_name');
      expect(feedback.variableCorrections[0].feedback).toBe('Use full legal name from signature block');
    });

    test('should track document context and prevent echo chambers', async () => {
      const feedbackData = {
        documentId: 'doc-1',
        variableName: 'client_name',
        extractedValue: 'ABC Corp',
        correctedValue: 'ABC Corporation Ltd',
        variableFeedback: 'Use full legal name',
        documentContext: 'Legal contract with ABC Corp as party A...',
        extractionContext: 'Header section',
        aiConfidence: 80,
        originalName: 'contract.pdf',
        timestamp: new Date().toISOString()
      };

      await configManager.storeFeedback(feedbackData);
      
      const feedback = await configManager.loadFeedback();
      
      // Check document context storage
      expect(feedback.documentContexts['doc-1']).toBeDefined();
      expect(feedback.documentContexts['doc-1'].structure).toBe('legal_document');
      expect(feedback.documentContexts['doc-1'].keywords).toContain('legal');
      expect(feedback.documentContexts['doc-1'].feedbackHistory).toHaveLength(1);
      
      // Check variable extraction context
      expect(feedback.documentContexts['doc-1'].variableExtractions['client_name']).toBeDefined();
      expect(feedback.documentContexts['doc-1'].variableExtractions['client_name'].correctedValue).toBe('ABC Corporation Ltd');
    });

    test('should build learning patterns from multiple corrections', async () => {
      // Add multiple corrections for the same variable
      const corrections = [
        {
          documentId: 'doc-1',
          variableName: 'client_name',
          extractedValue: 'ABC Corp',
          correctedValue: 'ABC Corporation Ltd',
          variableFeedback: 'Use full legal name',
          originalName: 'contract1.pdf',
          timestamp: new Date().toISOString()
        },
        {
          documentId: 'doc-2',
          variableName: 'client_name',
          extractedValue: 'ABC Corp',
          correctedValue: 'ABC Corporation Ltd',
          variableFeedback: 'Always use complete company name',
          originalName: 'contract2.pdf',
          timestamp: new Date().toISOString()
        },
        {
          documentId: 'doc-3',
          variableName: 'client_name',
          extractedValue: 'XYZ Inc',
          correctedValue: 'XYZ Incorporated',
          variableFeedback: 'Spell out Inc as Incorporated',
          originalName: 'invoice.pdf',
          timestamp: new Date().toISOString()
        }
      ];

      for (const correction of corrections) {
        await configManager.storeFeedback(correction);
      }

      const feedback = await configManager.loadFeedback();
      
      // Check learning patterns
      expect(feedback.learning.contentPatterns['client_name']).toBeDefined();
      expect(feedback.learning.contentPatterns['client_name'].totalCorrections).toBe(3);
      expect(feedback.learning.contentPatterns['client_name'].commonMistakes).toHaveProperty('ABC Corp_to_ABC Corporation Ltd');
      expect(feedback.learning.contentPatterns['client_name'].commonMistakes['ABC Corp_to_ABC Corporation Ltd'].count).toBe(2);
    });
  });

  describe('Feedback Retrieval and Context', () => {
    test('should provide relevant variable feedback for AI extraction', async () => {
      // Setup feedback data
      const feedbackData = {
        documentId: 'doc-1',
        variableName: 'client_name',
        extractedValue: 'ABC Corp',
        correctedValue: 'ABC Corporation Ltd',
        variableFeedback: 'Use full legal name from signature',
        documentContext: 'Legal contract between ABC Corp and XYZ...',
        extractionContext: 'Header section, party identification',
        originalName: 'contract.pdf',
        timestamp: new Date().toISOString()
      };

      await configManager.storeFeedback(feedbackData);

      // Get relevant feedback
      const relevantFeedback = await configManager.getRelevantFeedback(
        'Legal contract between ABC Corp and XYZ Inc...',
        'Legal',
        ['client_name', 'date']
      );

      expect(relevantFeedback.variablePatterns['client_name']).toBeDefined();
      expect(relevantFeedback.variablePatterns['client_name'].totalCorrections).toBe(1);
      expect(relevantFeedback.variablePatterns['client_name'].commonMistakes).toHaveLength(1);
      expect(relevantFeedback.echoPreventionData.similarDocuments).toHaveLength(1);
    });

    test('should identify similar documents for consistency', async () => {
      // Add feedback for similar documents
      const docs = [
        {
          documentId: 'legal-1',
          documentContext: 'Legal contract with specific terms and conditions...',
          variableName: 'client_name',
          extractedValue: 'ABC Corp',
          correctedValue: 'ABC Corporation Ltd',
          variableFeedback: 'Use legal entity name',
          originalName: 'contract1.pdf',
          timestamp: new Date().toISOString()
        },
        {
          documentId: 'legal-2', 
          documentContext: 'Agreement between parties with legal obligations...',
          variableName: 'client_name',
          extractedValue: 'XYZ Inc',
          correctedValue: 'XYZ Incorporated',
          variableFeedback: 'Spell out incorporation type',
          originalName: 'agreement.pdf',
          timestamp: new Date().toISOString()
        }
      ];

      for (const doc of docs) {
        await configManager.storeFeedback(doc);
      }

      // Query with similar document
      const feedback = await configManager.getRelevantFeedback(
        'Legal agreement with contractual obligations...',
        'Legal',
        ['client_name']
      );

      expect(feedback.echoPreventionData.similarDocuments.length).toBeGreaterThan(0);
      expect(feedback.echoPreventionData.similarDocuments[0].documentId).toMatch(/legal-/);
    });
  });

  describe('AI Service Integration', () => {
    test('should use feedback in variable extraction', async () => {
      // Setup mock response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              value: 'ABC Corporation Ltd',
              confidence: 95,
              context: 'Found in signature block',
              consideringFeedback: true
            })
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      });

      // Setup feedback
      const feedback = {
        variablePatterns: {
          'client_name': {
            commonMistakes: [{
              pattern: 'ABC Corp_to_ABC Corporation Ltd',
              count: 3,
              contexts: ['header', 'signature'],
              reasons: ['Use full legal name']
            }],
            successfulPatterns: [{
              context: 'signature block',
              correctValue: 'ABC Corporation Ltd',
              documentType: 'legal_document'
            }]
          }
        }
      };

      const variable = {
        name: 'client_name',
        description: 'Name of the client company'
      };

      const result = await aiService.extractVariable(
        'Contract with ABC Corp...',
        variable,
        feedback
      );

      expect(result.value).toBe('ABC Corporation Ltd');
      expect(result.consideringFeedback).toBe(true);
      
      // Verify feedback was included in prompt
      const mockCall = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(mockCall.messages[0].content).toContain('IMPORTANT LEARNING FROM USER CORRECTIONS');
      expect(mockCall.messages[0].content).toContain('ABC Corp');
      expect(mockCall.messages[0].content).toContain('ABC Corporation Ltd');
    });

    test('should handle feedback gracefully when none available', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              value: 'XYZ Company',
              confidence: 80,
              context: 'Document header'
            })
          }
        }],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 40,
          total_tokens: 120
        }
      });

      const variable = {
        name: 'client_name',
        description: 'Name of the client company'
      };

      const result = await aiService.extractVariable(
        'Invoice from XYZ Company...',
        variable,
        null
      );

      expect(result.value).toBe('XYZ Company');
      expect(result.confidence).toBe(80);
    });
  });

  describe('Learning Rate and Analytics', () => {
    test('should calculate learning rate based on correction trends', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      const fiftyDaysAgo = new Date(now.getTime() - (50 * 24 * 60 * 60 * 1000));

      // Add older corrections (should show improvement)
      const olderCorrections = [
        {
          documentId: 'old-1',
          variableName: 'client_name',
          extractedValue: 'Wrong Name',
          correctedValue: 'Correct Name',
          variableFeedback: 'Fix this',
          originalName: 'old1.pdf',
          timestamp: fiftyDaysAgo.toISOString()
        },
        {
          documentId: 'old-2',
          variableName: 'client_name',
          extractedValue: 'Another Wrong',
          correctedValue: 'Another Correct',
          variableFeedback: 'Fix this too',
          originalName: 'old2.pdf',
          timestamp: fiftyDaysAgo.toISOString()
        }
      ];

      // Add recent correction (fewer = improvement)
      const recentCorrection = {
        documentId: 'recent-1',
        variableName: 'client_name',
        extractedValue: 'Recent Wrong',
        correctedValue: 'Recent Correct',
        variableFeedback: 'Minor fix',
        originalName: 'recent.pdf',
        timestamp: now.toISOString()
      };

      // Store feedback
      for (const correction of olderCorrections) {
        await configManager.storeFeedback(correction);
      }
      await configManager.storeFeedback(recentCorrection);

      const feedback = await configManager.loadFeedback();
      
      // Learning rate should be positive (improvement)
      expect(feedback.metadata.learningRate).toBeGreaterThan(0);
      expect(feedback.metadata.totalCorrections).toBe(3);
    });

    test('should track improvement metrics over time', async () => {
      const feedback = await configManager.loadFeedback();
      
      // Initial state
      expect(feedback.learning.improvementMetrics).toBeDefined();
      expect(feedback.learning.improvementMetrics.totalCorrections).toBe(0);

      // Add some corrections
      await configManager.storeFeedback({
        documentId: 'test-1',
        variableName: 'test_var',
        extractedValue: 'wrong',
        correctedValue: 'right',
        variableFeedback: 'test feedback',
        originalName: 'test.pdf',
        timestamp: new Date().toISOString()
      });

      const updatedFeedback = await configManager.loadFeedback();
      expect(updatedFeedback.metadata.totalCorrections).toBe(1);
    });
  });

  describe('Migration and Compatibility', () => {
    test('should migrate old feedback format to new format', async () => {
      // Create old format feedback
      const oldFeedback = {
        categoryCorrections: [
          {
            originalCategory: 'General',
            newCategory: 'Financial',
            feedback: 'This is financial',
            timestamp: new Date().toISOString()
          }
        ],
        nameCorrections: [],
        patterns: {}
      };

      await fs.writeFile(testFeedbackPath, JSON.stringify(oldFeedback, null, 2));

      // Load should trigger migration
      const newFeedback = await configManager.loadFeedback();

      expect(newFeedback.version).toBe('2.0');
      expect(newFeedback.variableCorrections).toBeDefined();
      expect(newFeedback.learning).toBeDefined();
      expect(newFeedback.documentContexts).toBeDefined();
      expect(newFeedback.categoryCorrections).toHaveLength(1);
    });

    test('should handle corrupted feedback files gracefully', async () => {
      // Create corrupted file
      await fs.writeFile(testFeedbackPath, 'invalid json content');

      // Should return default structure without crashing
      const feedback = await configManager.loadFeedback();
      
      expect(feedback.version).toBe('2.0');
      expect(feedback.variableCorrections).toEqual([]);
      expect(feedback.learning).toBeDefined();
    });
  });

  describe('Echo Prevention', () => {
    test('should identify potential echo chamber scenarios', async () => {
      // Create multiple corrections for same document type
      const sessionId = configManager.generateSessionId();
      
      const corrections = [
        {
          documentId: 'echo-test-1',
          variableName: 'client_name',
          extractedValue: 'Test Corp',
          correctedValue: 'Test Corporation',
          variableFeedback: 'Use full name',
          documentContext: 'Legal contract with Test Corp...',
          originalName: 'contract1.pdf',
          timestamp: new Date().toISOString()
        },
        {
          documentId: 'echo-test-2',
          variableName: 'client_name',
          extractedValue: 'Test Corporation',
          correctedValue: 'Test Corp',
          variableFeedback: 'Actually use short name',
          documentContext: 'Another legal contract with Test Corporation...',
          originalName: 'contract2.pdf',
          timestamp: new Date().toISOString()
        }
      ];

      for (const correction of corrections) {
        await configManager.storeFeedback(correction);
      }

      const feedback = await configManager.getRelevantFeedback(
        'Legal contract with Test Corporation...',
        'Legal',
        ['client_name']
      );

      // Should identify conflicting corrections
      expect(feedback.variablePatterns['client_name'].commonMistakes.length).toBeGreaterThan(0);
      expect(feedback.echoPreventionData.similarDocuments.length).toBeGreaterThan(0);
    });
  });
});