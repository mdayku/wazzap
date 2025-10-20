import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export default function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = animate(dot1, 0);
    const anim2 = animate(dot2, 150);
    const anim3 = animate(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, []);

  const translateY = (dot: Animated.Value) =>
    dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -8],
    });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: translateY(dot1) }] }]}
      />
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: translateY(dot2) }] }]}
      />
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: translateY(dot3) }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginLeft: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
    marginHorizontal: 3,
  },
});

