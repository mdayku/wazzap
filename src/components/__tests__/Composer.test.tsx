import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Composer from '../Composer';

// Mock image picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() => 
    Promise.resolve({
      canceled: false,
      assets: [{ uri: 'file://test-image.jpg' }],
    })
  ),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

// Mock storage service
jest.mock('../../services/storage', () => ({
  uploadImage: jest.fn(() => Promise.resolve('https://storage.url/image.jpg')),
}));

// Mock offline queue
const mockSendMessageOptimistic = jest.fn(() => Promise.resolve());
jest.mock('../../state/offlineQueue', () => ({
  sendMessageOptimistic: mockSendMessageOptimistic,
}));

describe('Composer', () => {
  const defaultProps = {
    threadId: 'test-thread-id',
    uid: 'test-user-id',
    onTyping: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders text input and send button', () => {
    const { getByPlaceholderText } = render(<Composer {...defaultProps} />);
    
    expect(getByPlaceholderText('Message')).toBeTruthy();
    // Send button is now an icon, not text
  });

  it('updates text input value when typing', () => {
    const { getByPlaceholderText } = render(<Composer {...defaultProps} />);
    const input = getByPlaceholderText('Message');
    
    fireEvent.changeText(input, 'Hello, world!');
    
    expect(input.props.value).toBe('Hello, world!');
  });

  it('calls onTyping when user types', () => {
    const onTyping = jest.fn();
    const { getByPlaceholderText } = render(
      <Composer {...defaultProps} onTyping={onTyping} />
    );
    const input = getByPlaceholderText('Message');
    
    fireEvent.changeText(input, 'H');
    
    expect(onTyping).toHaveBeenCalledWith(true);
  });

  it('calls onTyping(false) when text is cleared', () => {
    const onTyping = jest.fn();
    const { getByPlaceholderText } = render(
      <Composer {...defaultProps} onTyping={onTyping} />
    );
    const input = getByPlaceholderText('Message');
    
    fireEvent.changeText(input, 'Hello');
    fireEvent.changeText(input, '');
    
    expect(onTyping).toHaveBeenLastCalledWith(false);
  });

  it('sends message when send button is pressed', async () => {
    const { getByPlaceholderText, getByTestId } = render(<Composer {...defaultProps} />);
    const input = getByPlaceholderText('Message');
    const sendButton = getByTestId('send-button');
    
    fireEvent.changeText(input, 'Test message');
    fireEvent.press(sendButton);
    
    await waitFor(() => {
      expect(mockSendMessageOptimistic).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'test-thread-id',
          text: 'Test message',
        }),
        'test-user-id'
      );
    });
  });

  it('clears input after sending message', async () => {
    const { getByPlaceholderText, getByTestId } = render(<Composer {...defaultProps} />);
    const input = getByPlaceholderText('Message');
    const sendButton = getByTestId('send-button');
    
    fireEvent.changeText(input, 'Test message');
    fireEvent.press(sendButton);
    
    await waitFor(() => {
      expect(input.props.value).toBe('');
    });
  });

  it('does not send empty messages', () => {
    const { getByTestId } = render(<Composer {...defaultProps} />);
    const sendButton = getByTestId('send-button');
    
    fireEvent.press(sendButton);
    
    expect(mockSendMessageOptimistic).not.toHaveBeenCalled();
  });

  it('trims whitespace before sending', async () => {
    const { getByPlaceholderText, getByTestId } = render(<Composer {...defaultProps} />);
    const input = getByPlaceholderText('Message');
    const sendButton = getByTestId('send-button');
    
    fireEvent.changeText(input, '  Test message  ');
    fireEvent.press(sendButton);
    
    await waitFor(() => {
      expect(mockSendMessageOptimistic).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test message',
        }),
        'test-user-id'
      );
    });
  });

  it('disables send button while sending', async () => {
    mockSendMessageOptimistic.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    const { getByPlaceholderText, getByTestId } = render(<Composer {...defaultProps} />);
    const input = getByPlaceholderText('Message');
    const sendButton = getByTestId('send-button');
    
    fireEvent.changeText(input, 'Test');
    fireEvent.press(sendButton);
    
    // Button should be disabled while sending
    expect(sendButton.props.accessibilityState?.disabled).toBe(true);
    
    await waitFor(() => {
      // Button should be enabled after sending
      expect(sendButton.props.accessibilityState?.disabled).toBe(false);
    });
  });
});

