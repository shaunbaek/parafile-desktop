const path = require('path');
const textExtractor = require('./textExtractor');
const aiService = require('./aiService');
const fileOrganizer = require('./fileOrganizer');
const errorHandler = require('../utils/errorHandler');
const configManager = require('../config/configManager');

class DocumentProcessor {
  // Apply formatting to a text value based on the specified format
  applyFormatting(text, format) {
    if (!text || !format || format === 'none') return text;
    
    switch (format) {
      case 'uppercase':
        return text.toUpperCase();
      case 'lowercase':
        return text.toLowerCase();
      case 'title':
        return text.replace(/\w\S*/g, txt => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
      case 'sentence':
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
      case 'kebab':
        return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      case 'snake':
        return text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      case 'camel':
        return text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
          index === 0 ? word.toLowerCase() : word.toUpperCase()
        ).replace(/\s+/g, '');
      case 'pascal':
        return text.replace(/(?:^\w|[A-Z]|\b\w)/g, word => 
          word.toUpperCase()
        ).replace(/\s+/g, '');
      default:
        return text;
    }
  }

  extractVariablesFromPattern(pattern) {
    const matches = pattern.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return matches.map(match => match.slice(1, -1));
  }

  applyNamingPattern(pattern, values) {
    let result = pattern;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  /**
   * Track token usage from AI operations
   * @param {Object} result - The processing result object
   * @param {Object} operationResult - Result from AI operation containing tokenUsage
   * @param {string} operation - Description of the operation
   */
  trackTokenUsage(result, operationResult, operation) {
    if (operationResult && operationResult.tokenUsage) {
      const usage = operationResult.tokenUsage;
      result.tokenUsage.operations.push({
        operation,
        tokens: usage.totalTokens || (usage.promptTokens + usage.completionTokens) || 0,
        cost: usage.estimatedCost || 0,
        model: operation.includes('audio') ? 'whisper-1' : 'gpt-4o-mini'
      });
      
      result.tokenUsage.totalTokens += usage.totalTokens || (usage.promptTokens + usage.completionTokens) || 0;
      result.tokenUsage.totalCost += usage.estimatedCost || 0;
    }
  }

  async processDocument(fileInfo, config) {
    const startTime = Date.now();
    const result = {
      filePath: fileInfo.path,
      fileName: path.basename(fileInfo.path),
      success: false,
      error: null,
      category: null,
      newName: null,
      processingTime: 0,
      tokenUsage: {
        totalTokens: 0,
        totalCost: 0,
        operations: []
      }
    };

    try {
      console.log(`Processing document: ${result.fileName}`);
      
      // Check if this file has already been processed by ParaFile
      const isAlreadyProcessed = await configManager.isFileAlreadyProcessed(result.fileName);
      
      // Initialize AI service with API key from config
      if (config.openai_api_key) {
        aiService.initialize(config.openai_api_key);
        textExtractor.initialize(config.openai_api_key); // For audio transcription
      }
      
      // Extract text with retry mechanism
      const extractedData = await errorHandler.safeExecute(
        () => textExtractor.tryExtractWithRetry(fileInfo.path, fileInfo.type),
        `Text extraction for ${result.fileName}`
      );
      
      // Track audio transcription token usage if this was an audio file
      if (extractedData && extractedData.tokenUsage) {
        this.trackTokenUsage(result, extractedData, 'audio_transcription');
      }
      
      // Handle different file types for categorization
      let categorization;
      let feedback = null; // Initialize feedback for variable extraction
      const isImageFile = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'].includes(
        path.extname(fileInfo.path).toLowerCase()
      );
      
      if (isImageFile) {
        // Use Vision API for images
        categorization = await errorHandler.safeExecute(
          () => aiService.analyzeImageWithVision(fileInfo.path, config.categories, config.expertise),
          `Vision API analysis for ${result.fileName}`,
          { category: 'General', reasoning: 'Fallback due to Vision API error', confidence: 0 }
        );
        
        // If Vision API extracted text, add it to extractedData
        if (categorization.extractedText) {
          extractedData.text = (extractedData.text || '') + '\n' + categorization.extractedText;
        }
      } else {
        // Use regular text categorization for documents and spreadsheets
        if (!extractedData || !extractedData.text || extractedData.text.trim().length === 0) {
          throw new Error('No meaningful text extracted from document');
        }
        
        // Get feedback for AI improvement (including variable names)
        const requiredVars = [];
        feedback = await errorHandler.safeExecute(
          () => configManager.getRelevantFeedback(extractedData.text, 'General', requiredVars),
          `Feedback retrieval for ${result.fileName}`,
          null
        );
        
        // Categorize document with AI (including feedback)
        categorization = await errorHandler.safeExecute(
          () => aiService.categorizeDocument(extractedData.text, config.categories, config.expertise, feedback),
          `AI categorization for ${result.fileName}`,
          { category: 'General', reasoning: 'Fallback due to AI error', confidence: 0 }
        );
        
        // Track categorization token usage
        this.trackTokenUsage(result, categorization, 'document_categorization');
      }
      
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
      
      // Generate filename with AI (skip if already processed)
      let finalName;
      if (isAlreadyProcessed) {
        // File was already renamed by ParaFile, keep the current name
        console.log(`File already processed by ParaFile, keeping name: ${result.fileName}`);
        finalName = originalNameWithoutExt;
      } else if (category.naming_pattern.includes('{original_name}') && !category.naming_pattern.match(/\{(?!original_name\})[^}]+\}/)) {
        // Simple pattern with only original_name
        finalName = originalNameWithoutExt;
      } else {
        // Extract variables with formatting
        const variableValues = {};
        const requiredVariables = this.extractVariablesFromPattern(category.naming_pattern);
        
        for (const varName of requiredVariables) {
          if (varName === 'original_name') {
            const originalNameVar = config.variables.find(v => v.name === 'original_name');
            if (originalNameVar && originalNameVar.formatting && originalNameVar.formatting !== 'none') {
              variableValues[varName] = this.applyFormatting(originalNameWithoutExt, originalNameVar.formatting);
            } else {
              variableValues[varName] = originalNameWithoutExt;
            }
            continue;
          }
          
          const variable = config.variables.find(v => v.name === varName);
          if (variable) {
            const extractResult = await errorHandler.safeExecute(
              () => aiService.extractVariable(extractedData.text, variable, feedback),
              `Variable extraction for ${varName}`,
              { value: `<${varName.toUpperCase()}>` }
            );
            
            // Track variable extraction token usage
            this.trackTokenUsage(result, extractResult, `variable_extraction_${varName}`);
            
            // Apply formatting to the extracted value
            let value = extractResult.value || `<${varName.toUpperCase()}>`;
            if (variable.formatting && variable.formatting !== 'none') {
              value = this.applyFormatting(value, variable.formatting);
            }
            variableValues[varName] = value;
          } else {
            variableValues[varName] = `<${varName.toUpperCase()}>`;
          }
        }
        
        // Apply the naming pattern with formatted values
        finalName = this.applyNamingPattern(category.naming_pattern, variableValues);
      }
      
      // Organize file (skip rename if already processed)
      const organizeResult = await errorHandler.safeExecute(
        () => fileOrganizer.processFile(fileInfo.path, category.name, finalName, config, isAlreadyProcessed),
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
      result.errorStack = error.stack;
      
      // Determine processing step based on error context
      if (error.message.includes('extract')) {
        result.processingStep = 'text_extraction';
      } else if (error.message.includes('categoriz')) {
        result.processingStep = 'ai_categorization';
      } else if (error.message.includes('variable')) {
        result.processingStep = 'variable_extraction';
      } else if (error.message.includes('API key') || error.message.includes('OpenAI')) {
        result.processingStep = 'ai_categorization';
      } else if (error.message.includes('file') || error.message.includes('access')) {
        result.processingStep = 'file_access';
      } else if (error.message.includes('organiz') || error.message.includes('move')) {
        result.processingStep = 'file_organization';
      } else {
        result.processingStep = 'unknown';
      }
      
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