import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../useAuth';

// Mock Firebase
const mockOnAuthStateChanged = jest.fn();
const mockSignInWithEmailAndPassword = jest.fn(() => 
  Promise.resolve({ user: { uid: 'test-uid', email: 'test@example.com' } })
);
const mockCreateUserWithEmailAndPassword = jest.fn(() => 
  Promise.resolve({ user: { uid: 'new-uid', email: 'newuser@example.com' } })
);
const mockSignOut = jest.fn(() => Promise.resolve());

jest.mock('../../services/firebase', () => ({
  auth: {},
  db: {},
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    mockOnAuthStateChanged(callback);
    return jest.fn(); // unsubscribe function
  },
  signInWithEmailAndPassword: jest.fn((...args: unknown[]) => mockSignInWithEmailAndPassword(...args)),
  createUserWithEmailAndPassword: jest.fn((...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args)),
  signOut: jest.fn((...args: unknown[]) => mockSignOut(...args)),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'timestamp'),
}));

// Mock Zustand store
const mockSetUser = jest.fn();
const mockSetIsLoading = jest.fn();

jest.mock('../../state/store', () => ({
  useStore: () => ({
    user: null,
    setUser: mockSetUser,
    setIsLoading: mockSetIsLoading,
    isLoading: true,
  }),
}));

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes auth state listener on mount', () => {
    renderHook(() => useAuth());
    expect(mockOnAuthStateChanged).toHaveBeenCalled();
  });

  it('calls login with email and password', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'test-uid', email: 'test@example.com' },
    });

    const { result } = renderHook(() => useAuth());
    
    await waitFor(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'test@example.com',
      'password123'
    );
  });

  it('calls signup with email, password, and display name', async () => {
    mockCreateUserWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'new-uid', email: 'newuser@example.com' },
    });

    const { result } = renderHook(() => useAuth());
    
    await waitFor(async () => {
      await result.current.signup('newuser@example.com', 'password123', 'New User');
    });

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'newuser@example.com',
      'password123'
    );
  });

  it('calls logout', async () => {
    mockSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());
    
    await waitFor(async () => {
      await result.current.logout();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('handles login errors', async () => {
    const error = new Error('Invalid credentials');
    mockSignInWithEmailAndPassword.mockRejectedValue(error);

    const { result } = renderHook(() => useAuth());
    
    await expect(
      result.current.login('wrong@example.com', 'wrongpass')
    ).rejects.toThrow('Invalid credentials');
  });

  it('handles signup errors', async () => {
    const error = new Error('Email already in use');
    mockCreateUserWithEmailAndPassword.mockRejectedValue(error);

    const { result } = renderHook(() => useAuth());
    
    await expect(
      result.current.signup('existing@example.com', 'password', 'User')
    ).rejects.toThrow('Email already in use');
  });
});

