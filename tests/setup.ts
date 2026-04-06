// Test setup file
import { jest } from '@jest/globals';

// Mock Electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test'),
    isPackaged: false,
    on: jest.fn(),
    quit: jest.fn(),
    whenReady: jest.fn().mockResolvedValue(undefined as never)
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn()
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  },
  BrowserWindow: jest.fn()
}));

jest.mock('electron-log', () => ({
  scope: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
