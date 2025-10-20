import React from 'react';
import { render } from '@testing-library/react-native';
import TypingDots from '../TypingDots';

describe('TypingDots Component', () => {
  it('should render without crashing', () => {
    const { root } = render(<TypingDots />);
    expect(root).toBeTruthy();
  });

  it('should render three dots', () => {
    const { UNSAFE_getAllByType } = render(<TypingDots />);
    const Animated = require('react-native').Animated;
    
    // Should have 3 animated views for the dots
    const animatedViews = UNSAFE_getAllByType(Animated.View);
    expect(animatedViews.length).toBeGreaterThanOrEqual(3);
  });
});

