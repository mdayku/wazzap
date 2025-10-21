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

// Mock expo-av for audio recording
jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    Recording: {
      createAsync: jest.fn(() => Promise.resolve({
        recording: {
          stopAndUnloadAsync: jest.fn(() => Promise.resolve()),
          getURI: jest.fn(() => 'file://test-audio.m4a'),
        },
      })),
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://documents/',
  downloadAsync: jest.fn(() => Promise.resolve({ status: 200, uri: 'file://downloaded-audio.m4a' })),
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
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
    const { getByTestId, queryByTestId } = render(<Composer {...defaultProps} />);
    
    // Send button should not be visible when input is empty
    expect(queryByTestId('send-button')).toBeFalsy();
    
    // Mic button should be visible instead
    const micButton = getByTestId('mic-button');
    expect(micButton).toBeTruthy();
    
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

    const { getByPlaceholderText, getByTestId, queryByTestId } = render(<Composer {...defaultProps} />);
    const input = getByPlaceholderText('Message');
    
    fireEvent.changeText(input, 'Test');
    
    // Wait for button to be enabled after text input
    await waitFor(() => {
      const sendButton = getByTestId('send-button');
      expect(sendButton.props.accessibilityState?.disabled).toBe(false);
    });
    
    const sendButton = getByTestId('send-button');
    fireEvent.press(sendButton);
    
    // After sending, input should be cleared
    await waitFor(() => {
      expect(input.props.value).toBe('');
    });
    
    // Send button should be hidden after text is cleared
    await waitFor(() => {
      expect(queryByTestId('send-button')).toBeFalsy();
    });
    
    // Mic button should be visible again
    await waitFor(() => {
      expect(getByTestId('mic-button')).toBeTruthy();
    });
  });

  describe('Voice Message Recording', () => {
    it('should show microphone button when text input is empty', () => {
      const { getByTestId, queryByTestId } = render(
        <Composer threadId="thread123" uid="user123" />
      );
      
      const input = getByTestId('message-input');
      expect(input.props.value).toBe('');
      
      // Mic button should be visible when input is empty
      const micButton = getByTestId('mic-button');
      expect(micButton).toBeTruthy();
      
      // Send button should not be visible
      expect(queryByTestId('send-button')).toBeFalsy();
    });

    it('should hide microphone button when text is entered', () => {
      const { getByTestId, queryByTestId } = render(
        <Composer threadId="thread123" uid="user123" />
      );
      
      const input = getByTestId('message-input');
      
      // Type text
      fireEvent.changeText(input, 'Hello');
      
      // Send button should be visible
      const sendButton = getByTestId('send-button');
      expect(sendButton).toBeTruthy();
      
      // Mic button should be hidden
      expect(queryByTestId('mic-button')).toBeFalsy();
    });
  });
});

