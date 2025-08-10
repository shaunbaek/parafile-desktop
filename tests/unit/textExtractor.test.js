/**
 * Unit Tests for TextExtractor Service
 * Tests all text extraction methods for different file formats
 */

const path = require('path');
const fs = require('fs');
const textExtractor = require('../../src/services/textExtractor');

describe('TextExtractor Service', () => {
  const fixturesPath = path.join(__dirname, '../fixtures');

  beforeAll(() => {
    // Ensure fixtures directory exists
    if (!fs.existsSync(fixturesPath)) {
      fs.mkdirSync(fixturesPath, { recursive: true });
    }
  });

  describe('PDF Extraction', () => {
    const pdfPath = path.join(fixturesPath, 'test.pdf');

    beforeEach(() => {
      // Copy test PDF if it exists
      const sourcePdf = path.join(__dirname, '../../test-files/Invoice_2024_12_Test.pdf');
      if (fs.existsSync(sourcePdf)) {
        fs.copyFileSync(sourcePdf, pdfPath);
      }
    });

    test('should extract text from PDF using fallback methods', async () => {
      if (!fs.existsSync(pdfPath)) {
        console.log('Skipping PDF test - no test file available');
        return;
      }

      const result = await textExtractor.extractText(pdfPath, 'pdf');
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
      expect(result.pages).toBeGreaterThan(0);
      expect(result.info).toBeDefined();
    });

    test('should handle corrupt PDF files gracefully', async () => {
      const corruptPdfPath = path.join(fixturesPath, 'corrupt.pdf');
      fs.writeFileSync(corruptPdfPath, 'This is not a PDF file');

      await expect(textExtractor.extractText(corruptPdfPath, 'pdf'))
        .rejects.toThrow();
    });

    test('should handle non-existent PDF files', async () => {
      const nonExistentPath = path.join(fixturesPath, 'nonexistent.pdf');
      
      await expect(textExtractor.extractText(nonExistentPath, 'pdf'))
        .rejects.toThrow();
    });
  });

  describe('Word Document Extraction', () => {
    const docxPath = path.join(fixturesPath, 'test.docx');

    beforeEach(() => {
      // Copy test DOCX if it exists
      const sourceDocx = path.join(__dirname, '../../test-files/Contract_Agreement_Test.docx');
      if (fs.existsSync(sourceDocx)) {
        fs.copyFileSync(sourceDocx, docxPath);
      }
    });

    test('should extract text from DOCX files', async () => {
      if (!fs.existsSync(docxPath)) {
        console.log('Skipping DOCX test - no test file available');
        return;
      }

      const result = await textExtractor.extractText(docxPath, 'docx');
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
      expect(result.text.length).toBeGreaterThan(0);
    });

    test('should handle invalid DOCX files', async () => {
      const invalidDocxPath = path.join(fixturesPath, 'invalid.docx');
      fs.writeFileSync(invalidDocxPath, 'This is not a DOCX file');

      await expect(textExtractor.extractText(invalidDocxPath, 'docx'))
        .rejects.toThrow();
    });
  });

  describe('CSV Extraction', () => {
    const csvPath = path.join(fixturesPath, 'test.csv');

    beforeEach(() => {
      const csvContent = `Name,Age,City
John Doe,30,New York
Jane Smith,25,Los Angeles
Bob Johnson,35,Chicago`;
      fs.writeFileSync(csvPath, csvContent);
    });

    test('should extract and analyze CSV data', async () => {
      const result = await textExtractor.extractText(csvPath, 'csv');
      
      expect(result).toBeDefined();
      expect(result.text).toContain('CSV Spreadsheet with 3 columns');
      expect(result.text).toContain('Name, Age, City');
      expect(result.metadata.type).toBe('csv');
      expect(result.metadata.columns).toEqual(['Name', 'Age', 'City']);
      expect(result.metadata.rowCount).toBe(3);
    });

    test('should handle empty CSV files', async () => {
      const emptyCsvPath = path.join(fixturesPath, 'empty.csv');
      fs.writeFileSync(emptyCsvPath, '');

      const result = await textExtractor.extractText(emptyCsvPath, 'csv');
      expect(result.metadata.rowCount).toBe(0);
    });
  });

  describe('Excel Extraction', () => {
    const excelPath = path.join(fixturesPath, 'test.xlsx');

    beforeEach(() => {
      // Copy test Excel if it exists
      const sourceExcel = path.join(__dirname, '../../test-files/Annual_Budget_Report_2024.xlsx');
      if (fs.existsSync(sourceExcel)) {
        fs.copyFileSync(sourceExcel, excelPath);
      }
    });

    test('should extract data from Excel files', async () => {
      if (!fs.existsSync(excelPath)) {
        console.log('Skipping Excel test - no test file available');
        return;
      }

      const result = await textExtractor.extractText(excelPath, 'xlsx');
      
      expect(result).toBeDefined();
      expect(result.text).toContain('Excel Workbook');
      expect(result.metadata.type).toBe('excel');
      expect(result.metadata.sheets).toBeDefined();
      expect(Array.isArray(result.metadata.sheets)).toBe(true);
    });
  });

  describe('Image Extraction', () => {
    const imagePath = path.join(fixturesPath, 'test.png');

    beforeEach(() => {
      // Copy test image if it exists
      const sourceImage = path.join(__dirname, '../../test-files/Receipt_Store_20241215.png');
      if (fs.existsSync(sourceImage)) {
        fs.copyFileSync(sourceImage, imagePath);
      }
    });

    test('should extract text from images using OCR', async () => {
      if (!fs.existsSync(imagePath)) {
        console.log('Skipping image test - no test file available');
        return;
      }

      const result = await textExtractor.extractImage(imagePath);
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.metadata.type).toBe('image');
      expect(result.metadata.format).toBeDefined();
      expect(result.metadata.hasText).toBeDefined();
    }, 30000); // OCR can be slow

    test('should extract image metadata', async () => {
      if (!fs.existsSync(imagePath)) {
        console.log('Skipping image metadata test - no test file available');
        return;
      }

      const metadata = await textExtractor.getImageMetadata(imagePath);
      
      expect(metadata).toBeDefined();
      expect(metadata.format).toBeDefined();
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
    });
  });

  describe('Retry Logic', () => {
    test('should retry extraction on temporary failures', async () => {
      const testPath = path.join(fixturesPath, 'retry-test.txt');
      fs.writeFileSync(testPath, 'test content');

      // Mock a temporary failure scenario
      const originalExtractText = textExtractor.extractText;
      let attemptCount = 0;
      
      textExtractor.extractText = async (filePath, fileType) => {
        attemptCount++;
        if (attemptCount < 2) {
          const error = new Error('Temporary failure');
          error.code = 'EBUSY';
          throw error;
        }
        return originalExtractText.call(textExtractor, filePath, fileType);
      };

      try {
        await textExtractor.tryExtractWithRetry(testPath, 'txt', 3, 100);
        expect(attemptCount).toBe(2);
      } finally {
        // Restore original method
        textExtractor.extractText = originalExtractText;
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle unsupported file types', async () => {
      const unsupportedPath = path.join(fixturesPath, 'test.xyz');
      fs.writeFileSync(unsupportedPath, 'test content');

      await expect(textExtractor.extractText(unsupportedPath, 'xyz'))
        .rejects.toThrow('Unsupported file type: xyz');
    });

    test('should provide meaningful error messages', async () => {
      const nonExistentPath = path.join(fixturesPath, 'nonexistent.pdf');
      
      await expect(textExtractor.extractText(nonExistentPath, 'pdf'))
        .rejects.toThrow(/no such file|ENOENT/i);
    });
  });

  afterEach(() => {
    // Clean up test files
    const testFiles = [
      'test.pdf', 'corrupt.pdf', 'test.docx', 'invalid.docx',
      'test.csv', 'empty.csv', 'test.xlsx', 'test.png', 
      'retry-test.txt', 'test.xyz'
    ];

    testFiles.forEach(file => {
      const filePath = path.join(fixturesPath, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });
});

module.exports = {
  testName: 'TextExtractor Service Tests',
  description: 'Comprehensive tests for text extraction from all supported file formats'
};