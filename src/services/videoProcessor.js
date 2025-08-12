const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const OpenAI = require('openai');
const ModelSelector = require('./modelSelector');

class VideoProcessor {
  constructor() {
    this.openai = null;
    this.tempDir = path.join(__dirname, '../../temp');
    this.modelSelector = new ModelSelector();
    this.ensureTempDir();
  }

  initialize(apiKey) {
    if (!apiKey) {
      console.warn('OpenAI API key not provided for video processing');
      this.openai = null;
      return;
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Check if video file is supported
   * @param {string} filePath - Path to the video file
   * @returns {boolean}
   */
  isVideoFile(filePath) {
    const supportedFormats = this.getSupportedFormats();
    const ext = path.extname(filePath).toLowerCase();
    return supportedFormats.includes(ext);
  }

  /**
   * Get supported video formats
   * @returns {Array<string>}
   */
  getSupportedFormats() {
    return ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.m4v'];
  }

  /**
   * Validate video file size and format
   * @param {string} filePath - Path to video file
   * @returns {Promise<Object>}
   */
  async validateVideoFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File does not exist' };
      }

      const stats = fs.statSync(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      // Set reasonable limit for video files (500MB for processing)
      if (fileSizeMB > 500) {
        return { 
          valid: false, 
          error: `Video file too large: ${fileSizeMB.toFixed(1)}MB. Maximum size is 500MB for processing.` 
        };
      }

      const ext = path.extname(filePath).toLowerCase();
      if (!this.getSupportedFormats().includes(ext)) {
        return { 
          valid: false, 
          error: `Unsupported video format: ${ext}. Supported formats: ${this.getSupportedFormats().join(', ')}` 
        };
      }

      return { 
        valid: true, 
        size: stats.size,
        format: ext.substring(1)
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Extract audio from video file using FFmpeg
   * @param {string} videoPath - Path to video file
   * @returns {Promise<string>} - Path to extracted audio file
   */
  async extractAudio(videoPath) {
    return new Promise((resolve, reject) => {
      const audioPath = path.join(this.tempDir, `${Date.now()}_audio.mp3`);
      
      console.log(`Extracting audio from video: ${path.basename(videoPath)}`);
      
      // Use very low bitrate for large files to stay under 25MB limit
      // For a 67-minute video, we need roughly 32k bitrate to stay under 25MB
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vn', // No video
        '-acodec', 'mp3',
        '-ab', '32k', // Very low bitrate to ensure under 25MB
        '-ar', '16000', // Lower sample rate (still good for speech)
        '-ac', '1', // Mono audio
        '-compression_level', '9', // Maximum compression
        '-y', // Overwrite output file
        audioPath
      ]);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`Audio extraction completed: ${path.basename(audioPath)}`);
          resolve(audioPath);
        } else {
          console.error('FFmpeg error:', stderr);
          reject(new Error(`FFmpeg failed with exit code ${code}. Make sure FFmpeg is installed.`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`Failed to start FFmpeg: ${error.message}. Make sure FFmpeg is installed and in PATH.`));
      });
    });
  }

  /**
   * Extract key frames from video for visual analysis
   * @param {string} videoPath - Path to video file
   * @param {number} maxFrames - Maximum number of frames to extract
   * @returns {Promise<Array<string>>} - Array of base64 encoded frame images
   */
  async extractFrames(videoPath, maxFrames = 10) {
    return new Promise((resolve, reject) => {
      const frameDir = path.join(this.tempDir, `frames_${Date.now()}`);
      fs.mkdirSync(frameDir, { recursive: true });

      console.log(`Extracting key frames from video: ${path.basename(videoPath)}`);

      // Extract frames at regular intervals  
      const frameInterval = Math.max(1, Math.floor(30/maxFrames));
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vf', `select='not(mod(n,${frameInterval}))'`, // Simplified filter
        '-fps_mode', 'vfr', // Use newer -fps_mode instead of deprecated -vsync
        '-frames:v', maxFrames.toString(),
        '-q:v', '2', // High quality
        '-y', // Overwrite existing files
        path.join(frameDir, 'frame_%03d.jpg')
      ]);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          try {
            // Read and encode frames as base64
            const frameFiles = fs.readdirSync(frameDir)
              .filter(file => file.endsWith('.jpg'))
              .sort();

            const frames = [];
            for (const file of frameFiles) {
              const framePath = path.join(frameDir, file);
              const frameBuffer = fs.readFileSync(framePath);
              const base64Frame = frameBuffer.toString('base64');
              frames.push(base64Frame);
            }

            // Cleanup frame files
            frameFiles.forEach(file => {
              fs.unlinkSync(path.join(frameDir, file));
            });
            fs.rmdirSync(frameDir);

            console.log(`Extracted ${frames.length} frames from video`);
            resolve(frames);
          } catch (error) {
            reject(new Error(`Failed to process extracted frames: ${error.message}`));
          }
        } else {
          reject(new Error(`Frame extraction failed with exit code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`Failed to extract frames: ${error.message}`));
      });
    });
  }

  /**
   * Analyze video frames using intelligent model selection
   * @param {Array<string>} frames - Array of base64 encoded images
   * @param {string} fileName - Original video filename
   * @returns {Promise<Object>}
   */
  async analyzeFrames(frames, fileName) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      // Use model selector to choose the best model for video analysis
      const modelSelection = await this.modelSelector.selectModel({
        inputType: 'video_analysis',
        task: 'Analyze video frames for visual content, objects, people, and context',
        needsVision: true,
        contentLength: 'medium',
        costSensitive: true, // Default to cost-effective for most users
        highAccuracy: false
      });

      const selectedModel = modelSelection.selectedModel;
      console.log(`Analyzing ${frames.length} video frames with ${selectedModel} (${modelSelection.reasoning})`);

      const messages = [
        {
          role: 'system',
          content: `You are analyzing frames from a video file named "${fileName}". Analyze the visual content across all frames and provide a comprehensive description of what happens in the video. Focus on: actions, objects, people, scenes, text/captions, and overall context.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `These are key frames from the video "${fileName}". Please analyze the visual content and provide:
1. A comprehensive description of what happens in the video
2. Key objects, people, or text visible
3. The overall context or purpose of the video
4. Any notable changes or progression between frames

Respond in JSON format with: description, keyElements, context, and progression.`
            },
            ...frames.map(frame => ({
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${frame}`,
                detail: 'low' // Use low detail for cost efficiency
              }
            }))
          ]
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Add token usage information
      if (response.usage) {
        analysis.tokenUsage = {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
          estimatedCost: this.calculateVisionCost(response.usage)
        };
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing video frames:', error);
      return {
        description: 'Failed to analyze video frames',
        keyElements: [],
        context: 'Visual analysis unavailable',
        progression: 'Analysis failed',
        error: error.message
      };
    }
  }

  /**
   * Calculate estimated cost for GPT-4o usage
   * @param {Object} usage - Token usage from OpenAI response
   * @returns {number} Estimated cost in USD
   */
  calculateVisionCost(usage) {
    // GPT-4o pricing (as of 2025)
    const inputCost = (usage.prompt_tokens / 1000) * 0.0025;  // $2.50 per 1K input tokens
    const outputCost = (usage.completion_tokens / 1000) * 0.01; // $10.00 per 1K output tokens
    return inputCost + outputCost;
  }

  /**
   * Process complete video file (audio + visual analysis)
   * @param {string} videoPath - Path to video file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>}
   */
  async processVideo(videoPath, options = {}) {
    const startTime = Date.now();
    const fileName = path.basename(videoPath);
    
    try {
      console.log(`Starting video processing: ${fileName}`);

      // Validate video file
      const validation = await this.validateVideoFile(videoPath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const result = {
        success: false,
        fileName: fileName,
        format: validation.format,
        size: validation.size,
        audioTranscription: null,
        visualAnalysis: null,
        combinedText: '',
        processingTime: 0,
        tokenUsage: {
          totalTokens: 0,
          totalCost: 0,
          operations: []
        }
      };

      // Extract and transcribe audio
      let audioPath = null;
      try {
        audioPath = await this.extractAudio(videoPath);
        
        // Use existing audio transcriber for audio processing
        const AudioTranscriber = require('./audioTranscriber');
        const audioTranscriber = new AudioTranscriber();
        if (this.openai) {
          audioTranscriber.initialize(this.openai.apiKey);
        }

        const audioResult = await audioTranscriber.transcribeAudio(audioPath, {
          response_format: 'verbose_json',
          temperature: 0.1
        });

        if (audioResult.success) {
          result.audioTranscription = {
            text: audioResult.text,
            language: audioResult.language,
            duration: audioResult.duration
          };

          if (audioResult.tokenUsage) {
            result.tokenUsage.operations.push({
              operation: 'audio_transcription',
              tokens: 0, // Whisper doesn't use tokens
              cost: audioResult.tokenUsage.estimatedCost,
              model: 'whisper-1'
            });
            result.tokenUsage.totalCost += audioResult.tokenUsage.estimatedCost;
          }
        }
      } catch (audioError) {
        console.warn('Audio extraction/transcription failed:', audioError.message);
        result.audioTranscription = { 
          text: '', 
          error: audioError.message 
        };
      } finally {
        // Cleanup audio file
        if (audioPath && fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
      }

      // Extract and analyze visual frames
      try {
        const frames = await this.extractFrames(videoPath, options.maxFrames || 8);
        const visualAnalysis = await this.analyzeFrames(frames, fileName);
        
        result.visualAnalysis = visualAnalysis;

        if (visualAnalysis.tokenUsage) {
          result.tokenUsage.operations.push({
            operation: 'visual_analysis',
            tokens: visualAnalysis.tokenUsage.totalTokens,
            cost: visualAnalysis.tokenUsage.estimatedCost,
            model: 'gpt-4o'
          });
          result.tokenUsage.totalTokens += visualAnalysis.tokenUsage.totalTokens;
          result.tokenUsage.totalCost += visualAnalysis.tokenUsage.estimatedCost;
        }
      } catch (visualError) {
        console.warn('Visual analysis failed:', visualError.message);
        result.visualAnalysis = { 
          description: 'Visual analysis unavailable',
          error: visualError.message 
        };
      }

      // Combine audio transcription and visual analysis
      let combinedText = `Video File: ${fileName}\n\n`;
      
      if (result.audioTranscription && result.audioTranscription.text) {
        combinedText += `[Audio Transcription (${result.audioTranscription.language})]\n`;
        combinedText += `${result.audioTranscription.text}\n\n`;
      }

      if (result.visualAnalysis && result.visualAnalysis.description) {
        combinedText += `[Visual Analysis]\n`;
        combinedText += `Description: ${result.visualAnalysis.description}\n`;
        
        if (result.visualAnalysis.keyElements && result.visualAnalysis.keyElements.length > 0) {
          combinedText += `Key Elements: ${result.visualAnalysis.keyElements.join(', ')}\n`;
        }
        
        if (result.visualAnalysis.context) {
          combinedText += `Context: ${result.visualAnalysis.context}\n`;
        }
      }

      result.combinedText = combinedText;
      result.processingTime = Date.now() - startTime;
      result.success = true;

      console.log(`Video processing completed in ${result.processingTime}ms`);
      return result;

    } catch (error) {
      console.error('Video processing failed:', error);
      return {
        success: false,
        fileName: fileName,
        error: error.message,
        processingTime: Date.now() - startTime,
        tokenUsage: {
          totalTokens: 0,
          totalCost: 0,
          operations: []
        }
      };
    }
  }

  /**
   * Estimate processing cost for a video file
   * @param {string} videoPath - Path to video file
   * @returns {Promise<Object>}
   */
  async estimateCost(videoPath) {
    try {
      const validation = await this.validateVideoFile(videoPath);
      if (!validation.valid) {
        return { error: validation.error };
      }

      const fileSizeMB = validation.size / (1024 * 1024);
      
      // Estimate audio duration (rough approximation)
      const estimatedDurationMinutes = Math.max(1, fileSizeMB / 10); // Very rough estimate
      
      // Whisper cost: $0.006 per minute
      const whisperCost = estimatedDurationMinutes * 0.006;
      
      // Vision cost: roughly $0.01-0.03 per frame analysis
      const visionCost = 8 * 0.02; // 8 frames at ~$0.02 each
      
      const totalCost = whisperCost + visionCost;

      return {
        estimated_duration_minutes: estimatedDurationMinutes,
        estimated_cost_usd: parseFloat(totalCost.toFixed(4)),
        breakdown: {
          audio_transcription: parseFloat(whisperCost.toFixed(4)),
          visual_analysis: parseFloat(visionCost.toFixed(4))
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Clean up temporary files
   */
  cleanup() {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        files.forEach(file => {
          const filePath = path.join(this.tempDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        });
      }
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }
}

module.exports = VideoProcessor;