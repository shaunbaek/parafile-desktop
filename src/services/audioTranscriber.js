const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

class AudioTranscriber {
  constructor() {
    this.supportedFormats = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];
    this.maxFileSize = 25 * 1024 * 1024; // 25MB in bytes
    this.openai = null;
  }

  /**
   * Initialize OpenAI client with API key
   * @param {string} apiKey - OpenAI API key
   */
  initialize(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for audio transcription');
    }
    
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Check if a file is a supported audio format
   * @param {string} filePath - Path to the audio file
   * @returns {boolean} - True if supported format
   */
  isAudioFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedFormats.includes(ext);
  }

  /**
   * Check if audio file meets size requirements
   * @param {string} filePath - Path to the audio file
   * @returns {Promise<{valid: boolean, size: number, error?: string}>}
   */
  async validateAudioFile(filePath) {
    try {
      const stats = await fs.promises.stat(filePath);
      const fileSize = stats.size;
      
      if (fileSize > this.maxFileSize) {
        return {
          valid: false,
          size: fileSize,
          error: `File size (${Math.round(fileSize / 1024 / 1024)}MB) exceeds 25MB limit`
        };
      }
      
      if (!this.isAudioFile(filePath)) {
        return {
          valid: false,
          size: fileSize,
          error: `Unsupported audio format. Supported: ${this.supportedFormats.join(', ')}`
        };
      }
      
      return { valid: true, size: fileSize };
    } catch (error) {
      return {
        valid: false,
        size: 0,
        error: `Error accessing file: ${error.message}`
      };
    }
  }

  /**
   * Transcribe audio file to text using OpenAI Whisper
   * @param {string} filePath - Path to the audio file
   * @param {Object} options - Transcription options
   * @param {string} options.language - Language code (optional, auto-detect if not provided)
   * @param {string} options.prompt - Context prompt to improve accuracy (optional)
   * @param {number} options.temperature - Sampling temperature (0-1, default 0.1)
   * @param {string} options.response_format - Response format (text, json, verbose_json)
   * @returns {Promise<Object>} - Transcription result
   */
  async transcribeAudio(filePath, options = {}) {
    if (!this.openai) {
      throw new Error('AudioTranscriber not initialized. Call initialize() with API key first.');
    }

    // Validate file
    const validation = await this.validateAudioFile(filePath);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const {
      language = null, // Auto-detect if not specified
      prompt = null,
      temperature = 0.1,
      response_format = 'verbose_json'
    } = options;

    try {
      console.log(`Starting transcription of ${path.basename(filePath)} (${Math.round(validation.size / 1024)}KB)`);
      
      const transcriptionOptions = {
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
        response_format,
        temperature
      };

      // Add optional parameters if provided
      if (language) {
        transcriptionOptions.language = language;
      }
      
      if (prompt) {
        transcriptionOptions.prompt = prompt;
      }

      const startTime = Date.now();
      const transcription = await this.openai.audio.transcriptions.create(transcriptionOptions);
      const duration = Date.now() - startTime;

      console.log(`Transcription completed in ${duration}ms`);

      // Format the response based on response_format
      if (response_format === 'verbose_json') {
        return {
          success: true,
          text: transcription.text,
          language: transcription.language,
          duration: transcription.duration,
          segments: transcription.segments || [],
          processing_time: duration,
          file_size: validation.size,
          model: 'whisper-1'
        };
      } else if (response_format === 'json') {
        return {
          success: true,
          text: transcription.text,
          processing_time: duration,
          file_size: validation.size,
          model: 'whisper-1'
        };
      } else {
        // text format
        return {
          success: true,
          text: transcription,
          processing_time: duration,
          file_size: validation.size,
          model: 'whisper-1'
        };
      }

    } catch (error) {
      console.error('Audio transcription failed:', error);
      
      // Parse OpenAI API errors
      let errorMessage = error.message;
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      }

      return {
        success: false,
        error: errorMessage,
        file_size: validation.size
      };
    }
  }

  /**
   * Get estimated transcription cost
   * @param {string} filePath - Path to the audio file
   * @returns {Promise<Object>} - Cost estimation
   */
  async estimateCost(filePath) {
    const validation = await this.validateAudioFile(filePath);
    if (!validation.valid) {
      return { error: validation.error };
    }

    // OpenAI Whisper pricing: $0.006 per minute
    // Estimate duration based on file size (very rough approximation)
    const estimatedMinutes = Math.max(1, Math.round(validation.size / (1024 * 1024) * 2)); // ~2 minutes per MB
    const estimatedCost = estimatedMinutes * 0.006;

    return {
      file_size_mb: Math.round(validation.size / 1024 / 1024 * 100) / 100,
      estimated_minutes: estimatedMinutes,
      estimated_cost_usd: Math.round(estimatedCost * 1000) / 1000,
      model: 'whisper-1'
    };
  }

  /**
   * Process large audio files by chunking (for files > 25MB)
   * Note: This is a placeholder for future implementation
   * @param {string} filePath - Path to the large audio file
   * @returns {Promise<Object>} - Transcription result
   */
  async transcribeLargeAudio(filePath) {
    // For now, reject large files with helpful error
    const validation = await this.validateAudioFile(filePath);
    if (validation.size > this.maxFileSize) {
      return {
        success: false,
        error: `File too large (${Math.round(validation.size / 1024 / 1024)}MB). Please split into smaller chunks (<25MB) or use audio editing software to reduce file size.`,
        suggested_action: 'split_file'
      };
    }
    
    return this.transcribeAudio(filePath);
  }

  /**
   * Get supported audio formats
   * @returns {Array<string>} - List of supported file extensions
   */
  getSupportedFormats() {
    return [...this.supportedFormats];
  }
}

module.exports = AudioTranscriber;