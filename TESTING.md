# 🧪 Testing Guide - MessageAI

## Overview

This project uses **Jest** and **React Native Testing Library** for unit and integration testing.

---

## 📦 Test Dependencies

Already configured in `package.json`:
- `jest` - Testing framework
- `jest-expo` - Expo-specific Jest preset
- `@testing-library/react-native` - React Native testing utilities
- `@testing-library/jest-native` - Custom matchers

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
├── utils/
│   ├── time.ts
│   └── __tests__/
│       └── time.test.ts
└── services/
    └── __tests__/
        └── offlineQueue.test.ts
```

---

## ✅ Test Coverage

### Current Test Suites:

1. **Utils Tests** (`src/utils/__tests__/time.test.ts`)
   - ✅ `formatTimestamp()` - Various date formats
   - ✅ `formatLastSeen()` - Online/offline status

2. **State Tests** (`src/state/__tests__/store.test.ts`)
   - ✅ Zustand store initialization
   - ✅ User state management
   - ✅ Loading state management

3. **Component Tests**
   - ✅ `MessageBubble` - Rendering, status indicators, priority badges
   - ✅ `TypingDots` - Animation rendering

4. **Screen Tests**
   - ✅ `LoginScreen` - Form rendering, mode switching, validation

5. **Service Tests**
   - ✅ `offlineQueue` - Message sending, media handling

---

## 🎯 Test Examples

### Testing a Component

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    const { getByText } = render(<MyComponent />);
    expect(getByText('Hello')).toBeTruthy();
  });

  it('should handle button press', () => {
    const onPress = jest.fn();
    const { getByText } = render(<MyComponent onPress={onPress} />);
    
    fireEvent.press(getByText('Click Me'));
    expect(onPress).toHaveBeenCalled();
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

---

## 🔧 Mocking

### Mocking Firebase

Firebase is mocked globally in `jest.setup.js`:

```javascript
jest.mock('./src/services/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
  functions: {},
}));
```

### Mocking Firestore Functions

```typescript
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(() => Promise.resolve({ id: 'mock-id' })),
  collection: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
}));
```

### Mocking Navigation

```typescript
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
```

---

## 📊 Coverage Goals

Target coverage thresholds:
- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

Current coverage by area:
- ✅ Utils: ~90%
- ✅ State: ~85%
- ✅ Components: ~70%
- ⚠️ Screens: ~60% (needs more tests)
- ⚠️ Services: ~50% (Firebase integration hard to test)

---

## 🐛 Debugging Tests

### Run Single Test File
```bash
npm test -- LoginScreen.test
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should render"
```

### Verbose Output
```bash
npm test -- --verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

---

## ✨ Best Practices

### ✅ DO:
- Test user-facing behavior, not implementation details
- Use meaningful test descriptions
- Test edge cases and error states
- Mock external dependencies (Firebase, APIs)
- Keep tests isolated and independent
- Use `data-testid` for complex selectors

### ❌ DON'T:
- Test third-party libraries (Firebase, React Navigation)
- Test styling details excessively
- Create tests that depend on other tests
- Mock everything (test real logic when possible)
- Write tests just for coverage numbers

---

## 🔍 What to Test

### High Priority:
✅ Business logic (message sending, user auth)  
✅ User interactions (button clicks, form submission)  
✅ State management (Zustand store)  
✅ Utilities and helpers  
✅ Component rendering with different props  

### Lower Priority:
⚠️ Styling and layout  
⚠️ Third-party integrations (covered by integration tests)  
⚠️ Simple pass-through components  

---

## 🚦 CI/CD Integration

### Running Tests in CI

Add to your CI workflow:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v2
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
import { render } from '@testing-library/react-native';
import NewComponent from '../NewComponent';

describe('NewComponent', () => {
  it('should render correctly', () => {
    const { getByText } = render(<NewComponent />);
    expect(getByText('Expected Text')).toBeTruthy();
  });
});
```

### 3. Run Tests

```bash
npm test -- NewComponent
```

---

## 🎓 Resources

- [Jest Docs](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## 🏃 Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Run tests
npm test

# Watch mode for development
npm run test:watch

# Check coverage
npm run test:coverage
```

---

**Happy Testing!** 🎉

