// Jest matchers are now built into @testing-library/react-native v12.4+
// No need to import extend-expect separately

// Mock Firebase
jest.mock('./src/services/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
  functions: {},
}));

// Mock Expo modules
jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'test-token' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5, DEFAULT: 3 },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

// Silence console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

