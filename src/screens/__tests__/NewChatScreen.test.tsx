import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NewChatScreen from '../NewChatScreen';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock Firebase
jest.mock('../../services/firebase', () => ({
  db: {},
}));

// Mock useAuth
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-id', email: 'test@example.com' },
  }),
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({
    docs: [
      {
        id: 'user1',
        data: () => ({
          uid: 'user1',
          displayName: 'Test User 1',
          email: 'user1@test.com',
        }),
      },
      {
        id: 'user2',
        data: () => ({
          uid: 'user2',
          displayName: 'Test User 2',
          email: 'user2@test.com',
        }),
      },
    ],
  })),
  where: jest.fn(),
  addDoc: jest.fn(() => Promise.resolve({ id: 'new-thread-id' })),
  serverTimestamp: jest.fn(() => 'timestamp'),
}));

describe('NewChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    const { getByTestId } = render(<NewChatScreen />);
    // Initially should show loading
    expect(() => getByTestId('user-list')).toThrow();
  });

  it('renders search input', async () => {
    const { getByPlaceholderText } = render(<NewChatScreen />);
    await waitFor(() => {
      expect(getByPlaceholderText('Search users...')).toBeTruthy();
    });
  });

  it('displays user list after loading', async () => {
    const { getByText } = render(<NewChatScreen />);
    await waitFor(() => {
      expect(getByText('Test User 1')).toBeTruthy();
      expect(getByText('user1@test.com')).toBeTruthy();
    });
  });

  it('filters users based on search query', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<NewChatScreen />);
    
    await waitFor(() => {
      expect(getByText('Test User 1')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('Search users...');
    fireEvent.changeText(searchInput, 'User 1');

    await waitFor(() => {
      expect(getByText('Test User 1')).toBeTruthy();
      expect(queryByText('Test User 2')).toBeNull();
    });
  });

  it('shows empty state when no users match search', async () => {
    const { getByPlaceholderText, getByText } = render(<NewChatScreen />);
    
    await waitFor(() => {
      expect(getByText('Test User 1')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('Search users...');
    fireEvent.changeText(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(getByText('No users found')).toBeTruthy();
    });
  });
});

