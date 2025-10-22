import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, AppState } from 'react-native';
import { onSnapshot, doc } from 'firebase/firestore';
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
  const [hasShownInitialSync, setHasShownInitialSync] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let connectionCheckTimeout: NodeJS.Timeout;
    let isFirstSnapshot = true;

    // Show syncing banner on mount (for initial load)
    if (!hasShownInitialSync) {
      setShowBanner(true);
      setIsOnline(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    // Listen to user document to detect connection state
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      () => {
        // Successfully connected
        clearTimeout(connectionCheckTimeout);
        
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          setHasShownInitialSync(true);
        }
        
        if (!isOnline || !hasShownInitialSync) {
          setIsOnline(true);
          setShowBanner(true);
          
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
      },
      (error) => {
        // Connection error - likely offline
        console.log('🔄 [HYDRATION] Connection issue:', error.code);
        setIsOnline(false);
        setShowBanner(true);
        
        // Keep banner visible while offline
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    );

    // Timeout to detect slow connections
    connectionCheckTimeout = setTimeout(() => {
      if (!hasShownInitialSync) {
        console.log('🔄 [HYDRATION] Slow connection detected');
        setIsOnline(false);
        setShowBanner(true);
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearTimeout(connectionCheckTimeout);
    };
  }, [userId]);

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

