import { sendMessageOptimistic } from '../../state/offlineQueue';

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

describe('Offline Queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

