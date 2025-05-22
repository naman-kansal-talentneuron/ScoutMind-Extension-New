import { StorageManager, StorageAreaName } from '../storageManager'; // Assuming Logger is internally used
import { Logger } from '../logger'; // Import Logger for mock

// Mock the Logger to prevent actual console output during tests
jest.mock('../logger');

const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
  sync: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
  managed: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
};

global.chrome = {
  storage: mockChromeStorage,
  // Mock other chrome APIs if needed by tested code, e.g. runtime
  runtime: {
     lastError: undefined,
     // sendMessage: jest.fn(), 
     // onMessage: { addListener: jest.fn(), removeListener: jest.fn(), hasListener: jest.fn() },
  } as any, // Use 'as any' to simplify mocking only necessary parts
} as any;

describe('StorageManager', () => {
  let storageManager: StorageManager;
  const area: StorageAreaName = 'local';
  let mockStorageArea: jest.Mocked<chrome.storage.StorageArea>;
  let inMemoryStore: { [key: string]: any }; // Declare it here

  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();
    (Logger as jest.Mock).mockClear(); // Clear Logger mock instance counts

    // Initialize an in-memory store for the mock for each test
    inMemoryStore = {}; 

    // Setup mock for the specific area being tested
    mockStorageArea = mockChromeStorage[area] as jest.Mocked<chrome.storage.StorageArea>;
    
    mockStorageArea.get.mockImplementation((keysOrCallback: any, callbackOrUndefined?: (items: { [key: string]: any }) => void) => {
      let keysToGet: string | string[] | { [key: string]: any } | null = null;
      let actualCallback: ((items: { [key: string]: any }) => void);

      if (typeof keysOrCallback === 'function') {
        actualCallback = keysOrCallback;
        keysToGet = null; // Get all items
      } else {
        keysToGet = keysOrCallback;
        actualCallback = callbackOrUndefined!;
      }
      
      const result: { [key: string]: any } = {};
      if (keysToGet === null) {
        Object.assign(result, inMemoryStore);
      } else if (typeof keysToGet === 'string') {
        if (inMemoryStore.hasOwnProperty(keysToGet)) {
          result[keysToGet] = inMemoryStore[keysToGet];
        }
      } else if (Array.isArray(keysToGet)) {
        keysToGet.forEach(key => {
          if (inMemoryStore.hasOwnProperty(key)) {
            result[key] = inMemoryStore[key];
          }
        });
      } else if (typeof keysToGet === 'object') { // Handle object keys (get with defaults)
        Object.entries(keysToGet).forEach(([key, defaultValue]) => {
          result[key] = inMemoryStore.hasOwnProperty(key) ? inMemoryStore[key] : defaultValue;
        });
      }
      // Simulate async callback
      Promise.resolve().then(() => actualCallback(result));
      // Chrome API returns void when callback is used
    });

    mockStorageArea.set.mockImplementation((items: { [key: string]: any }, callback?: () => void) => {
      Object.assign(inMemoryStore, items);
      if (typeof callback === 'function') {
        Promise.resolve().then(() => callback());
      }
      // Chrome API returns void when callback is used
    });

    mockStorageArea.remove.mockImplementation((keysToRemove: string | string[], callback?: () => void) => {
      if (typeof keysToRemove === 'string') {
        delete inMemoryStore[keysToRemove];
      } else if (Array.isArray(keysToRemove)) {
        keysToRemove.forEach(k => delete inMemoryStore[k]);
      }
      if (typeof callback === 'function') {
        Promise.resolve().then(() => callback());
      }
    });

    mockStorageArea.clear.mockImplementation((callback?: () => void) => {
      inMemoryStore = {};
      if (typeof callback === 'function') {
        Promise.resolve().then(() => callback());
      }
    });
    
    storageManager = new StorageManager(area, 'debug');
  });

  it('should get an item', async () => {
    await storageManager.setItem('testKey', 'testValue'); 
    const value = await storageManager.getItem<string>('testKey');
    expect(value).toBe('testValue');
    // Check if the mock was called correctly by StorageManager (which provides a callback)
    expect(mockStorageArea.get).toHaveBeenCalledWith('testKey', expect.any(Function));
  });

  it('should return default value if item not found', async () => {
    const defaultValue = 'default';
    // Ensure key is not in store for this test
    await storageManager.removeItem('nonExistentKey'); 
    const value = await storageManager.getItem<string>('nonExistentKey', defaultValue);
    expect(value).toBe(defaultValue);
    // StorageManager converts getItem(key, defaultValue) to storage.get({[key]: defaultValue}, callback)
    expect(mockStorageArea.get).toHaveBeenCalledWith({ 'nonExistentKey': defaultValue }, expect.any(Function));
  });

  it('should set an item', async () => {
    await storageManager.setItem('newKey', 'newValue');
    expect(mockStorageArea.set).toHaveBeenCalledWith({ 'newKey': 'newValue' }, expect.any(Function));
    const storedValue = await storageManager.getItem('newKey'); // Verify by getting it back
    expect(storedValue).toBe('newValue');
  });

  it('should remove an item', async () => {
    await storageManager.setItem('testKey', 'valueToRemove');
    await storageManager.removeItem('testKey');
    expect(mockStorageArea.remove).toHaveBeenCalledWith('testKey', expect.any(Function));
    const value = await storageManager.getItem('testKey'); 
    expect(value).toBeUndefined();
  });

  it('should clear all items', async () => {
    await storageManager.setItem('key1', 'val1');
    await storageManager.clear();
    expect(mockStorageArea.clear).toHaveBeenCalledWith(expect.any(Function));
    const value = await storageManager.getItem('key1'); 
    expect(value).toBeUndefined();
    expect(Object.keys(inMemoryStore).length).toBe(0); // Check inMemoryStore directly
  });
  
  it('should get all items', async () => {
     await storageManager.setItem('key1', 'val1');
     await storageManager.setItem('key2', 'val2');
     const allItems = await storageManager.getAllItems<{key1: string, key2: string}>();
     expect(mockStorageArea.get).toHaveBeenCalledWith(null, expect.any(Function));
     expect(allItems).toEqual({ key1: 'val1', key2: 'val2' });
  });
});
