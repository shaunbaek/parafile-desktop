const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class ConfigManager {
  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.logPath = path.join(app.getPath('userData'), 'processing-log.json');
    this.feedbackPath = path.join(app.getPath('userData'), 'feedback-learning.json');
    this.defaultConfig = {
      watched_folder: '',
      enable_organization: true,
      enable_desktop_notifications: true,
      auto_start_monitoring: false,
      openai_api_key: '',
      expertise: 'general',
      categories: [
        {
          name: 'General',
          description: 'Default category for uncategorized documents',
          shortDescription: 'Default category',
          naming_pattern: '{original_name}'
        }
      ],
      variables: [
        {
          name: 'original_name',
          description: 'The original filename without extension',
          formatting: 'none'
        }
      ]
    };
  }

  async load() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(data);
      return this.validateAndRepair(config);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.save(this.defaultConfig);
        return this.defaultConfig;
      }
      console.error('Error loading config:', error);
      return this.defaultConfig;
    }
  }

  async save(config) {
    try {
      // Ensure auto_start_monitoring is preserved
      if (config.auto_start_monitoring === undefined) {
        const existing = await this.load();
        config.auto_start_monitoring = existing.auto_start_monitoring || false;
      }
      const validatedConfig = this.validateAndRepair(config);
      await fs.writeFile(this.configPath, JSON.stringify(validatedConfig, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }

  validateAndRepair(config) {
    if (!config || typeof config !== 'object') {
      return this.defaultConfig;
    }

    const repaired = {
      watched_folder: config.watched_folder || '',
      enable_organization: config.enable_organization !== false,
      enable_desktop_notifications: config.enable_desktop_notifications !== false,
      auto_start_monitoring: config.auto_start_monitoring === true,
      openai_api_key: config.openai_api_key || '',
      expertise: config.expertise || 'general',
      categories: Array.isArray(config.categories) ? config.categories : [],
      variables: Array.isArray(config.variables) ? config.variables : []
    };

    const hasGeneral = repaired.categories.some(cat => cat.name === 'General');
    if (!hasGeneral) {
      repaired.categories.push(this.defaultConfig.categories[0]);
    }

    const hasOriginalName = repaired.variables.some(v => v.name === 'original_name');
    if (!hasOriginalName) {
      repaired.variables.push(this.defaultConfig.variables[0]);
    }

    repaired.categories = repaired.categories.filter(cat => 
      cat && cat.name && cat.description && cat.naming_pattern
    );

    repaired.variables = repaired.variables.filter(v => 
      v && v.name && v.description
    );

    // Add default formatting to variables that don't have it
    repaired.variables = repaired.variables.map(v => ({
      ...v,
      formatting: v.formatting || 'none'
    }));

    return repaired;
  }

  async addCategory(category) {
    try {
      const config = await this.load();
      
      // Check for duplicate names
      const exists = config.categories.some(cat => cat.name === category.name);
      if (exists) {
        return { success: false, error: `Category "${category.name}" already exists` };
      }
      
      config.categories.push(category);
      await this.save(config);
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateCategory(index, category) {
    try {
      const config = await this.load();
      if (config.categories[index] && config.categories[index].name !== 'General') {
        config.categories[index] = category;
        await this.save(config);
        return { success: true, data: config };
      }
      return { success: false, error: 'Cannot update General category or invalid index' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteCategory(index) {
    try {
      const config = await this.load();
      if (config.categories[index] && config.categories[index].name !== 'General') {
        config.categories.splice(index, 1);
        await this.save(config);
        return { success: true, data: config };
      }
      return { success: false, error: 'Cannot delete General category or invalid index' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addVariable(variable) {
    try {
      const config = await this.load();
      
      // Check for duplicate names
      const exists = config.variables.some(v => v.name === variable.name);
      if (exists) {
        return { success: false, error: `Variable "${variable.name}" already exists` };
      }
      
      config.variables.push(variable);
      await this.save(config);
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateVariable(index, variable) {
    try {
      const config = await this.load();
      if (config.variables[index] && config.variables[index].name !== 'original_name') {
        config.variables[index] = variable;
        await this.save(config);
        return { success: true, data: config };
      }
      return { success: false, error: 'Variable not found or cannot be updated' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteVariable(index) {
    try {
      const config = await this.load();
      if (config.variables[index] && config.variables[index].name !== 'original_name') {
        config.variables.splice(index, 1);
        await this.save(config);
        return { success: true, data: config };
      }
      return { success: false, error: 'original_name variable cannot be deleted' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateSettings(settings) {
    try {
      const config = await this.load();
      if (settings.watched_folder !== undefined) {
        config.watched_folder = settings.watched_folder;
      }
      if (settings.enable_organization !== undefined) {
        config.enable_organization = settings.enable_organization;
      }
      if (settings.openai_api_key !== undefined) {
        config.openai_api_key = settings.openai_api_key;
      }
      if (settings.expertise !== undefined) {
        config.expertise = settings.expertise;
      }
      await this.save(config);
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Processing Log Management
  async loadLog() {
    try {
      const data = await fs.readFile(this.logPath, 'utf8');
      const logs = JSON.parse(data);
      return Array.isArray(logs) ? logs : [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      console.error('Error loading processing log:', error);
      return [];
    }
  }

  async saveLog(logs) {
    try {
      // Keep only the last 100 entries
      const trimmedLogs = logs.slice(-100);
      await fs.writeFile(this.logPath, JSON.stringify(trimmedLogs, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving processing log:', error);
      return false;
    }
  }

  async addLogEntry(entry) {
    const logs = await this.loadLog();
    const logEntry = {
      id: Date.now() + Math.random(), // Unique ID
      timestamp: new Date().toISOString(),
      originalName: entry.originalName,
      parafileName: entry.parafileName,
      category: entry.category,
      reasoning: entry.reasoning,
      success: entry.success,
      corrected: false,
      corrections: [],
      tokenUsage: entry.tokenUsage || null // Track token usage and costs
    };
    
    logs.push(logEntry);
    await this.saveLog(logs);
    return logEntry;
  }

  async updateLogEntry(id, updates) {
    const logs = await this.loadLog();
    const index = logs.findIndex(log => log.id === id);
    
    if (index >= 0) {
      logs[index] = { ...logs[index], ...updates };
      await this.saveLog(logs);
      return logs[index];
    }
    
    return null;
  }

  async clearLog() {
    try {
      await fs.writeFile(this.logPath, JSON.stringify([], null, 2));
      return true;
    } catch (error) {
      console.error('Error clearing processing log:', error);
      return false;
    }
  }

  async isFileAlreadyProcessed(filename) {
    const logs = await this.loadLog();
    // Check if this filename exists as a parafileName in the log
    return logs.some(log => log.parafileName === filename && log.success);
  }

  async addLogCorrection(id, correction) {
    const logs = await this.loadLog();
    const index = logs.findIndex(log => log.id === id);
    
    if (index >= 0) {
      if (!logs[index].corrections) {
        logs[index].corrections = [];
      }
      
      // Create correction entry with the new structure
      const correctionEntry = {
        timestamp: correction.timestamp || new Date().toISOString(),
        user: 'user' // Could be extended for multi-user scenarios
      };
      
      // Handle name correction
      if (correction.newName !== undefined) {
        correctionEntry.oldName = logs[index].parafileName;
        correctionEntry.newName = correction.newName;
        correctionEntry.nameFeedback = correction.nameFeedback;
        logs[index].parafileName = correction.newName; // Update the displayed name
      }
      
      // Handle category correction
      if (correction.newCategory !== undefined) {
        correctionEntry.oldCategory = logs[index].category;
        correctionEntry.newCategory = correction.newCategory;
        correctionEntry.categoryFeedback = correction.categoryFeedback;
        logs[index].category = correction.newCategory; // Update the displayed category
      }
      
      logs[index].corrections.push(correctionEntry);
      logs[index].corrected = true;
      
      await this.saveLog(logs);
      
      // Store feedback for model retraining
      if (correction.nameFeedback || correction.categoryFeedback) {
        await this.storeFeedback({
          documentId: id,
          originalName: logs[index].originalName,
          originalCategory: correctionEntry.oldCategory,
          originalParafileName: correctionEntry.oldName,
          newName: correction.newName,
          nameFeedback: correction.nameFeedback,
          newCategory: correction.newCategory,
          categoryFeedback: correction.categoryFeedback,
          reasoning: logs[index].reasoning,
          timestamp: correctionEntry.timestamp
        });
      }
      
      return logs[index];
    }
    
    return null;
  }

  // Add variable correction to log entry
  async addVariableCorrection(logId, variableCorrection) {
    const logs = await this.loadLog();
    const index = logs.findIndex(log => log.id === logId);
    
    if (index >= 0) {
      if (!logs[index].variableCorrections) {
        logs[index].variableCorrections = [];
      }
      
      const correctionEntry = {
        variableName: variableCorrection.variableName,
        originalValue: variableCorrection.originalValue,
        correctedValue: variableCorrection.correctedValue,
        feedback: variableCorrection.feedback,
        confidence: variableCorrection.confidence,
        timestamp: new Date().toISOString()
      };
      
      logs[index].variableCorrections.push(correctionEntry);
      logs[index].corrected = true;
      
      await this.saveLog(logs);
      
      // Store feedback for learning with full context
      await this.storeFeedback({
        documentId: logId,
        variableName: variableCorrection.variableName,
        extractedValue: variableCorrection.originalValue,
        correctedValue: variableCorrection.correctedValue,
        variableFeedback: variableCorrection.feedback,
        originalName: logs[index].originalName,
        documentContext: variableCorrection.documentContext,
        extractionContext: variableCorrection.extractionContext,
        aiConfidence: variableCorrection.confidence,
        userConfidence: variableCorrection.userConfidence || 95,
        timestamp: correctionEntry.timestamp
      });
      
      return logs[index];
    }
    
    return null;
  }

  // Feedback Learning System
  async loadFeedback() {
    try {
      const data = await fs.readFile(this.feedbackPath, 'utf8');
      const feedback = JSON.parse(data);
      
      // Migrate old format to new format if needed
      if (!feedback.version || feedback.version < "2.0") {
        return this.migrateFeedbackFormat(feedback);
      }
      
      return feedback;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          version: "2.0",
          categoryCorrections: [],
          nameCorrections: [],
          variableCorrections: [],
          patterns: {},
          learning: {
            confidenceCalibration: {},
            contentPatterns: {},
            improvementMetrics: {
              totalCorrections: 0,
              accuracyTrend: []
            }
          },
          documentContexts: {},
          metadata: {
            totalCorrections: 0,
            learningRate: 0.0,
            lastUpdated: new Date().toISOString()
          }
        };
      }
      console.error('Error loading feedback:', error);
      return {
        version: "2.0",
        categoryCorrections: [],
        nameCorrections: [],
        variableCorrections: [],
        patterns: {},
        learning: {
          confidenceCalibration: {},
          contentPatterns: {},
          improvementMetrics: {
            totalCorrections: 0,
            accuracyTrend: []
          }
        },
        documentContexts: {},
        metadata: {
          totalCorrections: 0,
          learningRate: 0.0,
          lastUpdated: new Date().toISOString()
        }
      };
    }
  }

  // Migrate old feedback format to new enhanced format
  migrateFeedbackFormat(oldFeedback) {
    const newFeedback = {
      version: "2.0",
      categoryCorrections: oldFeedback.categoryCorrections || [],
      nameCorrections: oldFeedback.nameCorrections || [],
      variableCorrections: [],
      patterns: oldFeedback.patterns || {},
      learning: {
        confidenceCalibration: {},
        contentPatterns: {},
        improvementMetrics: {
          totalCorrections: (oldFeedback.categoryCorrections?.length || 0) + 
                           (oldFeedback.nameCorrections?.length || 0),
          accuracyTrend: []
        }
      },
      documentContexts: {},
      metadata: {
        totalCorrections: (oldFeedback.categoryCorrections?.length || 0) + 
                         (oldFeedback.nameCorrections?.length || 0),
        learningRate: 0.0,
        lastUpdated: new Date().toISOString()
      }
    };
    
    console.log('Migrated feedback to enhanced format v2.0');
    return newFeedback;
  }

  async saveFeedback(feedback) {
    try {
      await fs.writeFile(this.feedbackPath, JSON.stringify(feedback, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving feedback:', error);
      return false;
    }
  }

  async storeFeedback(feedbackData) {
    const feedback = await this.loadFeedback();
    
    // Store category corrections
    if (feedbackData.categoryFeedback) {
      feedback.categoryCorrections.push({
        originalCategory: feedbackData.originalCategory,
        newCategory: feedbackData.newCategory,
        feedback: feedbackData.categoryFeedback,
        reasoning: feedbackData.reasoning,
        documentName: feedbackData.originalName,
        timestamp: feedbackData.timestamp
      });
      
      // Update pattern recognition
      const patternKey = `${feedbackData.originalCategory}_to_${feedbackData.newCategory}`;
      if (!feedback.patterns[patternKey]) {
        feedback.patterns[patternKey] = {
          count: 0,
          examples: [],
          commonFeedback: []
        };
      }
      feedback.patterns[patternKey].count++;
      feedback.patterns[patternKey].examples.push(feedbackData.originalName);
      feedback.patterns[patternKey].commonFeedback.push(feedbackData.categoryFeedback);
    }
    
    // Store name corrections
    if (feedbackData.nameFeedback) {
      feedback.nameCorrections.push({
        originalName: feedbackData.originalParafileName,
        newName: feedbackData.newName,
        feedback: feedbackData.nameFeedback,
        documentName: feedbackData.originalName,
        timestamp: feedbackData.timestamp
      });
    }

    // Store variable corrections (NEW FEATURE)
    if (feedbackData.variableFeedback) {
      const variableCorrection = {
        documentId: feedbackData.documentId,
        variableName: feedbackData.variableName,
        extractedValue: feedbackData.extractedValue,
        correctedValue: feedbackData.correctedValue,
        feedback: feedbackData.variableFeedback,
        documentName: feedbackData.originalName,
        documentContext: feedbackData.documentContext,
        extractionContext: feedbackData.extractionContext,
        aiConfidence: feedbackData.aiConfidence,
        userConfidence: feedbackData.userConfidence || 95,
        timestamp: feedbackData.timestamp,
        sessionId: this.generateSessionId()
      };

      feedback.variableCorrections.push(variableCorrection);

      // Store document context for learning (prevents echo chamber)
      if (feedbackData.documentContext && feedbackData.documentId) {
        feedback.documentContexts[feedbackData.documentId] = {
          content: feedbackData.documentContext,
          structure: this.analyzeDocumentStructure(feedbackData.documentContext),
          keywords: this.extractKeywords(feedbackData.documentContext),
          variableExtractions: feedback.documentContexts[feedbackData.documentId]?.variableExtractions || {},
          feedbackHistory: feedback.documentContexts[feedbackData.documentId]?.feedbackHistory || []
        };

        // Add this specific variable extraction to the context
        feedback.documentContexts[feedbackData.documentId].variableExtractions[feedbackData.variableName] = {
          originalValue: feedbackData.extractedValue,
          correctedValue: feedbackData.correctedValue,
          extractionContext: feedbackData.extractionContext,
          confidence: feedbackData.aiConfidence,
          correctionReason: feedbackData.variableFeedback
        };

        // Track the complete feedback history to prevent echo chambers
        feedback.documentContexts[feedbackData.documentId].feedbackHistory.push({
          type: 'variable_correction',
          variableName: feedbackData.variableName,
          change: `${feedbackData.extractedValue} → ${feedbackData.correctedValue}`,
          reason: feedbackData.variableFeedback,
          timestamp: feedbackData.timestamp,
          sessionId: variableCorrection.sessionId
        });
      }

      // Update variable learning patterns
      const variableKey = feedbackData.variableName;
      if (!feedback.learning.contentPatterns[variableKey]) {
        feedback.learning.contentPatterns[variableKey] = {
          totalCorrections: 0,
          commonMistakes: {},
          successfulPatterns: {},
          contextPatterns: [],
          improvementRate: 0
        };
      }

      const pattern = feedback.learning.contentPatterns[variableKey];
      pattern.totalCorrections++;

      // Track common mistakes to avoid repeat errors
      const mistakeKey = `${feedbackData.extractedValue}_to_${feedbackData.correctedValue}`;
      if (!pattern.commonMistakes[mistakeKey]) {
        pattern.commonMistakes[mistakeKey] = {
          count: 0,
          contexts: [],
          feedbackReasons: []
        };
      }
      pattern.commonMistakes[mistakeKey].count++;
      pattern.commonMistakes[mistakeKey].contexts.push(feedbackData.extractionContext);
      pattern.commonMistakes[mistakeKey].feedbackReasons.push(feedbackData.variableFeedback);

      // Identify successful extraction patterns for future use
      if (feedbackData.extractionContext) {
        pattern.contextPatterns.push({
          context: feedbackData.extractionContext,
          correctValue: feedbackData.correctedValue,
          documentStructure: this.analyzeDocumentStructure(feedbackData.documentContext || ''),
          timestamp: feedbackData.timestamp
        });
      }
    }

    // Update metadata and learning metrics
    feedback.metadata.totalCorrections++;
    feedback.metadata.lastUpdated = new Date().toISOString();
    
    // Calculate learning rate (improvement over time)
    const recentCorrections = this.getRecentCorrections(feedback, 30); // Last 30 days
    const olderCorrections = this.getOlderCorrections(feedback, 30, 60); // 30-60 days ago
    
    if (olderCorrections.length > 0) {
      feedback.metadata.learningRate = Math.max(0, 
        (olderCorrections.length - recentCorrections.length) / olderCorrections.length
      );
    }

    await this.saveFeedback(feedback);
    return feedback;
  }

  // Helper methods for feedback analysis
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  analyzeDocumentStructure(content) {
    if (!content) return 'unknown';
    
    const hasLegalTerms = /\b(whereas|hereby|party|agreement|contract|terms|conditions)\b/i.test(content);
    const hasInvoiceTerms = /\b(invoice|bill|amount|total|due|payment)\b/i.test(content);
    const hasReportTerms = /\b(report|analysis|summary|findings|conclusion)\b/i.test(content);
    
    if (hasLegalTerms) return 'legal_document';
    if (hasInvoiceTerms) return 'financial_document';
    if (hasReportTerms) return 'report_document';
    return 'general_document';
  }

  extractKeywords(content) {
    if (!content) return [];
    
    // Simple keyword extraction - could be enhanced with NLP
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'were', 'said'].includes(word));
    
    // Get most frequent words
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  getRecentCorrections(feedback, daysAgo) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    
    const allCorrections = [
      ...feedback.categoryCorrections,
      ...feedback.nameCorrections,
      ...(feedback.variableCorrections || [])
    ];
    
    return allCorrections.filter(correction => 
      new Date(correction.timestamp) > cutoffDate
    );
  }

  getOlderCorrections(feedback, startDaysAgo, endDaysAgo) {
    const startDate = new Date();
    const endDate = new Date();
    startDate.setDate(startDate.getDate() - endDaysAgo);
    endDate.setDate(endDate.getDate() - startDaysAgo);
    
    const allCorrections = [
      ...feedback.categoryCorrections,
      ...feedback.nameCorrections,
      ...(feedback.variableCorrections || [])
    ];
    
    return allCorrections.filter(correction => {
      const correctionDate = new Date(correction.timestamp);
      return correctionDate >= startDate && correctionDate <= endDate;
    });
  }

  // Enhanced feedback retrieval with variable context
  async getRelevantFeedback(documentText, currentCategory, variableNames = []) {
    const feedback = await this.loadFeedback();
    const relevantFeedback = {
      categoryPatterns: [],
      namePatterns: [],
      variablePatterns: {},
      suggestions: [],
      echoPreventionData: {}
    };
    
    // Find patterns that might apply
    for (const [pattern, data] of Object.entries(feedback.patterns)) {
      if (data.count >= 2) { // Only consider patterns that occurred at least twice
        const [fromCat, toCat] = pattern.split('_to_');
        if (fromCat === currentCategory) {
          relevantFeedback.categoryPatterns.push({
            from: fromCat,
            to: toCat,
            occurrences: data.count,
            reason: data.commonFeedback[0] // Most common feedback
          });
        }
      }
    }
    
    // Get recent corrections (last 10)
    const recentCategoryCorrections = feedback.categoryCorrections
      .slice(-10)
      .map(c => ({
        was: c.originalCategory,
        correctedTo: c.newCategory,
        because: c.feedback
      }));
    
    const recentNameCorrections = feedback.nameCorrections
      .slice(-5)
      .map(n => ({
        was: n.originalName,
        correctedTo: n.newName,
        because: n.feedback
      }));
    
    // Get variable feedback patterns for requested variables
    for (const variableName of variableNames) {
      if (feedback.learning.contentPatterns[variableName]) {
        const pattern = feedback.learning.contentPatterns[variableName];
        
        relevantFeedback.variablePatterns[variableName] = {
          totalCorrections: pattern.totalCorrections,
          commonMistakes: Object.entries(pattern.commonMistakes)
            .filter(([, data]) => data.count >= 2)
            .map(([mistake, data]) => ({
              pattern: mistake,
              count: data.count,
              contexts: data.contexts.slice(-3), // Last 3 contexts
              reasons: [...new Set(data.feedbackReasons)] // Unique reasons
            })),
          successfulPatterns: pattern.contextPatterns
            .slice(-5) // Last 5 successful patterns
            .map(p => ({
              context: p.context,
              correctValue: p.correctValue,
              documentType: p.documentStructure
            }))
        };
      }
    }

    // Analyze document structure for relevant patterns
    const currentDocStructure = this.analyzeDocumentStructure(documentText);
    const currentKeywords = this.extractKeywords(documentText);
    
    // Find similar documents that were corrected to prevent echo chambers
    relevantFeedback.echoPreventionData = {
      similarDocuments: Object.entries(feedback.documentContexts)
        .filter(([, context]) => 
          context.structure === currentDocStructure ||
          context.keywords.some(keyword => currentKeywords.includes(keyword))
        )
        .slice(-3) // Last 3 similar documents
        .map(([docId, context]) => ({
          documentId: docId,
          corrections: context.feedbackHistory.length,
          lastCorrection: context.feedbackHistory[context.feedbackHistory.length - 1],
          commonPatterns: context.variableExtractions
        })),
      recentSessions: this.getRecentCorrections(feedback, 7) // Last week's corrections
        .map(c => c.sessionId)
        .filter((id, index, arr) => arr.indexOf(id) === index) // Unique session IDs
    };

    relevantFeedback.recentCorrections = {
      categories: recentCategoryCorrections,
      names: recentNameCorrections,
      variables: (feedback.variableCorrections || [])
        .slice(-5)
        .map(v => ({
          variable: v.variableName,
          was: v.extractedValue,
          correctedTo: v.correctedValue,
          because: v.feedback,
          confidence: v.aiConfidence
        }))
    };
    
    return relevantFeedback;
  }

  // Analyze feedback patterns for insights
  async analyzeFeedbackPatterns() {
    const feedback = await this.loadFeedback();
    const analysis = {
      mostCorrectedCategories: {},
      commonMistakes: [],
      improvementSuggestions: []
    };
    
    // Count category corrections
    feedback.categoryCorrections.forEach(correction => {
      const key = correction.originalCategory;
      if (!analysis.mostCorrectedCategories[key]) {
        analysis.mostCorrectedCategories[key] = {
          count: 0,
          correctedTo: {}
        };
      }
      analysis.mostCorrectedCategories[key].count++;
      
      if (!analysis.mostCorrectedCategories[key].correctedTo[correction.newCategory]) {
        analysis.mostCorrectedCategories[key].correctedTo[correction.newCategory] = 0;
      }
      analysis.mostCorrectedCategories[key].correctedTo[correction.newCategory]++;
    });
    
    // Identify common mistakes
    for (const [pattern, data] of Object.entries(feedback.patterns)) {
      if (data.count >= 3) {
        const [from, to] = pattern.split('_to_');
        analysis.commonMistakes.push({
          pattern: `Documents categorized as "${from}" should often be "${to}"`,
          frequency: data.count,
          examples: data.examples.slice(0, 3)
        });
      }
    }
    
    // Generate improvement suggestions
    if (analysis.commonMistakes.length > 0) {
      analysis.improvementSuggestions.push(
        'Consider updating category descriptions to be more specific',
        'Review the most commonly corrected categories for potential overlap'
      );
    }
    
    return analysis;
  }

  // Aliases for backward compatibility and testing
  async logProcessing(entry) {
    return await this.addLogEntry(entry);
  }

  async getProcessingLog() {
    return await this.loadLog();
  }
}

module.exports = new ConfigManager();