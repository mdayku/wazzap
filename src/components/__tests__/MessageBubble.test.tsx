import React from 'react';
import { render } from '@testing-library/react-native';
import MessageBubble, { Message } from '../MessageBubble';
import { ThemeProvider } from '../../contexts/ThemeContext';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
    setAudioModeAsync: jest.fn(),
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({
  downloadAsync: jest.fn(),
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
}));

// Mock Timestamp class
const Timestamp = {
  fromDate: (date: Date) => ({
    toDate: () => date,
    toMillis: () => date.getTime(),
    valueOf: () => date.getTime().toString(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    isEqual: () => false,
    toJSON: () => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0, type: 'timestamp' }),
  }) as any,
};

// Helper to render with ThemeProvider
const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('MessageBubble Component', () => {
  const mockMessage: Message = {
    id: '1',
    senderId: 'user1',
    text: 'Hello, World!',
    media: null,
    status: 'sent' as const,
    priority: 'normal' as const,
    createdAt: Timestamp.fromDate(new Date()),
  };

  it('should render message text', () => {
    const { getByText } = renderWithTheme(
      <MessageBubble item={mockMessage} me="user2" />
    );
    
    expect(getByText('Hello, World!')).toBeTruthy();
  });

  it('should show sender name when showSender is true', () => {
    const { getByText } = renderWithTheme(
      <MessageBubble 
        item={mockMessage} 
        me="user2" 
        showSender={true}
        senderName="John Doe"
      />
    );
    
    expect(getByText('John Doe')).toBeTruthy();
  });

  it('should not show sender name when showSender is false', () => {
    const { queryByText } = renderWithTheme(
      <MessageBubble 
        item={mockMessage} 
        me="user2" 
        showSender={false}
        senderName="John Doe"
      />
    );
    
    expect(queryByText('John Doe')).toBeNull();
  });

  it('should render status checkmarks for sent messages', () => {
    const { getByText } = renderWithTheme(
      <MessageBubble item={mockMessage} me="user1" />
    );
    
    expect(getByText('✓')).toBeTruthy();
  });

  it('should render double checkmarks for read messages', () => {
    const messageTime = Date.now() - 10000; // Message sent 10 seconds ago
    const readMessage = { 
      ...mockMessage, 
      status: 'read' as const,
      createdAt: Timestamp.fromDate(new Date(messageTime))
    };
    
    // Mock thread members and lastRead for read receipt calculation
    const threadMembers = ['user1', 'user2'];
    const threadLastRead = {
      'user2': { 
        toMillis: () => Date.now(),
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: 0
      } // Read after message (now > messageTime)
    };
    
    const { getByText } = renderWithTheme(
      <MessageBubble 
        item={readMessage} 
        me="user1" 
        threadMembers={threadMembers}
        threadLastRead={threadLastRead}
      />
    );
    
    expect(getByText('✓✓')).toBeTruthy();
  });

  it('should show priority badge for high priority messages', () => {
    const highPriorityMessage = { 
      ...mockMessage,
      media: null,
      priority: 'high' as const 
    };
    const { getByText } = renderWithTheme(
      <MessageBubble item={highPriorityMessage} me="user2" />
    );
    
    expect(getByText('!')).toBeTruthy();
  });

  it('should not show priority badge for normal priority messages', () => {
    const { queryByText } = renderWithTheme(
      <MessageBubble item={mockMessage} me="user2" />
    );
    
    expect(queryByText('!')).toBeNull();
  });

  it('should render image when media is present', () => {
    const messageWithImage = {
      ...mockMessage,
      media: {
        type: 'image' as const,
        url: 'https://example.com/image.jpg',
        width: 200,
        height: 200,
      },
    };
    
    const { UNSAFE_getByType } = renderWithTheme(
      <MessageBubble item={messageWithImage} me="user2" />
    );
    
    // Check if expo-image Image component is rendered
    const images = UNSAFE_getByType(require('expo-image').Image);
    expect(images).toBeTruthy();
  });
});

