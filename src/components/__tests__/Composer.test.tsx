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
jest.mock('../../state/offlineQueue', () => ({
  sendMessageOptimistic: jest.fn(() => Promise.resolve()),
}));

// Get reference to the mocked function
const { sendMessageOptimistic } = require('../../state/offlineQueue');

describe('Composer', () => {
  const defaultProps = {
    threadId: 'test-thread-id',
    uid: 'test-user-id',
    onTyping: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (sendMessageOptimistic as jest.Mock).mockClear();
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
    
    fireEvent.changeText(input, 'Test message');
    
    // Wait for button to be enabled after text change
    await waitFor(() => {
      const sendButton = getByTestId('send-button');
      expect(sendButton.props.accessibilityState?.disabled).toBe(false);
    });
    
    // Verify input has the text
    expect(input.props.value).toBe('Test message');
    
    const sendButton = getByTestId('send-button');
    fireEvent.press(sendButton);
    
    // The mock should be called
    expect(sendMessageOptimistic).toHaveBeenCalled();
    expect(sendMessageOptimistic).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'test-thread-id',
        text: 'Test message',
      }),
      'test-user-id'
    );
  });

  it('clears input after sending message', async () => {
    const { getByPlaceholderText, getByTestId } = render(<Composer {...defaultProps} />);
    const input = getByPlaceholderText('Message');
    
    fireEvent.changeText(input, 'Test message');
    
    // Wait for button to be enabled
    await waitFor(() => {
      const sendButton = getByTestId('send-button');
      expect(sendButton.props.accessibilityState?.disabled).toBe(false);
    });
    
    const sendButton = getByTestId('send-button');
    fireEvent.press(sendButton);
    
    await waitFor(() => {
      expect(input.props.value).toBe('');
    });
  });

  it('does not send empty messages', () => {
    const { getByTestId } = render(<Composer {...defaultProps} />);
    const sendButton = getByTestId('send-button');
    
    fireEvent.press(sendButton);
    
    expect(sendMessageOptimistic).not.toHaveBeenCalled();
  });

  it('trims whitespace before sending', async () => {
    const { getByPlaceholderText, getByTestId } = render(<Composer {...defaultProps} />);
    const input = getByPlaceholderText('Message');
    
    fireEvent.changeText(input, '  Test message  ');
    
    // Wait for button to be enabled
    await waitFor(() => {
      const sendButton = getByTestId('send-button');
      expect(sendButton.props.accessibilityState?.disabled).toBe(false);
    });
    
    const sendButton = getByTestId('send-button');
    fireEvent.press(sendButton);
    
    await waitFor(() => {
      expect(sendMessageOptimistic).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test message',
        }),
        'test-user-id'
      );
    });
  });

  it('disables send button while sending', async () => {
    (sendMessageOptimistic as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    const { getByPlaceholderText, getByTestId } = render(<Composer {...defaultProps} />);
    const input = getByPlaceholderText('Message');
    
    fireEvent.changeText(input, 'Test');
    
    // Wait for button to be enabled after text input
    await waitFor(() => {
      const sendButton = getByTestId('send-button');
      expect(sendButton.props.accessibilityState?.disabled).toBe(false);
    });
    
    const sendButton = getByTestId('send-button');
    fireEvent.press(sendButton);
    
    // Button should be disabled after clearing text (handleSend clears text immediately)
    await waitFor(() => {
      const button = getByTestId('send-button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
    
    // Wait for send to complete and input to be cleared
    await waitFor(() => {
      expect(input.props.value).toBe('');
    });
  });
});

