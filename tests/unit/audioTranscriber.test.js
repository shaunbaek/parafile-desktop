/**
 * Unit Tests for AudioTranscriber Service
 * Tests audio file transcription using OpenAI Whisper API
 */

const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const AudioTranscriber = require('../../src/services/audioTranscriber');

describe('AudioTranscriber Service', () => {
  let audioTranscriber;
  let testDir;

  beforeEach(async () => {
    audioTranscriber = new AudioTranscriber();
    testDir = path.join(os.tmpdir(), `parafile-audio-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('File Format Detection', () => {
    test('should identify supported audio formats', () => {
      const supportedFiles = [
        'test.mp3',
        'test.mp4',
        'test.mpeg',
        'test.mpga',
        'test.m4a',
        'test.wav',
        'test.webm'
      ];

      supportedFiles.forEach(filename => {
        expect(audioTranscriber.isAudioFile(filename)).toBe(true);
      });
    });

    test('should reject unsupported formats', () => {
      const unsupportedFiles = [
        'test.txt',
        'test.pdf',
        'test.avi',
        'test.mov',
        'test.flv'
      ];

      unsupportedFiles.forEach(filename => {
        expect(audioTranscriber.isAudioFile(filename)).toBe(false);
      });
    });

    test('should be case insensitive', () => {
      expect(audioTranscriber.isAudioFile('TEST.MP3')).toBe(true);
      expect(audioTranscriber.isAudioFile('Test.WaV')).toBe(true);
    });
  });

  describe('File Validation', () => {
    test('should validate file size', async () => {
      // Create a small test file
      const testFile = path.join(testDir, 'small.wav');
      await fs.writeFile(testFile, 'small audio content');

      const result = await audioTranscriber.validateAudioFile(testFile);
      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    test('should reject files that are too large', async () => {
      // Mock a large file (we can't actually create 26MB for testing)
      const testFile = path.join(testDir, 'large.wav');
      await fs.writeFile(testFile, 'test content');

      // Mock the file stats
      const originalStat = fs.stat;
      fs.stat = jest.fn().mockResolvedValue({
        size: 26 * 1024 * 1024 // 26MB
      });

      const result = await audioTranscriber.validateAudioFile(testFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds 25MB limit');

      // Restore original stat function
      fs.stat = originalStat;
    });

    test('should reject unsupported formats', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'not an audio file');

      const result = await audioTranscriber.validateAudioFile(testFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported audio format');
    });
  });

  describe('API Integration', () => {
    test('should require initialization before transcription', async () => {
      const testFile = path.join(testDir, 'test.wav');
      await fs.writeFile(testFile, 'dummy audio content');

      await expect(audioTranscriber.transcribeAudio(testFile))
        .rejects.toThrow('not initialized');
    });

    test('should handle missing API key', () => {
      expect(() => {
        audioTranscriber.initialize('');
      }).toThrow('API key is required');
    });
  });

  describe('Cost Estimation', () => {
    test('should estimate transcription cost', async () => {
      const testFile = path.join(testDir, 'test.mp3');
      await fs.writeFile(testFile, 'small audio file for testing');

      const estimate = await audioTranscriber.estimateCost(testFile);
      expect(estimate.file_size_mb).toBeDefined();
      expect(estimate.estimated_minutes).toBeDefined();
      expect(estimate.estimated_cost_usd).toBeDefined();
      expect(estimate.model).toBe('whisper-1');
    });
  });

  describe('Large File Handling', () => {
    test('should handle large files gracefully', async () => {
      const testFile = path.join(testDir, 'large.wav');
      await fs.writeFile(testFile, 'test content');

      // Mock large file size
      const originalStat = fs.stat;
      fs.stat = jest.fn().mockResolvedValue({
        size: 30 * 1024 * 1024 // 30MB
      });

      const result = await audioTranscriber.transcribeLargeAudio(testFile);
      expect(result.success).toBe(false);
      expect(result.error).toContain('File too large');
      expect(result.suggested_action).toBe('split_file');

      // Restore original stat function
      fs.stat = originalStat;
    });
  });

  describe('Supported Formats', () => {
    test('should return list of supported formats', () => {
      const formats = audioTranscriber.getSupportedFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(formats).toContain('.mp3');
      expect(formats).toContain('.wav');
      expect(formats).toContain('.m4a');
    });
  });

  describe('Real Audio File Testing', () => {
    // This test requires actual audio files and OpenAI API key
    // Skip by default unless specifically testing with real files
    test.skip('should transcribe real audio file', async () => {
      // This would require a real API key and audio file
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.log('Skipping real transcription test - no API key');
        return;
      }

      audioTranscriber.initialize(apiKey);
      
      // Use one of our test files
      const testFile = path.join(__dirname, '../../test-files/audio/Meeting_Budget_Planning_Q4.wav');
      
      try {
        const result = await audioTranscriber.transcribeAudio(testFile);
        expect(result.success).toBe(true);
        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);
        console.log('Transcription result:', result.text);
      } catch (error) {
        if (error.message.includes('API key')) {
          console.log('Skipping test - API key issue');
        } else {
          throw error;
        }
      }
    });
  });
});