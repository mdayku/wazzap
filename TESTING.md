# 🧪 Testing Guide - MessageAI

**Last Updated:** October 21, 2025  
**Test Status:** 🎉 **53/53 tests passing (100%)** | **10/10 suites passing (100%)** 🎉

---

## 📊 Current Test Status - 100% SUCCESS! ✅

| Suite | Tests | Passing | Failing | Status |
|-------|-------|---------|---------|--------|
| `time.test.ts` | 10 | 10 | 0 | ✅ PASS |
| `offlineQueue.test.ts` | 5 | 5 | 0 | ✅ PASS |
| `store.test.ts` | 7 | 7 | 0 | ✅ PASS |
| `useThread.test.ts` | 4 | 4 | 0 | ✅ PASS |
| `TypingDots.test.tsx` | 2 | 2 | 0 | ✅ PASS |
| `NewChatScreen.test.tsx` | 1 | 1 | 0 | ✅ PASS |
| `MessageBubble.test.tsx` | 8 | 8 | 0 | ✅ PASS |
| `Composer.test.tsx` | 9 | 9 | 0 | ✅ PASS |
| `LoginScreen.test.tsx` | 1 | 1 | 0 | ✅ PASS |
| `useAuth.test.ts` | 6 | 6 | 0 | ✅ PASS |
| **TOTAL** | **53** | **53** | **0** | **100%** ✅ |

### Recent Fixes Applied
1. **MessageBubble** - Added ThemeProvider wrapper ✅ FIXED
2. **Composer** - Added testID props + fixed mock implementations ✅ FIXED
3. **LoginScreen** - Updated text expectations ✅ FIXED
4. **useAuth** - Fixed Firebase Auth mock function implementations ✅ FIXED

---

## 🚀 Running Tests

### Run All Tests
```bash
npm test
```

### Watch Mode (Re-run on file changes)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Run Single Test File
```bash
npm test -- MessageBubble.test
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should render"
```

---

## 📂 Test Structure

```
src/
├── components/
│   ├── MessageBubble.tsx
│   └── __tests__/
│       └── MessageBubble.test.tsx
├── screens/
│   ├── LoginScreen.tsx
│   └── __tests__/
│       └── LoginScreen.test.tsx
├── state/
│   ├── store.ts
│   └── __tests__/
│       └── store.test.ts
├── hooks/
│   ├── useAuth.ts
│   └── __tests__/
│       └── useAuth.test.ts
├── utils/
│   ├── time.ts
│   └── __tests__/
│       └── time.test.ts
└── services/
    └── __tests__/
        └── offlineQueue.test.ts
```

---

## ✅ Passing Tests (30/53)

### Utils (4/4) ✅
- Time formatting utilities
- Relative time display
- Presence status checks
- Date manipulation

### Services (3/3) ✅
- Offline queue initialization
- Message queueing
- Queue retry logic

### State Management (5/5) ✅
- Initial state
- Loading state management
- User state updates
- Thread state updates
- Message state updates

### Hooks (6/6) ✅
- useThread initialization
- Thread message fetching
- Real-time updates
- Typing indicators
- Message sending
- Cleanup on unmount

### Components (2/2) ✅
- TypingDots animation
- TypingDots rendering

### Screens (10/10) ✅
- NewChatScreen user list
- User selection & search
- Chat creation logic
- Group chat creation
- Duplicate detection
- Loading & error states

---

## ⚠️ Missing Test Coverage

### Components WITHOUT Tests
- ❌ `ChatScreen.tsx` - **CRITICAL** (main chat interface)
- ❌ `ThreadsScreen.tsx` - **CRITICAL** (thread list)
- ❌ `ProfileScreen.tsx` - (user profile)
- ❌ `SearchScreen.tsx` - (AI semantic search)
- ❌ `DecisionsScreen.tsx` - (AI decisions)
- ❌ `ThemeContext.tsx` - (dark mode)

### Hooks WITHOUT Tests
- ❌ `usePresence.ts` - (online/offline)
- ❌ `useInAppNotifications.ts` - (toasts)
- ❌ `useMessages.ts` - (message management)
- ❌ `useTypingIndicator.ts` - (typing status)

### Services WITHOUT Tests
- ❌ `firebase.ts` - (Firebase init)
- ❌ `ai.ts` - **CRITICAL** (AI Cloud Functions)
- ❌ `messaging.ts` - **CRITICAL** (messaging)
- ❌ `notifications.ts` - (push notifications)

---

## 🎯 Test Examples

### Testing a Component with ThemeProvider

```typescript
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../contexts/ThemeContext';
import MyComponent from '../MyComponent';

// Helper to render with ThemeProvider
const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('MyComponent', () => {
  it('should render correctly', () => {
    const { getByText } = renderWithTheme(<MyComponent />);
    expect(getByText('Hello')).toBeTruthy();
  });
});
```

### Testing Async Functions

```typescript
it('should call API and update state', async () => {
  const { findByText } = render(<MyComponent />);
  
  // Wait for async operation
  const element = await findByText('Loaded Data');
  expect(element).toBeTruthy();
});
```

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useMyHook } from '../useMyHook';

it('should update value', () => {
  const { result } = renderHook(() => useMyHook());
  
  act(() => {
    result.current.setValue('new value');
  });
  
  expect(result.current.value).toBe('new value');
});
```

### Testing with testID

```typescript
// Component
<TouchableOpacity testID="send-button" onPress={handleSend}>
  <Ionicons name="send" />
</TouchableOpacity>

// Test
const { getByTestId } = render(<Composer {...props} />);
fireEvent.press(getByTestId('send-button'));
```

---

## 🔧 Mock Setup

All mocks are configured in `jest.setup.js`.

### AsyncStorage Mock
```javascript
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    // ... more methods
  },
}));
```

### Firebase Auth Mock
```javascript
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn((auth, email, password) => {
    if (email === 'error@test.com') {
      return Promise.reject(new Error('Invalid credentials'));
    }
    return Promise.resolve({ user: { uid: 'test-uid', email } });
  }),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn(),
}));
```

### Firebase Firestore Mock
```javascript
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false })),
  setDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  onSnapshot: jest.fn(() => jest.fn()),
  serverTimestamp: jest.fn(() => ({ seconds: Date.now() / 1000 })),
}));
```

### Expo Modules Mock
```javascript
jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'test-token' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  // ... more methods
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() => Promise.resolve({ uri: 'manipulated-uri' })),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));
```

---

## 📊 Coverage Goals

| Category | Current | Target | Status |
|----------|---------|--------|--------|
| Statements | ~45% | 80% | 🟡 |
| Branches | ~40% | 75% | 🟡 |
| Functions | ~50% | 80% | 🟡 |
| Lines | ~45% | 80% | 🟡 |

---

## ✨ Best Practices

### ✅ DO:
- Test user-facing behavior, not implementation details
- Use meaningful test descriptions (what it does, not how)
- Test edge cases and error states
- Mock external dependencies (Firebase, APIs)
- Keep tests isolated and independent
- Use `testID` for complex selectors
- Wrap components using Context in appropriate providers
- Test accessibility features

### ❌ DON'T:
- Test third-party libraries (Firebase, React Navigation)
- Test styling details excessively
- Create tests that depend on other tests
- Mock everything (test real logic when possible)
- Write tests just for coverage numbers
- Test implementation details that users don't see
- Use brittle selectors (prefer testID or accessibility labels)

---

## 🔍 What to Test

### High Priority ✅
- Business logic (message sending, user auth, AI features)
- User interactions (button clicks, form submission, navigation)
- State management (Zustand store, Context)
- Utilities and helpers (time formatting, validation)
- Component rendering with different props
- Error handling and edge cases
- Async operations (API calls, database queries)

### Lower Priority ⚠️
- Styling and layout (covered by snapshot tests)
- Third-party integrations (covered by integration/E2E tests)
- Simple pass-through components
- Static content rendering

---

## 🐛 Debugging Tests

### Common Issues

**Issue:** `useTheme must be used within a ThemeProvider`  
**Fix:** Wrap component in `ThemeProvider`:
```typescript
const renderWithTheme = (component) => (
  render(<ThemeProvider>{component}</ThemeProvider>)
);
```

**Issue:** `AsyncStorage is null`  
**Fix:** Already mocked in `jest.setup.js`, ensure it's imported

**Issue:** Firebase functions not mocked  
**Fix:** Check `jest.setup.js` for comprehensive Firebase mocks

**Issue:** Test timeout  
**Fix:** Use `waitFor` for async operations:
```typescript
await waitFor(() => {
  expect(mockFunction).toHaveBeenCalled();
});
```

### Debug in VS Code

Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

---

## 📝 Adding New Tests

### 1. Create Test File

Match the source file structure:
```
src/components/NewComponent.tsx
src/components/__tests__/NewComponent.test.tsx
```

### 2. Write Tests

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../contexts/ThemeContext';
import NewComponent from '../NewComponent';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('NewComponent', () => {
  it('should render correctly', () => {
    const { getByText } = renderWithTheme(
      <NewComponent title="Test" />
    );
    expect(getByText('Test')).toBeTruthy();
  });

  it('should handle user interaction', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithTheme(
      <NewComponent onPress={onPress} />
    );
    
    fireEvent.press(getByTestId('action-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### 3. Run Tests

```bash
npm test -- NewComponent
```

---

## 🎯 Test Quality Metrics

- **Test Isolation:** ✅ Good (no interdependencies)
- **Test Speed:** ✅ Excellent (4.5s for 53 tests)
- **Mock Quality:** ✅ Good (comprehensive Firebase mocks)
- **Assertion Quality:** ✅ Good (specific, meaningful assertions)
- **Test Maintainability:** 🟡 Needs improvement (some brittle to UI changes)

---

## 💡 Recommendations

1. **Add testID props** to all interactive elements (buttons, inputs)
2. **Create test utilities** - Shared helpers for common patterns
3. **Add visual regression tests** - Catch UI changes automatically
4. **Implement snapshot tests** - Document expected component output
5. **Add accessibility tests** - Ensure components are accessible
6. **Set up CI/CD** - Run tests automatically on every commit
7. **Add pre-commit hooks** - Run tests before allowing commits
8. **Create test data factories** - Generate realistic test data easily

---

## 🚦 CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## 🧪 Manual & Integration Testing

### Unit Tests (Automated)
The automated unit tests above cover **53 test cases** for components, hooks, services, and utilities.

### Manual Tests (Physical Devices)
For comprehensive end-to-end testing, we have **65+ manual test scenarios** documented:

#### Test Categories
1. **Core Messaging** (8 tests) - Send/receive, read receipts, ordering
2. **Media & Rich Content** (7 tests) - Images, audio, reactions, forwarding
3. **Group Chat Features** (5 tests) - Group creation, typing, read receipts
4. **Performance & Reliability** (6 tests) - Fast reconnect, offline banner, pagination
5. **AI Features** (6 tests) - Summarization, action items, priority, search
6. **User Experience** (6 tests) - Haptics, dark mode, profile, notifications
7. **Edge Cases** (6 tests) - Empty messages, large images, network errors
8. **Force-Quit & Reinstall** (16 tests) - Data persistence, state recovery, sync
9. **Cross-Device** (5 tests) - Multi-device sync, simultaneous operations

#### Force-Quit & Reinstall Tests
**📊 Test Results:** 15/16 passing (94% pass rate)

| Test Scenario | Status |
|--------------|--------|
| Force-Quit During Chat | ✅ Pass |
| Force-Quit While Sending | ✅ Pass |
| Force-Quit After Receiving | ✅ Pass |
| Force-Quit in Group Chat | ✅ Pass |
| Force-Quit with Media | ✅ Pass |
| Background for 10 Minutes | ✅ Pass |
| Background During Chat | ✅ Pass |
| Complete Reinstall | ✅ Pass |
| Reinstall on Second Device | ✅ Pass |
| Reinstall After Data Changes | ✅ Pass |
| Force-Quit During Upload | ⚠️ Partial |
| Force-Quit During Recording | ✅ Pass |
| Reinstall with Network Issues | ✅ Pass |
| Multiple Force-Quits | ✅ Pass |
| Cross-Device Force-Quit | ✅ Pass |
| Simultaneous Reinstalls | ✅ Pass |

**📖 Full Documentation:**
- **Manual Test Matrix:** See [README.md](README.md#comprehensive-test-matrix)
- **Force-Quit Tests:** See [docs/FORCE_QUIT_TESTS.md](docs/FORCE_QUIT_TESTS.md)

### Performance Metrics
- **Average Sync Time After Force-Quit:** 1.2 seconds
- **Average Sync Time After Reinstall:** 4.8 seconds
- **Reconnect Time After Network Restore:** 0.8 seconds
- **Message Load Time (50 messages):** 1.5 seconds
- **LoadTest Throughput:** 92ms/message (20 messages)
- **LoadTest p50 Latency:** <200ms optimistic

---

## 🎓 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Expo Testing Guide](https://docs.expo.dev/guides/testing-with-jest/)
- [Firebase Testing](https://firebase.google.com/docs/rules/unit-tests)

---

## 🏃 Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Check coverage
npm run test:coverage

# Run specific test file
npm test -- MessageBubble.test
```

---

**Happy Testing!** 🎉

*For detailed test configuration, see `jest.setup.js` and `package.json`*
