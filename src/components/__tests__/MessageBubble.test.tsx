import React from 'react';
import { render } from '@testing-library/react-native';
import MessageBubble from '../MessageBubble';

// Mock Timestamp class
const Timestamp = {
  fromDate: (date: Date) => ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }),
};

describe('MessageBubble Component', () => {
  const mockMessage = {
    id: '1',
    senderId: 'user1',
    text: 'Hello, World!',
    status: 'sent' as const,
    priority: 'normal' as const,
    createdAt: Timestamp.fromDate(new Date()),
  };

  it('should render message text', () => {
    const { getByText } = render(
      <MessageBubble item={mockMessage} me="user2" />
    );
    
    expect(getByText('Hello, World!')).toBeTruthy();
  });

  it('should show sender name when showSender is true', () => {
    const { getByText } = render(
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
    const { queryByText } = render(
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
    const { getByText } = render(
      <MessageBubble item={mockMessage} me="user1" />
    );
    
    expect(getByText('✓')).toBeTruthy();
  });

  it('should render double checkmarks for read messages', () => {
    const readMessage = { ...mockMessage, status: 'read' as const };
    const { getByText } = render(
      <MessageBubble item={readMessage} me="user1" />
    );
    
    expect(getByText('✓✓')).toBeTruthy();
  });

  it('should show priority badge for high priority messages', () => {
    const highPriorityMessage = { 
      ...mockMessage, 
      priority: 'high' as const 
    };
    const { getByText } = render(
      <MessageBubble item={highPriorityMessage} me="user2" />
    );
    
    expect(getByText('!')).toBeTruthy();
  });

  it('should not show priority badge for normal priority messages', () => {
    const { queryByText } = render(
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
    
    const { UNSAFE_getByType } = render(
      <MessageBubble item={messageWithImage} me="user2" />
    );
    
    // Check if Image component is rendered
    const images = UNSAFE_getByType(require('react-native').Image);
    expect(images).toBeTruthy();
  });
});

