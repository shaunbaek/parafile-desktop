/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

// Mock electron for all tests
jest.mock('electron', () => ({
  app: {
    getPath: (name) => {
      const os = require('os');
      const path = require('path');
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'parafile-test-config');
      }
      return os.tmpdir();
    },
    on: jest.fn(),
    quit: jest.fn()
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn()
    }
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  Tray: jest.fn(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn()
  })),
  Menu: {
    buildFromTemplate: jest.fn()
  },
  nativeImage: {
    createFromPath: jest.fn()
  },
  Notification: jest.fn(() => ({
    show: jest.fn()
  }))
}));

// Set test environment variables
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});