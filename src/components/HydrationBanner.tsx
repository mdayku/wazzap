import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, AppState } from 'react-native';
import { onSnapshot, doc } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../services/firebase';
import { useTheme } from '../contexts/ThemeContext';

interface HydrationBannerProps {
  userId: string | null;
}

export default function HydrationBanner({ userId }: HydrationBannerProps) {
  const { colors } = useTheme();
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Listen to network state for persistent offline banner
    const unsubscribeNetwork = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable !== false;
      
      if (!connected && isOnline) {
        // Just went offline
        console.log('🔄 [HYDRATION] Network offline');
        setIsOnline(false);
        setShowBanner(true);
        
        // Show banner immediately
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
        
      } else if (connected && !isOnline) {
        // Just came back online
        console.log('✅ [HYDRATION] Network online');
        setIsOnline(true);
        
        // Show "✅ Synced" briefly then fade out
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(1500),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => setShowBanner(false));
      }
    });

    return () => {
      unsubscribeNetwork();
    };
  }, [isOnline]);

  if (!showBanner) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: isOnline ? colors.success || '#34C759' : colors.warning || '#FF9500',
          opacity: fadeAnim,
        },
      ]}
    >
      <Text style={styles.bannerText}>
        {isOnline ? '✅ Synced' : '🔄 Syncing...'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

