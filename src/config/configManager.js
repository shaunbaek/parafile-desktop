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
    const config = await this.load();
    config.categories.push(category);
    await this.save(config);
    return config;
  }

  async updateCategory(index, category) {
    const config = await this.load();
    if (config.categories[index] && config.categories[index].name !== 'General') {
      config.categories[index] = category;
      await this.save(config);
    }
    return config;
  }

  async deleteCategory(index) {
    const config = await this.load();
    if (config.categories[index] && config.categories[index].name !== 'General') {
      config.categories.splice(index, 1);
      await this.save(config);
    }
    return config;
  }

  async addVariable(variable) {
    const config = await this.load();
    config.variables.push(variable);
    await this.save(config);
    return config;
  }

  async updateVariable(index, variable) {
    const config = await this.load();
    if (config.variables[index] && config.variables[index].name !== 'original_name') {
      config.variables[index] = variable;
      await this.save(config);
    }
    return config;
  }

  async deleteVariable(index) {
    const config = await this.load();
    if (config.variables[index] && config.variables[index].name !== 'original_name') {
      config.variables.splice(index, 1);
      await this.save(config);
    }
    return config;
  }

  async updateSettings(settings) {
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
    return config;
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
      corrections: []
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

  // Feedback Learning System
  async loadFeedback() {
    try {
      const data = await fs.readFile(this.feedbackPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          categoryCorrections: [],
          nameCorrections: [],
          patterns: {}
        };
      }
      console.error('Error loading feedback:', error);
      return {
        categoryCorrections: [],
        nameCorrections: [],
        patterns: {}
      };
    }
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
    
    await this.saveFeedback(feedback);
    return feedback;
  }

  // Get relevant feedback for AI context
  async getRelevantFeedback(documentText, currentCategory) {
    const feedback = await this.loadFeedback();
    const relevantFeedback = {
      categoryPatterns: [],
      namePatterns: [],
      suggestions: []
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
    
    relevantFeedback.recentCorrections = {
      categories: recentCategoryCorrections,
      names: recentNameCorrections
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
}

module.exports = new ConfigManager();