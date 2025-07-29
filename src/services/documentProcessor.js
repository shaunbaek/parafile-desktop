const path = require('path');
const textExtractor = require('./textExtractor');
const aiService = require('./aiService');
const fileOrganizer = require('./fileOrganizer');
const errorHandler = require('../utils/errorHandler');

class DocumentProcessor {
  async processDocument(fileInfo, config) {
    const startTime = Date.now();
    const result = {
      filePath: fileInfo.path,
      fileName: path.basename(fileInfo.path),
      success: false,
      error: null,
      category: null,
      newName: null,
      processingTime: 0
    };

    try {
      console.log(`Processing document: ${result.fileName}`);
      
      // Extract text with retry mechanism
      const extractedData = await errorHandler.safeExecute(
        () => textExtractor.tryExtractWithRetry(fileInfo.path, fileInfo.type),
        `Text extraction for ${result.fileName}`
      );
      
      if (!extractedData || !extractedData.text || extractedData.text.trim().length === 0) {
        throw new Error('No meaningful text extracted from document');
      }

      // Categorize document with AI
      const categorization = await errorHandler.safeExecute(
        () => aiService.categorizeDocument(extractedData.text, config.categories),
        `AI categorization for ${result.fileName}`,
        { category: 'General', reasoning: 'Fallback due to AI error', confidence: 0 }
      );
      
      result.category = categorization.category;
      result.confidence = categorization.confidence;
      result.reasoning = categorization.reasoning;
      
      const originalNameWithoutExt = path.basename(fileInfo.path, path.extname(fileInfo.path));
      const category = config.categories.find(cat => cat.name === categorization.category);
      
      if (!category) {
        // Fallback to General category
        const generalCategory = config.categories.find(cat => cat.name === 'General');
        if (generalCategory) {
          result.category = 'General';
          category = generalCategory;
        } else {
          throw new Error(`No fallback category available`);
        }
      }
      
      // Generate filename with AI
      let finalName;
      if (category.naming_pattern.includes('{original_name}') && !category.naming_pattern.match(/\{(?!original_name\})[^}]+\}/)) {
        // Simple pattern with only original_name
        finalName = originalNameWithoutExt;
      } else {
        const generatedName = await errorHandler.safeExecute(
          () => aiService.generateFilename(category.naming_pattern, config.variables, extractedData.text),
          `Filename generation for ${result.fileName}`,
          category.naming_pattern
        );
        
        finalName = generatedName.replace('{original_name}', originalNameWithoutExt);
      }
      
      // Organize file
      const organizeResult = await errorHandler.safeExecute(
        () => fileOrganizer.processFile(fileInfo.path, category.name, finalName, config),
        `File organization for ${result.fileName}`
      );
      
      if (organizeResult && organizeResult.success) {
        result.success = true;
        result.newName = organizeResult.newName;
        result.newPath = organizeResult.newPath;
      } else {
        throw new Error(organizeResult ? organizeResult.error : 'File organization failed');
      }
      
    } catch (error) {
      errorHandler.logError(error, `Document processing for ${result.fileName}`);
      result.success = false;
      result.error = error.message;
      
      // Try to set a fallback category if not set
      if (!result.category) {
        result.category = 'General';
      }
    }

    result.processingTime = Date.now() - startTime;
    return result;
  }
}

module.exports = new DocumentProcessor();