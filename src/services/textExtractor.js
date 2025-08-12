const fs = require('fs').promises;
const fsSync = require('fs');
const pdf = require('pdf-parse');
const pdfTextExtract = require('pdf-text-extract');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const exifr = require('exifr');
const AudioTranscriber = require('./audioTranscriber');

class TextExtractor {
  constructor() {
    this.audioTranscriber = new AudioTranscriber();
  }

  /**
   * Initialize with API key for audio transcription
   * @param {string} apiKey - OpenAI API key
   */
  initialize(apiKey) {
    if (apiKey) {
      this.audioTranscriber.initialize(apiKey);
    }
  }

  async extractText(filePath, fileType) {
    try {
      switch (fileType) {
        case 'pdf':
          return await this.extractPDF(filePath);
        case 'docx':
        case 'doc':
          return await this.extractWord(filePath);
        case 'csv':
          return await this.extractCSV(filePath);
        case 'xlsx':
        case 'xls':
          return await this.extractExcel(filePath);
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'bmp':
        case 'tiff':
        case 'webp':
          return await this.extractImage(filePath);
        case 'mp3':
        case 'mp4':
        case 'mpeg':
        case 'mpga':
        case 'm4a':
        case 'wav':
        case 'webm':
          return await this.extractAudio(filePath);
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      throw error;
    }
  }

  async extractPDF(filePath) {
    // Try multiple PDF extraction methods as fallbacks
    const methods = [
      { name: 'pdf-parse', fn: this.extractPDFWithPdfParse },
      { name: 'pdf-text-extract', fn: this.extractPDFWithTextExtract }
    ];
    
    let lastError = null;
    
    for (const method of methods) {
      try {
        console.log(`Trying PDF extraction with ${method.name}...`);
        const result = await method.fn.call(this, filePath);
        console.log(`✅ PDF extraction successful with ${method.name}`);
        return result;
      } catch (error) {
        console.log(`❌ ${method.name} failed: ${error.message}`);
        lastError = error;
      }
    }
    
    throw new Error(`All PDF extraction methods failed. Last error: ${lastError?.message}`);
  }
  
  async extractPDFWithPdfParse(filePath) {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    return {
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  }
  
  async extractPDFWithTextExtract(filePath) {
    return new Promise((resolve, reject) => {
      pdfTextExtract(filePath, (error, pages) => {
        if (error) {
          reject(new Error(`pdf-text-extract failed: ${error.message}`));
          return;
        }
        
        const text = pages.join(' ').trim();
        resolve({
          text: text,
          pages: pages.length,
          info: { method: 'pdf-text-extract' }
        });
      });
    });
  }

  async extractWord(filePath) {
    try {
      const ext = filePath.toLowerCase().split('.').pop();
      
      if (ext === 'docx') {
        // Use mammoth for .docx files
        const buffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        
        if (result.messages && result.messages.length > 0) {
          console.warn('DOCX extraction warnings:', result.messages);
        }
        
        return {
          text: result.value,
          messages: result.messages
        };
      } else if (ext === 'doc') {
        // Use word-extractor for .doc files
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(filePath);
        
        return {
          text: extracted.getBody(),
          metadata: {
            headers: extracted.getHeaders(),
            footers: extracted.getFooters(),
            endNotes: extracted.getEndNotes()
          }
        };
      } else {
        throw new Error(`Unsupported Word file format: .${ext}`);
      }
    } catch (error) {
      throw new Error(`Failed to extract Word text: ${error.message}`);
    }
  }

  async extractCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const headers = [];
      let rowCount = 0;
      
      fsSync.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headers.push(...headerList);
        })
        .on('data', (row) => {
          if (rowCount < 10) { // Get first 10 rows as sample
            results.push(row);
          }
          rowCount++;
        })
        .on('end', () => {
          const sampleData = results.slice(0, 5).map(row => 
            Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', ')
          ).join('\n');
          
          resolve({
            text: `CSV Spreadsheet with ${headers.length} columns: ${headers.join(', ')}. 
                   Contains ${rowCount} rows of data.
                   Sample data:
                   ${sampleData}`,
            metadata: {
              type: 'csv',
              columns: headers,
              rowCount: rowCount,
              sample: results.slice(0, 5)
            }
          });
        })
        .on('error', reject);
    });
  }

  async extractExcel(filePath) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      let extractedText = '';
      const metadata = {
        type: 'excel',
        sheets: [],
        totalRows: 0,
        totalColumns: 0
      };
      
      workbook.eachSheet((worksheet, sheetId) => {
        const sheetInfo = {
          name: worksheet.name,
          rowCount: worksheet.rowCount,
          columnCount: worksheet.columnCount,
          headers: [],
          sample: []
        };
        
        // Extract headers (first row)
        const firstRow = worksheet.getRow(1);
        firstRow.eachCell((cell, colNumber) => {
          if (cell.value) {
            sheetInfo.headers.push(cell.value.toString());
          }
        });
        
        // Extract sample data (first 5 rows)
        for (let i = 1; i <= Math.min(5, worksheet.rowCount); i++) {
          const row = worksheet.getRow(i);
          const rowData = [];
          row.eachCell((cell, colNumber) => {
            if (cell.value) {
              rowData.push(cell.value.toString());
            }
          });
          if (rowData.length > 0) {
            sheetInfo.sample.push(rowData.join(', '));
          }
        }
        
        metadata.sheets.push(sheetInfo);
        metadata.totalRows += worksheet.rowCount;
        metadata.totalColumns = Math.max(metadata.totalColumns, worksheet.columnCount);
        
        extractedText += `Sheet "${worksheet.name}": ${worksheet.rowCount} rows, ${worksheet.columnCount} columns\n`;
        extractedText += `Columns: ${sheetInfo.headers.join(', ')}\n`;
        extractedText += `Sample data:\n${sheetInfo.sample.join('\n')}\n\n`;
      });
      
      return {
        text: `Excel Workbook with ${workbook.worksheets.length} sheet(s):\n${extractedText}`,
        metadata: metadata
      };
    } catch (error) {
      throw new Error(`Failed to extract Excel text: ${error.message}`);
    }
  }

  async extractImage(filePath) {
    try {
      // First, get image metadata
      const metadata = await this.getImageMetadata(filePath);
      
      // Then perform OCR to extract any text
      const ocrText = await this.performOCR(filePath);
      
      // Combine metadata and OCR results
      const metadataText = `Image file (${metadata.format}): ${metadata.width}x${metadata.height} pixels`;
      const dateText = metadata.dateTime ? `\nCaptured: ${metadata.dateTime}` : '';
      const locationText = metadata.gps ? `\nLocation: ${metadata.gps.latitude}, ${metadata.gps.longitude}` : '';
      
      return {
        text: `${metadataText}${dateText}${locationText}\n\nExtracted text:\n${ocrText}`,
        metadata: {
          type: 'image',
          format: metadata.format,
          dimensions: `${metadata.width}x${metadata.height}`,
          hasText: ocrText.length > 0,
          ocrText: ocrText,
          exif: metadata
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract image content: ${error.message}`);
    }
  }

  async getImageMetadata(filePath) {
    try {
      // Get basic image info using sharp
      const sharpMetadata = await sharp(filePath).metadata();
      
      // Try to get EXIF data
      let exifData = {};
      try {
        exifData = await exifr.parse(filePath) || {};
      } catch (e) {
        // Not all images have EXIF data
        console.log('No EXIF data available for image');
      }
      
      return {
        format: sharpMetadata.format,
        width: sharpMetadata.width,
        height: sharpMetadata.height,
        dateTime: exifData.DateTimeOriginal || exifData.CreateDate,
        camera: exifData.Make && exifData.Model ? `${exifData.Make} ${exifData.Model}` : null,
        gps: exifData.latitude && exifData.longitude ? {
          latitude: exifData.latitude,
          longitude: exifData.longitude
        } : null
      };
    } catch (error) {
      console.error('Error extracting image metadata:', error);
      return {
        format: 'unknown',
        width: 0,
        height: 0
      };
    }
  }

  async performOCR(filePath) {
    try {
      // Perform OCR using Tesseract.js
      const result = await Tesseract.recognize(
        filePath,
        'eng',
        {
          langPath: __dirname + '/../../',  // Path to eng.traineddata
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );
      
      return result.data.text.trim();
    } catch (error) {
      console.error('OCR failed:', error);
      return ''; // Return empty string if OCR fails
    }
  }

  /**
   * Extract text from audio files using OpenAI Whisper API
   * @param {string} filePath - Path to the audio file
   * @returns {Promise<string>} - Transcribed text
   */
  async extractAudio(filePath) {
    console.log(`Extracting text from audio file: ${filePath}`);
    
    try {
      const result = await this.audioTranscriber.transcribeAudio(filePath, {
        response_format: 'verbose_json',
        temperature: 0.1
      });

      if (!result.success) {
        throw new Error(`Audio transcription failed: ${result.error}`);
      }

      const text = result.text || '';
      console.log(`Audio transcription completed. Text length: ${text.length} characters`);
      
      // Add metadata information to the text for better AI analysis
      let enrichedText = text;
      
      if (result.language) {
        enrichedText = `[Audio Language: ${result.language}]\n${text}`;
      }
      
      if (result.duration) {
        enrichedText = `[Audio Duration: ${Math.round(result.duration)}s]\n${enrichedText}`;
      }

      // Add segments information if available (for timestamp analysis)
      if (result.segments && result.segments.length > 0) {
        const hasTimestamps = result.segments.some(s => s.start !== undefined && s.end !== undefined);
        if (hasTimestamps) {
          enrichedText += '\n\n[Transcript with Timestamps]\n';
          enrichedText += result.segments.map(segment => 
            `[${Math.round(segment.start)}s-${Math.round(segment.end)}s] ${segment.text}`
          ).join('\n');
        }
      }

      return enrichedText;

    } catch (error) {
      console.error('Error extracting audio:', error);
      
      // Provide helpful error messages
      if (error.message.includes('File size')) {
        throw new Error(`Audio file too large: ${error.message}. Please use files smaller than 25MB.`);
      } else if (error.message.includes('API key')) {
        throw new Error('OpenAI API key not configured. Audio transcription requires a valid OpenAI API key.');
      } else if (error.message.includes('Unsupported')) {
        throw new Error(`Unsupported audio format. Supported formats: ${this.audioTranscriber.getSupportedFormats().join(', ')}`);
      }
      
      throw error;
    }
  }

  async tryExtractWithRetry(filePath, fileType, maxRetries = 3, delay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.extractText(filePath, fileType);
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        if (error.message.includes('locked') || error.code === 'EBUSY') {
          console.log(`File locked, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }
}

module.exports = new TextExtractor();