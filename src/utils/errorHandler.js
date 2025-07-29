class ErrorHandler {
  constructor() {
    this.errorLog = [];
  }

  logError(error, context = '') {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      error: error.message || error,
      stack: error.stack,
      context
    };
    
    this.errorLog.push(errorEntry);
    console.error(`[${errorEntry.timestamp}] ${context}: ${errorEntry.error}`);
    
    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }
  }

  async safeExecute(fn, context = '', fallbackValue = null) {
    try {
      return await fn();
    } catch (error) {
      this.logError(error, context);
      return fallbackValue;
    }
  }

  getErrorLog() {
    return this.errorLog;
  }

  clearErrorLog() {
    this.errorLog = [];
  }
}

module.exports = new ErrorHandler();