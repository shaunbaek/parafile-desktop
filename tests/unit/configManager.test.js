/**
 * Unit Tests for ConfigManager Service
 * Tests configuration management, validation, and persistence
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');

// Mock electron app for testing
const mockApp = {
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(os.tmpdir(), 'parafile-test-config');
    }
    return os.tmpdir();
  }
};

// Mock electron module
jest.mock('electron', () => ({
  app: mockApp
}));

const ConfigManager = require('../../src/config/configManager');

describe('ConfigManager Service', () => {
  let configManager;
  let testConfigDir;
  let testConfigPath;

  beforeEach(async () => {
    // Create test config directory
    testConfigDir = path.join(os.tmpdir(), 'parafile-test-config');
    testConfigPath = path.join(testConfigDir, 'config.json');
    
    if (!fsSync.existsSync(testConfigDir)) {
      await fs.mkdir(testConfigDir, { recursive: true });
    }

    // Create fresh config manager instance
    configManager = new (require('../../src/config/configManager').constructor)();
  });

  afterEach(async () => {
    // Clean up test files
    try {
      if (fsSync.existsSync(testConfigPath)) {
        await fs.unlink(testConfigPath);
      }
      await fs.rm(testConfigDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration Loading', () => {
    test('should load default config when file does not exist', async () => {
      const config = await configManager.load();
      
      expect(config).toBeDefined();
      expect(config.watched_folder).toBe('');
      expect(config.enable_organization).toBe(true);
      expect(config.enable_desktop_notifications).toBe(true);
      expect(config.auto_start_monitoring).toBe(false);
      expect(config.categories).toBeDefined();
      expect(config.variables).toBeDefined();
    });

    test('should load existing config file', async () => {
      const testConfig = {
        watched_folder: '/test/folder',
        enable_organization: true,
        enable_desktop_notifications: false,
        auto_start_monitoring: true,
        openai_api_key: 'test-key',
        expertise: 'legal',
        categories: [
          { name: 'Test', description: 'Test category', naming_pattern: '{test}' }
        ],
        variables: [
          { name: 'test', description: 'Test variable', formatting: 'none' }
        ]
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));
      
      const config = await configManager.load();
      
      expect(config.watched_folder).toBe('/test/folder');
      expect(config.auto_start_monitoring).toBe(true);
      expect(config.expertise).toBe('legal');
    });

    test('should handle corrupted config file', async () => {
      await fs.writeFile(testConfigPath, 'invalid json content');
      
      const config = await configManager.load();
      
      // Should fall back to default config
      expect(config.watched_folder).toBe('');
      expect(config.categories).toBeDefined();
    });
  });

  describe('Configuration Saving', () => {
    test('should save config to file', async () => {
      const testConfig = {
        watched_folder: '/new/folder',
        enable_organization: false,
        auto_start_monitoring: true,
        openai_api_key: 'new-key'
      };

      const result = await configManager.save(testConfig);
      
      expect(result).toBe(true);
      expect(fsSync.existsSync(testConfigPath)).toBe(true);
      
      const savedContent = await fs.readFile(testConfigPath, 'utf8');
      const savedConfig = JSON.parse(savedContent);
      
      expect(savedConfig.watched_folder).toBe('/new/folder');
      expect(savedConfig.auto_start_monitoring).toBe(true);
    });

    test('should preserve auto_start_monitoring when undefined', async () => {
      // First save with auto_start_monitoring true
      await configManager.save({ auto_start_monitoring: true });
      
      // Then save without auto_start_monitoring field
      const result = await configManager.save({ watched_folder: '/test' });
      
      expect(result).toBe(true);
      
      const config = await configManager.load();
      expect(config.auto_start_monitoring).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate and repair missing fields', () => {
      const invalidConfig = {
        watched_folder: '/test'
        // Missing other required fields
      };

      const repaired = configManager.validateAndRepair(invalidConfig);
      
      expect(repaired.enable_organization).toBe(true);
      expect(repaired.enable_desktop_notifications).toBe(true);
      expect(repaired.auto_start_monitoring).toBe(false);
      expect(repaired.categories).toBeDefined();
      expect(repaired.variables).toBeDefined();
    });

    test('should ensure General category exists', () => {
      const configWithoutGeneral = {
        categories: [
          { name: 'Custom', description: 'Custom category', naming_pattern: '{custom}' }
        ],
        variables: []
      };

      const repaired = configManager.validateAndRepair(configWithoutGeneral);
      
      const generalCategory = repaired.categories.find(cat => cat.name === 'General');
      expect(generalCategory).toBeDefined();
    });

    test('should ensure original_name variable exists', () => {
      const configWithoutOriginalName = {
        categories: [],
        variables: [
          { name: 'custom', description: 'Custom variable', formatting: 'none' }
        ]
      };

      const repaired = configManager.validateAndRepair(configWithoutOriginalName);
      
      const originalNameVar = repaired.variables.find(v => v.name === 'original_name');
      expect(originalNameVar).toBeDefined();
    });
  });

  describe('Category Management', () => {
    test('should add new category', async () => {
      const newCategory = {
        name: 'Invoices',
        description: 'Invoice documents',
        naming_pattern: '{date}_{vendor}'
      };

      const result = await configManager.addCategory(newCategory);
      
      expect(result.success).toBe(true);
      
      const config = await configManager.load();
      const addedCategory = config.categories.find(cat => cat.name === 'Invoices');
      expect(addedCategory).toBeDefined();
      expect(addedCategory.description).toBe('Invoice documents');
    });

    test('should prevent duplicate category names', async () => {
      await configManager.addCategory({
        name: 'Test',
        description: 'First test',
        naming_pattern: '{test}'
      });

      const result = await configManager.addCategory({
        name: 'Test',
        description: 'Second test',
        naming_pattern: '{test2}'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    test('should update existing category', async () => {
      await configManager.addCategory({
        name: 'Test',
        description: 'Original description',
        naming_pattern: '{original}'
      });

      const result = await configManager.updateCategory(0, {
        name: 'Test',
        description: 'Updated description',
        naming_pattern: '{updated}'
      });

      expect(result.success).toBe(true);
      
      const config = await configManager.load();
      const updatedCategory = config.categories.find(cat => cat.name === 'Test');
      expect(updatedCategory.description).toBe('Updated description');
    });

    test('should delete category except General', async () => {
      await configManager.addCategory({
        name: 'Deletable',
        description: 'Can be deleted',
        naming_pattern: '{test}'
      });

      const result = await configManager.deleteCategory(0);
      expect(result.success).toBe(true);

      // Try to delete General category (should fail)
      const config = await configManager.load();
      const generalIndex = config.categories.findIndex(cat => cat.name === 'General');
      
      const generalDeleteResult = await configManager.deleteCategory(generalIndex);
      expect(generalDeleteResult.success).toBe(false);
    });
  });

  describe('Variable Management', () => {
    test('should add new variable', async () => {
      const newVariable = {
        name: 'invoice_number',
        description: 'Invoice number from document',
        formatting: 'uppercase'
      };

      const result = await configManager.addVariable(newVariable);
      
      expect(result.success).toBe(true);
      
      const config = await configManager.load();
      const addedVariable = config.variables.find(v => v.name === 'invoice_number');
      expect(addedVariable).toBeDefined();
      expect(addedVariable.formatting).toBe('uppercase');
    });

    test('should prevent duplicate variable names', async () => {
      await configManager.addVariable({
        name: 'test_var',
        description: 'First test variable',
        formatting: 'none'
      });

      const result = await configManager.addVariable({
        name: 'test_var',
        description: 'Second test variable',
        formatting: 'lowercase'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    test('should not delete original_name variable', async () => {
      const config = await configManager.load();
      const originalNameIndex = config.variables.findIndex(v => v.name === 'original_name');
      
      const result = await configManager.deleteVariable(originalNameIndex);
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be deleted');
    });
  });

  describe('Settings Management', () => {
    test('should update settings', async () => {
      const newSettings = {
        openai_api_key: 'new-api-key',
        enable_desktop_notifications: false,
        auto_start_monitoring: true
      };

      const result = await configManager.updateSettings(newSettings);
      
      expect(result.success).toBe(true);
      
      const config = await configManager.load();
      expect(config.openai_api_key).toBe('new-api-key');
      expect(config.enable_desktop_notifications).toBe(false);
      expect(config.auto_start_monitoring).toBe(true);
    });
  });

  describe('Processing Log', () => {
    test('should log processing results', async () => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        fileName: 'test.pdf',
        success: true,
        category: 'Test',
        processingTime: 1500
      };

      await configManager.logProcessing(logEntry);
      
      const logs = await configManager.getProcessingLog();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].fileName).toBe('test.pdf');
    });

    test('should limit log size', async () => {
      // Add many log entries
      for (let i = 0; i < 1500; i++) {
        await configManager.logProcessing({
          timestamp: new Date().toISOString(),
          fileName: `test-${i}.pdf`,
          success: true
        });
      }

      const logs = await configManager.getProcessingLog();
      expect(logs.length).toBeLessThanOrEqual(1000); // Should be limited to 1000
    });
  });
});

module.exports = {
  testName: 'ConfigManager Service Tests',
  description: 'Comprehensive tests for configuration management and persistence'
};