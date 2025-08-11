/**
 * Unit Tests for FileOrganizer Service
 * Tests file moving, renaming, and conflict resolution
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const fileOrganizer = require('../../src/services/fileOrganizer');

describe('FileOrganizer Service', () => {
  let testDir;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `parafile-organizer-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (fsSync.existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('File Organization', () => {
    test('should organize file to correct category folder', async () => {
      const sourceFile = path.join(testDir, 'test-document.pdf');
      await fs.writeFile(sourceFile, 'test content');

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Invoices',
        'Invoice_2024-01-15_Company.pdf',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.newPath).toBe(path.join(testDir, 'Invoices', 'Invoice_2024-01-15_Company.pdf'));
      
      // Verify file was moved
      expect(fsSync.existsSync(result.newPath)).toBe(true);
      expect(fsSync.existsSync(sourceFile)).toBe(false);
    });

    test('should create category folder if it doesn\'t exist', async () => {
      const sourceFile = path.join(testDir, 'test.pdf');
      await fs.writeFile(sourceFile, 'content');

      const categoryPath = path.join(testDir, 'New Category');
      expect(fsSync.existsSync(categoryPath)).toBe(false);

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'New Category',
        'organized-file.pdf',
        testDir
      );

      expect(result.success).toBe(true);
      expect(fsSync.existsSync(categoryPath)).toBe(true);
    });

    test('should handle file conflicts with numeric suffix', async () => {
      const sourceFile1 = path.join(testDir, 'test1.pdf');
      const sourceFile2 = path.join(testDir, 'test2.pdf');
      
      await fs.writeFile(sourceFile1, 'content1');
      await fs.writeFile(sourceFile2, 'content2');

      // Create first file
      const result1 = await fileOrganizer.organizeFile(
        sourceFile1,
        'Documents',
        'same-name.pdf',
        testDir
      );

      // Create second file with same name
      const result2 = await fileOrganizer.organizeFile(
        sourceFile2,
        'Documents',
        'same-name.pdf',
        testDir
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      expect(result1.newPath).toBe(path.join(testDir, 'Documents', 'same-name.pdf'));
      expect(result2.newPath).toBe(path.join(testDir, 'Documents', 'same-name (1).pdf'));

      expect(fsSync.existsSync(result1.newPath)).toBe(true);
      expect(fsSync.existsSync(result2.newPath)).toBe(true);
    });

    test('should preserve file extension', async () => {
      const sourceFile = path.join(testDir, 'document.docx');
      await fs.writeFile(sourceFile, 'content');

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Documents',
        'renamed-document.docx',
        testDir
      );

      expect(result.success).toBe(true);
      expect(path.extname(result.newPath)).toBe('.docx');
    });

    test('should handle missing file extension', async () => {
      const sourceFile = path.join(testDir, 'document');
      await fs.writeFile(sourceFile, 'content');

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Documents',
        'renamed-document',
        testDir
      );

      expect(result.success).toBe(true);
      expect(path.extname(result.newPath)).toBe('');
    });
  });

  describe('Conflict Resolution', () => {
    test('should resolve conflicts up to max attempts', async () => {
      const categoryDir = path.join(testDir, 'Conflicts');
      await fs.mkdir(categoryDir, { recursive: true });

      // Create multiple existing files
      for (let i = 0; i < 10; i++) {
        const fileName = i === 0 ? 'conflict.pdf' : `conflict (${i}).pdf`;
        await fs.writeFile(path.join(categoryDir, fileName), `content${i}`);
      }

      const sourceFile = path.join(testDir, 'new-conflict.pdf');
      await fs.writeFile(sourceFile, 'new content');

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Conflicts',
        'conflict.pdf',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.newPath).toBe(path.join(categoryDir, 'conflict (10).pdf'));
    });

    test('should handle deep conflict resolution', async () => {
      const categoryDir = path.join(testDir, 'Deep');
      await fs.mkdir(categoryDir, { recursive: true });

      // Create many conflicting files
      for (let i = 0; i < 100; i++) {
        const fileName = i === 0 ? 'deep-conflict.pdf' : `deep-conflict (${i}).pdf`;
        await fs.writeFile(path.join(categoryDir, fileName), `content${i}`);
      }

      const sourceFile = path.join(testDir, 'new-deep.pdf');
      await fs.writeFile(sourceFile, 'new content');

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Deep',
        'deep-conflict.pdf',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.newPath).toBe(path.join(categoryDir, 'deep-conflict (100).pdf'));
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent source file', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.pdf');

      const result = await fileOrganizer.organizeFile(
        nonExistentFile,
        'Documents',
        'renamed.pdf',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    test('should handle invalid destination path', async () => {
      const sourceFile = path.join(testDir, 'test.pdf');
      await fs.writeFile(sourceFile, 'content');

      const invalidBasePath = '/invalid/path/that/does/not/exist';

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Documents',
        'renamed.pdf',
        invalidBasePath
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle permission errors gracefully', async () => {
      const sourceFile = path.join(testDir, 'test.pdf');
      await fs.writeFile(sourceFile, 'content');

      // Mock fs.rename to throw permission error
      const originalRename = fs.rename;
      fs.rename = jest.fn().mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Documents',
        'renamed.pdf',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission denied');

      // Restore original function
      fs.rename = originalRename;
    });
  });

  describe('Path Utilities', () => {
    test('should sanitize filenames', () => {
      const invalidName = 'file/with\\invalid:*?"<>|chars.pdf';
      const sanitized = fileOrganizer.sanitizeFilename(invalidName);
      
      expect(sanitized).not.toMatch(/[/\\:*?"<>|]/);
      expect(sanitized).toContain('.pdf'); // Should preserve extension
    });

    test('should generate unique filename', () => {
      const baseName = 'document.pdf';
      const unique1 = fileOrganizer.generateUniqueFilename(baseName, 0);
      const unique2 = fileOrganizer.generateUniqueFilename(baseName, 1);
      const unique3 = fileOrganizer.generateUniqueFilename(baseName, 10);

      expect(unique1).toBe('document.pdf');
      expect(unique2).toBe('document (1).pdf');
      expect(unique3).toBe('document (10).pdf');
    });

    test('should handle filenames without extensions', () => {
      const baseName = 'document';
      const unique = fileOrganizer.generateUniqueFilename(baseName, 5);
      
      expect(unique).toBe('document (5)');
    });
  });

  describe('Atomic Operations', () => {
    test('should perform atomic file moves', async () => {
      const sourceFile = path.join(testDir, 'atomic-test.pdf');
      const content = 'important content';
      await fs.writeFile(sourceFile, content);

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Atomic',
        'moved-file.pdf',
        testDir
      );

      expect(result.success).toBe(true);
      
      // Verify content integrity
      const movedContent = await fs.readFile(result.newPath, 'utf8');
      expect(movedContent).toBe(content);
    });

    test('should not leave partial files on failure', async () => {
      const sourceFile = path.join(testDir, 'partial-test.pdf');
      await fs.writeFile(sourceFile, 'content');

      // Mock fs.rename to fail after creating destination directory
      const originalRename = fs.rename;
      let callCount = 0;
      fs.rename = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated failure');
        }
        return originalRename.apply(this, arguments);
      });

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Partial',
        'failed-move.pdf',
        testDir
      );

      expect(result.success).toBe(false);
      
      // Source file should still exist
      expect(fsSync.existsSync(sourceFile)).toBe(true);

      // Restore original function
      fs.rename = originalRename;
    });
  });

  describe('Integration with File Monitor', () => {
    test('should return move information for file monitor', async () => {
      const sourceFile = path.join(testDir, 'monitor-test.pdf');
      await fs.writeFile(sourceFile, 'content');

      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Monitor',
        'organized-file.pdf',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.originalPath).toBe(sourceFile);
      expect(result.newPath).toBeDefined();
      expect(result.category).toBe('Monitor');
      expect(result.fileName).toBe('organized-file.pdf');
    });

    test('should provide timing information', async () => {
      const sourceFile = path.join(testDir, 'timing-test.pdf');
      await fs.writeFile(sourceFile, 'content');

      const startTime = Date.now();
      const result = await fileOrganizer.organizeFile(
        sourceFile,
        'Timing',
        'timed-file.pdf',
        testDir
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.organizationTime).toBeGreaterThanOrEqual(0);
      expect(result.organizationTime).toBeLessThanOrEqual(endTime - startTime);
    });
  });
});

module.exports = {
  testName: 'FileOrganizer Service Tests',
  description: 'Tests for file moving, renaming, and conflict resolution'
};