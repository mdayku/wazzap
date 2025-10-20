import { useStore } from '../store';
import { act, renderHook } from '@testing-library/react-native';

describe('Zustand Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.setUser(null);
      result.current.setIsLoading(true);
    });
  });

  it('should initialize with null user and loading state', () => {
    const { result } = renderHook(() => useStore());
    
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('should set user correctly', () => {
    const { result } = renderHook(() => useStore());
    const mockUser = {
      uid: 'test-uid',
      email: 'test@example.com',
    } as any;

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.user?.uid).toBe('test-uid');
  });

  it('should clear user by setting to null', () => {
    const { result } = renderHook(() => useStore());
    const mockUser = { uid: 'test-uid', email: 'test@example.com' } as any;

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.user).not.toBeNull();

    act(() => {
      result.current.setUser(null);
    });

    expect(result.current.user).toBeNull();
  });

  it('should toggle loading state', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setIsLoading(false);
    });
    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.setIsLoading(true);
    });
    expect(result.current.isLoading).toBe(true);
  });
});

