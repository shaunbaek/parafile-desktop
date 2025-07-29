const fs = require('fs').promises;
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

class TextExtractor {
  async extractText(filePath, fileType) {
    try {
      switch (fileType) {
        case 'pdf':
          return await this.extractPDF(filePath);
        case 'docx':
        case 'doc':
          return await this.extractWord(filePath);
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      throw error;
    }
  }

  async extractPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      return {
        text: data.text,
        pages: data.numpages,
        info: data.info
      };
    } catch (error) {
      throw new Error(`Failed to extract PDF text: ${error.message}`);
    }
  }

  async extractWord(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      
      if (result.messages && result.messages.length > 0) {
        console.warn('Word extraction warnings:', result.messages);
      }
      
      return {
        text: result.value,
        messages: result.messages
      };
    } catch (error) {
      throw new Error(`Failed to extract Word text: ${error.message}`);
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