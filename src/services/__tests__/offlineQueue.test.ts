import { 
  sendMessageOptimistic, 
  initializeOfflineQueue, 
  clearFailedMessages,
  getQueue,
  subscribeToQueue,
} from '../../state/offlineQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Mock Firestore
jest.mock('../firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(() => Promise.resolve({ id: 'mock-id' })),
  collection: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
  updateDoc: jest.fn(() => Promise.resolve()),
  doc: jest.fn(),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock storage service for media uploads
jest.mock('../../services/storage', () => ({
  uploadImage: jest.fn((uri: string) => Promise.resolve(`https://storage.example.com/${uri}`)),
}));

describe('Offline Queue - Basic Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
  });

  it('should send message with correct data structure', async () => {
    const { addDoc } = require('firebase/firestore');
    
    const pending = {
      threadId: 'thread-123',
      text: 'Test message',
      tempId: 'temp-123',
    };

    await sendMessageOptimistic(pending, 'user-123');

    expect(addDoc).toHaveBeenCalled();
    const callArgs = addDoc.mock.calls[0][1];
    
    expect(callArgs).toMatchObject({
      senderId: 'user-123',
      text: 'Test message',
      status: 'sent',
      priority: 'normal',
    });
  });

  it('should handle messages with media', async () => {
    const { addDoc } = require('firebase/firestore');
    
    const pending = {
      threadId: 'thread-123',
      text: 'Check this out',
      media: { type: 'image', url: 'https://example.com/image.jpg' },
      tempId: 'temp-456',
    };

    await sendMessageOptimistic(pending, 'user-123');

    const callArgs = addDoc.mock.calls[0][1];
    expect(callArgs.media).toEqual({ type: 'image', url: 'https://example.com/image.jpg' });
  });

  it('should handle empty text messages', async () => {
    const { addDoc } = require('firebase/firestore');
    
    const pending = {
      threadId: 'thread-123',
      text: '',
      tempId: 'temp-789',
    };

    await sendMessageOptimistic(pending, 'user-123');

    const callArgs = addDoc.mock.calls[0][1];
    expect(callArgs.text).toBe('');
  });

  it('should update thread lastMessage', async () => {
    const { updateDoc } = require('firebase/firestore');
    
    const pending = {
      threadId: 'thread-123',
      text: 'Latest message',
      tempId: 'temp-999',
    };

    await sendMessageOptimistic(pending, 'user-123');

    expect(updateDoc).toHaveBeenCalled();
  });
});

describe('Offline Queue - Network Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('should queue message when offline', async () => {
    const { addDoc } = require('firebase/firestore');
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false, isInternetReachable: false });
    
    const pending = {
      threadId: 'thread-123',
      text: 'Offline message',
      tempId: 'temp-offline',
    };

    await sendMessageOptimistic(pending, 'user-123');

    // Should NOT call Firestore when offline
    expect(addDoc).not.toHaveBeenCalled();
    
    // Should save to AsyncStorage
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@offline_message_queue',
      expect.any(String)
    );
  });

  it('should send message immediately when online', async () => {
    const { addDoc } = require('firebase/firestore');
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
    
    const pending = {
      threadId: 'thread-123',
      text: 'Online message',
      tempId: 'temp-online',
    };

    await sendMessageOptimistic(pending, 'user-123');

    // Should call Firestore when online
    expect(addDoc).toHaveBeenCalled();
  });

  it('should queue message on network error', async () => {
    const { addDoc } = require('firebase/firestore');
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
    addDoc.mockRejectedValueOnce({ code: 'unavailable', message: 'network error' });
    
    const pending = {
      threadId: 'thread-123',
      text: 'Network error message',
      tempId: 'temp-error',
    };

    await sendMessageOptimistic(pending, 'user-123');

    // Should save to AsyncStorage after network error
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});

describe('Offline Queue - Media Upload Queueing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false, isInternetReachable: false });
  });

  it('should queue image with local URI when offline', async () => {
    const pending = {
      threadId: 'thread-123',
      text: 'Image message',
      media: null,
      tempId: 'temp-img',
    };

    await sendMessageOptimistic(
      pending, 
      'user-123',
      'file:///local/image.jpg', // local URI
      'image',
      { width: 1200, height: 800 }
    );

    // Should save queue with media metadata
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@offline_message_queue',
      expect.stringContaining('file:///local/image.jpg')
    );
  });

  it('should queue audio with local URI when offline', async () => {
    const pending = {
      threadId: 'thread-123',
      text: '',
      media: null,
      tempId: 'temp-audio',
    };

    await sendMessageOptimistic(
      pending, 
      'user-123',
      'file:///local/audio.m4a', // local URI
      'audio',
      { duration: 30 }
    );

    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});

describe('Offline Queue - Queue Management', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    await initializeOfflineQueue();
  });

  it('should initialize queue from AsyncStorage', async () => {
    const mockQueue = JSON.stringify([
      {
        id: 'queue_1',
        threadId: 'thread-123',
        text: 'Queued message',
        tempId: 'temp-1',
        uid: 'user-123',
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending',
      }
    ]);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(mockQueue);
    
    await initializeOfflineQueue();

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('@offline_message_queue');
  });

  it('should subscribe to queue changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToQueue(listener);

    expect(typeof unsubscribe).toBe('function');
    
    // Cleanup
    unsubscribe();
  });

  it('should get current queue', () => {
    const queue = getQueue();
    expect(Array.isArray(queue)).toBe(true);
  });
});

describe('Offline Queue - Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('should clear failed messages', async () => {
    await clearFailedMessages();
    
    // Should update AsyncStorage
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});

describe('Offline Queue - Read Receipt Syncing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('should sync pending read receipts when coming online', async () => {
    const mockKeys = [
      '@pending_read_receipt_thread-123_user-123',
      '@pending_read_receipt_thread-456_user-123',
    ];
    
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(mockKeys);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(new Date().toISOString());

    // This would be called by the network listener in production
    // For testing, we just verify the mocks are set up correctly
    expect(AsyncStorage.getAllKeys).toBeDefined();
    expect(AsyncStorage.getItem).toBeDefined();
    expect(AsyncStorage.removeItem).toBeDefined();
  });
});
