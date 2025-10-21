import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MessageBubble from '../MessageBubble';
import { Timestamp } from 'firebase/firestore';

// Mock expo-av for audio playback
const mockSound = {
  unloadAsync: jest.fn(() => Promise.resolve()),
  stopAsync: jest.fn(() => Promise.resolve()),
  setOnPlaybackStatusUpdate: jest.fn(),
};

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({
        sound: mockSound,
      })),
    },
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://documents/',
  downloadAsync: jest.fn(() => Promise.resolve({ 
    status: 200, 
    uri: 'file://downloaded-audio.m4a' 
  })),
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

// Mock firebase
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  Timestamp: {
    now: jest.fn(() => ({
      toMillis: jest.fn(() => Date.now()),
    })),
  },
}));

// Mock ThemeContext
jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      text: '#000000',
      background: '#FFFFFF',
      messageBubbleSent: '#007AFF',
      messageBubbleReceived: '#E5E5EA',
      messageBubbleSentText: '#FFFFFF',
      messageBubbleReceivedText: '#000000',
    },
  }),
}));

describe('MessageBubble - Audio Messages', () => {
  const audioMessage = {
    id: 'msg1',
    senderId: 'user1',
    text: '',
    media: {
      type: 'audio' as const,
      url: 'https://storage.url/audio.m4a',
      duration: 45,
    },
    status: 'read' as const,
    priority: 'normal' as const,
    createdAt: Timestamp.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render audio message with play button', () => {
    const { getByText } = render(
      <MessageBubble
        item={audioMessage}
        me="user2"
        threadId="thread1"
      />
    );

    expect(getByText('Voice Message')).toBeTruthy();
    expect(getByText('0:45')).toBeTruthy();
  });

  it('should display correct duration format', () => {
    const longAudioMessage = {
      ...audioMessage,
      media: {
        ...audioMessage.media!,
        duration: 125, // 2:05
      },
    };

    const { getByText } = render(
      <MessageBubble
        item={longAudioMessage}
        me="user2"
        threadId="thread1"
      />
    );

    expect(getByText('2:05')).toBeTruthy();
  });

  it('should show share and delete buttons for sent messages', () => {
    const { UNSAFE_queryAllByType } = render(
      <MessageBubble
        item={{ ...audioMessage, senderId: 'user1' }}
        me="user1"
        threadId="thread1"
      />
    );

    // Both share and delete buttons should be present
    // (Testing via TouchableOpacity components)
    const touchables = UNSAFE_queryAllByType(require('react-native').TouchableOpacity);
    
    // Should have: long-press wrapper, play button, share button, delete button
    expect(touchables.length).toBeGreaterThan(3);
  });

  it('should show share button for received messages', () => {
    const { UNSAFE_queryAllByType } = render(
      <MessageBubble
        item={{ ...audioMessage, senderId: 'user2' }}
        me="user1"
        threadId="thread1"
      />
    );

    // Should have share button for received messages too
    const touchables = UNSAFE_queryAllByType(require('react-native').TouchableOpacity);
    expect(touchables.length).toBeGreaterThan(2);
  });

  it('should format duration correctly for various lengths', () => {
    const testCases = [
      { duration: 5, expected: '0:05' },
      { duration: 30, expected: '0:30' },
      { duration: 60, expected: '1:00' },
      { duration: 125, expected: '2:05' },
      { duration: 600, expected: '10:00' },
    ];

    testCases.forEach(({ duration, expected }) => {
      const message = {
        ...audioMessage,
        media: { ...audioMessage.media!, duration },
      };

      const { getByText } = render(
        <MessageBubble
          item={message}
          me="user2"
          threadId="thread1"
        />
      );

      expect(getByText(expected)).toBeTruthy();
    });
  });

  it('should handle audio message without duration', () => {
    const messageWithoutDuration = {
      ...audioMessage,
      media: {
        type: 'audio' as const,
        url: 'https://storage.url/audio.m4a',
      },
    };

    const { getByText, queryByText } = render(
      <MessageBubble
        item={messageWithoutDuration}
        me="user2"
        threadId="thread1"
      />
    );

    expect(getByText('Voice Message')).toBeTruthy();
    // Duration should not be shown if not available
    expect(queryByText(/:/)).toBeFalsy();
  });

  it('should apply correct theme colors for sent messages', () => {
    const { getByText } = render(
      <MessageBubble
        item={{ ...audioMessage, senderId: 'user1' }}
        me="user1"
        threadId="thread1"
      />
    );

    const voiceText = getByText('Voice Message');
    // Should have white text color for sent messages
    expect(voiceText.props.style).toContainEqual(
      expect.objectContaining({ color: '#FFFFFF' })
    );
  });

  it('should apply correct theme colors for received messages', () => {
    const { getByText } = render(
      <MessageBubble
        item={{ ...audioMessage, senderId: 'user2' }}
        me="user1"
        threadId="thread1"
      />
    );

    const voiceText = getByText('Voice Message');
    // Should have dark text color for received messages
    expect(voiceText.props.style).toContainEqual(
      expect.objectContaining({ color: '#000000' })
    );
  });
});

