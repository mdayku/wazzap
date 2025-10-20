import { renderHook, waitFor } from '@testing-library/react-native';
import { useThreads } from '../useThread';

// Mock Firebase
jest.mock('../../services/firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn((q, callback) => {
    // Simulate initial load with empty threads
    callback({
      docs: [],
      docChanges: () => [],
    });
    return jest.fn(); // unsubscribe
  }),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromMillis: (ms: number) => ({ toMillis: () => ms }),
  },
}));

describe('useThreads', () => {
  it('should initialize with empty threads', async () => {
    const { result } = renderHook(() => useThreads('test-user-123'));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.threads).toEqual([]);
  });

  it('should return null when no userId provided', () => {
    const { result } = renderHook(() => useThreads(null));
    
    expect(result.current.threads).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});

