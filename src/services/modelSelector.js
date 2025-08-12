/**
 * Intelligent Model Selection Service
 * Determines the best OpenAI model based on input type, content, and requirements
 */

const fs = require('fs');
const path = require('path');

class ModelSelector {
  constructor() {
    // Available models as of 2025
    this.models = {
      // Text models
      'gpt-4o': {
        type: 'text',
        capabilities: ['reasoning', 'analysis', 'complex_tasks', 'vision'],
        costPer1k: { input: 2.50, output: 10.00 },
        maxTokens: 128000,
        useCase: 'Complex analysis, reasoning, multi-modal tasks'
      },
      'gpt-4o-mini': {
        type: 'text', 
        capabilities: ['general', 'analysis', 'vision'],
        costPer1k: { input: 0.15, output: 0.60 },
        maxTokens: 128000,
        useCase: 'General purpose, cost-effective, fast'
      },
      
      // Audio models
      'whisper-1': {
        type: 'audio',
        capabilities: ['transcription', 'translation'],
        costPerMinute: 0.006,
        maxFileSize: '25MB',
        useCase: 'Audio transcription and translation'
      },
      'gpt-4o-audio': {
        type: 'audio',
        capabilities: ['audio_understanding', 'conversation'],
        costPer1k: { input: 100.00, output: 200.00 },
        useCase: 'Advanced audio understanding and generation'
      },
      'gpt-4o-mini-audio': {
        type: 'audio', 
        capabilities: ['audio_understanding', 'conversation'],
        costPer1k: { input: 10.00, output: 20.00 },
        useCase: 'Cost-effective audio understanding'
      },
      
      // Realtime models
      'gpt-4o-realtime': {
        type: 'realtime',
        capabilities: ['real_time_conversation', 'audio_io'],
        costPer1k: { input: 5.00, output: 20.00 },
        useCase: 'Real-time conversation and audio interaction'
      },
      'gpt-4o-mini-realtime': {
        type: 'realtime',
        capabilities: ['real_time_conversation', 'audio_io'],
        costPer1k: { input: 1.00, output: 4.00 },
        useCase: 'Cost-effective real-time interaction'
      },
      
      // Specialized models  
      'gpt-4o-search-preview': {
        type: 'search',
        capabilities: ['web_search', 'research', 'current_info'],
        costPer1k: { input: 2.50, output: 10.00 },
        useCase: 'Research tasks requiring current information'
      },
      'gpt-4o-mini-search-preview': {
        type: 'search',
        capabilities: ['web_search', 'research', 'current_info'],
        costPer1k: { input: 0.15, output: 0.60 },
        useCase: 'Cost-effective research and search'
      }
    };
    
    this.defaultModel = 'gpt-4o-mini';
  }

  /**
   * Analyze input and determine the best model
   * @param {Object} input - Input analysis object
   * @returns {Object} Model selection result
   */
  async selectModel(input) {
    try {
      const analysis = await this.analyzeInput(input);
      const modelChoice = this.determineOptimalModel(analysis);
      
      return {
        success: true,
        selectedModel: modelChoice.model,
        reasoning: modelChoice.reasoning,
        estimatedCost: modelChoice.estimatedCost,
        confidence: modelChoice.confidence,
        fallback: this.defaultModel,
        analysis: analysis
      };
    } catch (error) {
      console.warn('Model selection failed, using default:', error.message);
      return {
        success: false,
        selectedModel: this.defaultModel,
        reasoning: `Failed to analyze input: ${error.message}. Using default model.`,
        estimatedCost: 'unknown',
        confidence: 0.1,
        fallback: this.defaultModel,
        error: error.message
      };
    }
  }

  /**
   * Analyze the input to understand requirements
   * @param {Object} input - Input to analyze
   * @returns {Object} Analysis result
   */
  async analyzeInput(input) {
    const analysis = {
      inputType: this.detectInputType(input),
      complexity: this.assessComplexity(input),
      contentLength: this.estimateContentLength(input),
      requirements: this.identifyRequirements(input),
      costSensitivity: input.costSensitive || false,
      realTimeRequired: input.realTime || false,
      accuracyRequired: input.highAccuracy || false
    };

    // File-specific analysis
    if (input.filePath) {
      analysis.fileAnalysis = await this.analyzeFile(input.filePath);
    }

    return analysis;
  }

  /**
   * Detect the type of input
   * @param {Object} input 
   * @returns {string}
   */
  detectInputType(input) {
    if (input.filePath) {
      const ext = path.extname(input.filePath).toLowerCase();
      
      // Audio files
      if (['.mp3', '.wav', '.m4a', '.mpga'].includes(ext)) {
        return 'audio_file';
      }
      
      // Video files
      if (['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.m4v', '.mpeg'].includes(ext)) {
        return 'video_file';
      }
      
      // Document files
      if (['.pdf', '.doc', '.docx', '.txt'].includes(ext)) {
        return 'document';
      }
      
      // Image files
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
        return 'image';
      }
      
      // Spreadsheet files
      if (['.csv', '.xlsx', '.xls'].includes(ext)) {
        return 'spreadsheet';
      }
    }

    // Task-based detection
    if (input.task) {
      if (input.task.includes('transcrib') || input.task.includes('audio')) {
        return 'audio_processing';
      }
      if (input.task.includes('search') || input.task.includes('research')) {
        return 'search_task';
      }
      if (input.task.includes('realtime') || input.task.includes('conversation')) {
        return 'realtime_task';
      }
      if (input.task.includes('analyz') || input.task.includes('understand')) {
        return 'analysis_task';
      }
    }

    return 'general_text';
  }

  /**
   * Assess the complexity of the task
   * @param {Object} input 
   * @returns {string}
   */
  assessComplexity(input) {
    let complexity = 'low';
    
    // High complexity indicators
    if (input.task) {
      const highComplexityTerms = [
        'analyze', 'reasoning', 'complex', 'detailed', 'comprehensive',
        'multi-step', 'research', 'technical', 'legal', 'medical'
      ];
      
      if (highComplexityTerms.some(term => 
        input.task.toLowerCase().includes(term))) {
        complexity = 'high';
      } else if (input.task.length > 200) {
        complexity = 'medium';
      }
    }

    // File size complexity
    if (input.filePath && fs.existsSync(input.filePath)) {
      const stats = fs.statSync(input.filePath);
      const sizeMB = stats.size / (1024 * 1024);
      
      if (sizeMB > 50) complexity = 'high';
      else if (sizeMB > 10) complexity = 'medium';
    }

    return complexity;
  }

  /**
   * Estimate content length
   * @param {Object} input 
   * @returns {string}
   */
  estimateContentLength(input) {
    if (input.text) {
      const tokens = Math.ceil(input.text.length / 4); // Rough token estimation
      if (tokens > 50000) return 'very_long';
      if (tokens > 10000) return 'long';
      if (tokens > 2000) return 'medium';
      return 'short';
    }

    if (input.filePath && fs.existsSync(input.filePath)) {
      const stats = fs.statSync(input.filePath);
      const sizeMB = stats.size / (1024 * 1024);
      
      if (sizeMB > 100) return 'very_long';
      if (sizeMB > 25) return 'long';
      if (sizeMB > 5) return 'medium';
      return 'short';
    }

    return 'unknown';
  }

  /**
   * Identify specific requirements
   * @param {Object} input 
   * @returns {Array<string>}
   */
  identifyRequirements(input) {
    const requirements = [];
    
    if (input.needsVision || (input.filePath && this.isImageOrVideo(input.filePath))) {
      requirements.push('vision');
    }
    
    if (input.needsAudio || (input.filePath && this.isAudio(input.filePath))) {
      requirements.push('audio_processing');
    }
    
    if (input.needsSearch || (input.task && input.task.includes('current'))) {
      requirements.push('search');
    }
    
    if (input.realTime) {
      requirements.push('realtime');
    }
    
    if (input.costSensitive) {
      requirements.push('cost_effective');
    }
    
    if (input.highAccuracy) {
      requirements.push('high_accuracy');
    }

    return requirements;
  }

  /**
   * Analyze file-specific characteristics
   * @param {string} filePath 
   * @returns {Object}
   */
  async analyzeFile(filePath) {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const sizeMB = stats.size / (1024 * 1024);
    
    const analysis = {
      extension: ext,
      sizeMB: sizeMB,
      isLarge: sizeMB > 25,
      isHuge: sizeMB > 100,
      estimatedProcessingTime: this.estimateProcessingTime(ext, sizeMB)
    };

    // Audio/video specific analysis
    if (this.isAudioOrVideo(filePath)) {
      analysis.estimatedDuration = this.estimateMediaDuration(sizeMB, ext);
      analysis.needsCompression = sizeMB > 25; // Whisper limit
    }

    return analysis;
  }

  /**
   * Determine the optimal model based on analysis
   * @param {Object} analysis 
   * @returns {Object}
   */
  determineOptimalModel(analysis) {
    const candidates = [];

    // Audio file processing
    if (analysis.inputType === 'audio_file') {
      if (analysis.fileAnalysis?.needsCompression) {
        candidates.push({
          model: 'whisper-1',
          reasoning: 'Best for audio transcription, handles compressed audio well',
          confidence: 0.9,
          estimatedCost: this.calculateWhisperCost(analysis.fileAnalysis.estimatedDuration)
        });
      } else {
        candidates.push({
          model: 'whisper-1',
          reasoning: 'Standard choice for audio transcription',
          confidence: 0.95,
          estimatedCost: this.calculateWhisperCost(analysis.fileAnalysis.estimatedDuration)
        });
      }
    }

    // Video file processing
    else if (analysis.inputType === 'video_file') {
      candidates.push({
        model: 'hybrid',
        models: ['whisper-1', 'gpt-4o-mini'],
        reasoning: 'Video requires both audio transcription and visual analysis',
        confidence: 0.9,
        estimatedCost: this.calculateVideoProcessingCost(analysis)
      });
    }

    // Realtime tasks
    else if (analysis.realTimeRequired) {
      if (analysis.requirements.includes('cost_effective')) {
        candidates.push({
          model: 'gpt-4o-mini-realtime',
          reasoning: 'Cost-effective real-time processing',
          confidence: 0.8,
          estimatedCost: 'variable'
        });
      } else {
        candidates.push({
          model: 'gpt-4o-realtime',
          reasoning: 'High-quality real-time processing',
          confidence: 0.9,
          estimatedCost: 'variable'
        });
      }
    }

    // Search tasks
    else if (analysis.requirements.includes('search')) {
      if (analysis.requirements.includes('cost_effective')) {
        candidates.push({
          model: 'gpt-4o-mini-search-preview',
          reasoning: 'Cost-effective search and research capabilities',
          confidence: 0.85,
          estimatedCost: this.calculateTextCost(analysis, 'gpt-4o-mini-search-preview')
        });
      } else {
        candidates.push({
          model: 'gpt-4o-search-preview',
          reasoning: 'Advanced search and research capabilities',
          confidence: 0.9,
          estimatedCost: this.calculateTextCost(analysis, 'gpt-4o-search-preview')
        });
      }
    }

    // Complex analysis tasks
    else if (analysis.complexity === 'high' || analysis.requirements.includes('high_accuracy')) {
      if (analysis.requirements.includes('vision')) {
        candidates.push({
          model: 'gpt-4o',
          reasoning: 'Complex analysis with vision capabilities required',
          confidence: 0.9,
          estimatedCost: this.calculateTextCost(analysis, 'gpt-4o')
        });
      } else {
        candidates.push({
          model: 'gpt-4o',
          reasoning: 'Complex analysis requiring advanced reasoning',
          confidence: 0.85,
          estimatedCost: this.calculateTextCost(analysis, 'gpt-4o')
        });
      }
    }

    // General tasks - prefer cost-effective options
    else {
      if (analysis.requirements.includes('vision')) {
        candidates.push({
          model: 'gpt-4o-mini',
          reasoning: 'Cost-effective with vision capabilities',
          confidence: 0.85,
          estimatedCost: this.calculateTextCost(analysis, 'gpt-4o-mini')
        });
      } else {
        candidates.push({
          model: 'gpt-4o-mini',
          reasoning: 'Cost-effective general purpose model',
          confidence: 0.8,
          estimatedCost: this.calculateTextCost(analysis, 'gpt-4o-mini')
        });
      }
    }

    // Return best candidate or default
    if (candidates.length > 0) {
      return candidates.sort((a, b) => b.confidence - a.confidence)[0];
    }

    return {
      model: this.defaultModel,
      reasoning: 'No specific requirements detected, using default model',
      confidence: 0.5,
      estimatedCost: 'low'
    };
  }

  /**
   * Calculate estimated cost for Whisper
   * @param {number} durationMinutes 
   * @returns {number}
   */
  calculateWhisperCost(durationMinutes) {
    return durationMinutes * 0.006;
  }

  /**
   * Calculate estimated cost for text models
   * @param {Object} analysis 
   * @param {string} modelName 
   * @returns {number}
   */
  calculateTextCost(analysis, modelName) {
    const model = this.models[modelName];
    if (!model || !model.costPer1k) return 0;

    let estimatedTokens = 1000; // Default estimate
    
    if (analysis.contentLength === 'short') estimatedTokens = 500;
    else if (analysis.contentLength === 'medium') estimatedTokens = 2000;
    else if (analysis.contentLength === 'long') estimatedTokens = 8000;
    else if (analysis.contentLength === 'very_long') estimatedTokens = 20000;

    const inputCost = (estimatedTokens / 1000) * model.costPer1k.input;
    const outputCost = (estimatedTokens * 0.3 / 1000) * model.costPer1k.output; // Assume 30% output ratio
    
    return inputCost + outputCost;
  }

  /**
   * Calculate video processing cost
   * @param {Object} analysis 
   * @returns {number}
   */
  calculateVideoProcessingCost(analysis) {
    const whisperCost = this.calculateWhisperCost(analysis.fileAnalysis?.estimatedDuration || 5);
    const visionCost = this.calculateTextCost(analysis, 'gpt-4o-mini');
    return whisperCost + visionCost;
  }

  /**
   * Utility methods
   */
  isImageOrVideo(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', 
            '.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.m4v', '.mpeg'].includes(ext);
  }

  isAudio(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.mp3', '.wav', '.m4a', '.mpga'].includes(ext);
  }

  isAudioOrVideo(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.mp3', '.wav', '.m4a', '.mpga', '.mp4', '.mov', '.avi', '.mkv', 
            '.webm', '.flv', '.m4v', '.mpeg'].includes(ext);
  }

  estimateProcessingTime(ext, sizeMB) {
    if (this.isAudioOrVideo('.' + ext)) {
      return Math.max(10, sizeMB * 0.5); // Rough estimate in seconds
    }
    return Math.max(2, sizeMB * 0.1);
  }

  estimateMediaDuration(sizeMB, ext) {
    // Very rough estimates based on typical compression
    if (['.mp3', '.m4a'].includes(ext)) {
      return sizeMB * 8; // ~8 minutes per MB for MP3
    }
    if (['.mp4', '.mov'].includes(ext)) {
      return sizeMB * 0.5; // ~30 seconds per MB for MP4
    }
    return sizeMB * 1; // Generic estimate
  }

  /**
   * Get model information
   * @param {string} modelName 
   * @returns {Object}
   */
  getModelInfo(modelName) {
    return this.models[modelName] || null;
  }

  /**
   * List available models by type
   * @param {string} type 
   * @returns {Array}
   */
  getModelsByType(type) {
    return Object.entries(this.models)
      .filter(([name, info]) => info.type === type)
      .map(([name, info]) => ({ name, ...info }));
  }
}

module.exports = ModelSelector;