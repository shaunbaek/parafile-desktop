/**
 * Unit Tests for FileMonitor Service
 * Tests file system monitoring and event handling
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const fileMonitor = require('../../src/services/fileMonitor');

describe('FileMonitor Service', () => {
  let testDir;
  let eventLog;

  beforeEach(() => {
    // Create unique test directory
    testDir = path.join(os.tmpdir(), `parafile-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    eventLog = [];
    
    // Set up event listeners
    fileMonitor.on('file-detected', (fileInfo) => {
      eventLog.push({ type: 'file-detected', data: fileInfo });
    });
    
    fileMonitor.on('file-moved-by-user', (fileInfo) => {
      eventLog.push({ type: 'file-moved-by-user', data: fileInfo });
    });
    
    fileMonitor.on('error', (error) => {
      eventLog.push({ type: 'error', data: error });
    });
    
    fileMonitor.on('started', () => {
      eventLog.push({ type: 'started' });
    });
    
    fileMonitor.on('stopped', () => {
      eventLog.push({ type: 'stopped' });
    });
  });

  afterEach(() => {
    // Stop monitoring and clean up
    if (fileMonitor.getStatus()) {
      fileMonitor.stop();
    }
    
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    // Remove all listeners
    fileMonitor.removeAllListeners();
    eventLog = [];
  });

  describe('Monitor Lifecycle', () => {
    test('should start monitoring a folder', (done) => {
      expect(fileMonitor.getStatus()).toBe(false);
      
      fileMonitor.once('started', () => {
        expect(fileMonitor.getStatus()).toBe(true);
        done();
      });
      
      fileMonitor.start(testDir);
    });

    test('should stop monitoring', (done) => {
      fileMonitor.once('started', () => {
        expect(fileMonitor.getStatus()).toBe(true);
        
        fileMonitor.once('stopped', () => {
          expect(fileMonitor.getStatus()).toBe(false);
          done();
        });
        
        fileMonitor.stop();
      });
      
      fileMonitor.start(testDir);
    });

    test('should handle invalid folder path', () => {
      const invalidPath = '/nonexistent/folder/path';
      
      fileMonitor.start(invalidPath);
      
      // Should emit error or handle gracefully
      expect(fileMonitor.getStatus()).toBe(false);
    });

    test('should prevent double start', (done) => {
      fileMonitor.once('started', () => {
        expect(fileMonitor.getStatus()).toBe(true);
        
        // Try to start again - should not emit another 'started' event
        const startedCount = eventLog.filter(e => e.type === 'started').length;
        fileMonitor.start(testDir);
        
        setTimeout(() => {
          const newStartedCount = eventLog.filter(e => e.type === 'started').length;
          expect(newStartedCount).toBe(startedCount);
          done();
        }, 100);
      });
      
      fileMonitor.start(testDir);
    });
  });

  describe('File Detection', () => {
    beforeEach((done) => {
      fileMonitor.once('started', () => done());
      fileMonitor.start(testDir);
    });

    test('should detect PDF files', (done) => {
      const pdfPath = path.join(testDir, 'test-document.pdf');
      
      fileMonitor.once('file-detected', (fileInfo) => {
        expect(fileInfo.path).toBe(pdfPath);
        expect(fileInfo.type).toBe('pdf');
        expect(fileInfo.eventType).toBe('add');
        done();
      });
      
      // Wait a bit for monitor to be ready, then create file
      setTimeout(() => {
        fs.writeFileSync(pdfPath, 'dummy PDF content');
      }, 100);
    });

    test('should detect Word documents', (done) => {
      const docPath = path.join(testDir, 'test-document.docx');
      
      fileMonitor.once('file-detected', (fileInfo) => {
        expect(fileInfo.path).toBe(docPath);
        expect(fileInfo.type).toBe('docx');
        done();
      });
      
      setTimeout(() => {
        fs.writeFileSync(docPath, 'dummy DOCX content');
      }, 100);
    });

    test('should detect spreadsheet files', (done) => {
      const xlsxPath = path.join(testDir, 'test-spreadsheet.xlsx');
      
      fileMonitor.once('file-detected', (fileInfo) => {
        expect(fileInfo.path).toBe(xlsxPath);
        expect(fileInfo.type).toBe('xlsx');
        done();
      });
      
      setTimeout(() => {
        fs.writeFileSync(xlsxPath, 'dummy Excel content');
      }, 100);
    });

    test('should detect image files', (done) => {
      const pngPath = path.join(testDir, 'test-image.png');
      
      fileMonitor.once('file-detected', (fileInfo) => {
        expect(fileInfo.path).toBe(pngPath);
        expect(fileInfo.type).toBe('png');
        done();
      });
      
      setTimeout(() => {
        fs.writeFileSync(pngPath, 'dummy PNG content');
      }, 100);
    });

    test('should ignore unsupported file types', (done) => {
      const txtPath = path.join(testDir, 'test-file.txt');
      
      // Should not emit file-detected for unsupported types
      fileMonitor.once('file-detected', () => {
        done(new Error('Should not detect unsupported file types'));
      });
      
      setTimeout(() => {
        fs.writeFileSync(txtPath, 'dummy text content');
        
        // Wait a bit more to ensure no event is emitted
        setTimeout(() => {
          done();
        }, 200);
      }, 100);
    });

    test('should ignore dotfiles', (done) => {
      const dotFilePath = path.join(testDir, '.hidden-file.pdf');
      
      fileMonitor.once('file-detected', () => {
        done(new Error('Should not detect dotfiles'));
      });
      
      setTimeout(() => {
        fs.writeFileSync(dotFilePath, 'dummy PDF content');
        
        setTimeout(() => {
          done();
        }, 200);
      }, 100);
    });

    test('should detect files in subdirectories', (done) => {
      const subDir = path.join(testDir, 'subfolder');
      const subFilePath = path.join(subDir, 'test-sub.pdf');
      
      fs.mkdirSync(subDir);
      
      fileMonitor.once('file-detected', (fileInfo) => {
        expect(fileInfo.path).toBe(subFilePath);
        expect(fileInfo.type).toBe('pdf');
        done();
      });
      
      setTimeout(() => {
        fs.writeFileSync(subFilePath, 'dummy PDF content');
      }, 100);
    });
  });

  describe('Duplicate Processing Prevention', () => {
    beforeEach((done) => {
      fileMonitor.once('started', () => done());
      fileMonitor.start(testDir);
    });

    test('should prevent processing same file twice', (done) => {
      const pdfPath = path.join(testDir, 'duplicate-test.pdf');
      let detectionCount = 0;
      
      fileMonitor.on('file-detected', () => {
        detectionCount++;
      });
      
      // Create file
      setTimeout(() => {
        fs.writeFileSync(pdfPath, 'dummy PDF content');
        
        // Try to trigger detection again by touching the file
        setTimeout(() => {
          fs.utimesSync(pdfPath, new Date(), new Date());
          
          // Wait and check detection count
          setTimeout(() => {
            expect(detectionCount).toBe(1);
            done();
          }, 300);
        }, 200);
      }, 100);
    });
  });

  describe('ParaFile File Tracking', () => {
    beforeEach((done) => {
      fileMonitor.once('started', () => done());
      fileMonitor.start(testDir);
    });

    test('should mark files as moved by ParaFile', () => {
      const originalPath = path.join(testDir, 'original.pdf');
      const newPath = path.join(testDir, 'renamed.pdf');
      
      fileMonitor.markFileAsMoved(originalPath, newPath);
      
      // The moved files should be tracked
      expect(fileMonitor.parafileMovedFiles).toBeDefined();
    });

    test('should ignore ParaFile-moved files', (done) => {
      const originalPath = path.join(testDir, 'to-be-moved.pdf');
      const newPath = path.join(testDir, 'moved-file.pdf');
      
      // Mark file as moved by ParaFile
      fileMonitor.markFileAsMoved(originalPath, newPath);
      
      let detectionCount = 0;
      fileMonitor.on('file-detected', () => {
        detectionCount++;
      });
      
      setTimeout(() => {
        // Create the "moved" file - should be ignored
        fs.writeFileSync(newPath, 'dummy PDF content');
        
        setTimeout(() => {
          expect(detectionCount).toBe(0);
          done();
        }, 300);
      }, 100);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing folder gracefully', () => {
      expect(() => {
        fileMonitor.start('');
      }).not.toThrow();
      
      // Should emit error event
      setTimeout(() => {
        const errorEvents = eventLog.filter(e => e.type === 'error');
        expect(errorEvents.length).toBeGreaterThan(0);
      }, 100);
    });

    test('should handle file system errors', (done) => {
      fileMonitor.once('started', () => {
        // Create a file that will cause issues
        const problematicPath = path.join(testDir, 'problematic.pdf');
        fs.writeFileSync(problematicPath, 'content');
        
        // Immediately delete to simulate file system race condition
        fs.unlinkSync(problematicPath);
        
        // Monitor should handle this gracefully
        setTimeout(() => {
          expect(fileMonitor.getStatus()).toBe(true);
          done();
        }, 500);
      });
      
      fileMonitor.start(testDir);
    });
  });

  describe('Performance and Stability', () => {
    test('should handle rapid file creation', (done) => {
      fileMonitor.once('started', () => {
        let detectionCount = 0;
        const expectedFiles = 5;
        
        fileMonitor.on('file-detected', () => {
          detectionCount++;
          if (detectionCount === expectedFiles) {
            done();
          }
        });
        
        // Rapidly create multiple files
        for (let i = 0; i < expectedFiles; i++) {
          setTimeout(() => {
            const filePath = path.join(testDir, `rapid-${i}.pdf`);
            fs.writeFileSync(filePath, `content ${i}`);
          }, i * 10);
        }
      });
      
      fileMonitor.start(testDir);
    });

    test('should maintain stability under file system stress', (done) => {
      fileMonitor.once('started', () => {
        // Create and delete files rapidly
        for (let i = 0; i < 20; i++) {
          setTimeout(() => {
            const filePath = path.join(testDir, `stress-${i}.pdf`);
            fs.writeFileSync(filePath, `content ${i}`);
            
            setTimeout(() => {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            }, 50);
          }, i * 25);
        }
        
        // Check monitor is still running after stress test
        setTimeout(() => {
          expect(fileMonitor.getStatus()).toBe(true);
          done();
        }, 1000);
      });
      
      fileMonitor.start(testDir);
    });
  });
});

module.exports = {
  testName: 'FileMonitor Service Tests',
  description: 'Comprehensive tests for file system monitoring and event handling'
};