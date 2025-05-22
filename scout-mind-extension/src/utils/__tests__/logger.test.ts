import { Logger, LogLevel } from '../logger';

describe('Logger', () => {
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleDebug: jest.SpyInstance;
  let mockConsoleInfo: jest.SpyInstance;
  let mockConsoleWarn: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation(() => {});
    // console.info, console.warn, console.error often map to console.log in Jest/JSDOM or share its mock.
    // For more precise mocking, ensure they are handled if their behavior differs in your test environment.
    // For this basic test, assuming they use console.log or are covered by its mock.
    mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation(() => {});
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should include context in log messages', () => {
    const logger = new Logger('TestContext', 'debug');
    logger.debug('Test message');
    expect(mockConsoleDebug).toHaveBeenCalledWith(expect.stringContaining('[TestContext] Test message'));
  });

  it('should filter messages below current log level', () => {
    const logger = new Logger('TestLevel', 'info');
    logger.debug('This should not be logged');
    logger.info('This should be logged');
    expect(mockConsoleDebug).not.toHaveBeenCalled();
    expect(mockConsoleInfo).toHaveBeenCalledWith(expect.stringContaining('[TestLevel] This should be logged'));
  });

  it('should log data payload when provided', () => {
    const logger = new Logger('TestData', 'debug');
    const data = { key: 'value' };
    logger.debug('Logging with data', data);
    expect(mockConsoleDebug).toHaveBeenCalledWith(expect.stringContaining('[TestData] Logging with data'), data);
  });

  it('should allow changing log level', () => {
     const logger = new Logger('TestSetLevel', 'warn');
     logger.info('Info before level change'); // Should not log
     expect(mockConsoleInfo).not.toHaveBeenCalled();
     
     logger.setLevel('info');
     logger.info('Info after level change'); // Should log
     expect(mockConsoleInfo).toHaveBeenCalledWith(expect.stringContaining('Info after level change'));
     // Check if the log level change message itself was logged (by default, it uses info)
     expect(mockConsoleInfo).toHaveBeenCalledWith(expect.stringContaining('Log level changed from warn to info'));
  });
});
