import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../contexts/ThemeContext';
import { subscribeToQueue, getQueue, type QueuedMessage } from '../state/offlineQueue';

interface HydrationBannerProps {
  userId: string | null;
}

export default function HydrationBanner({ userId: _userId }: HydrationBannerProps) {
  const { colors } = useTheme();
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    // Listen to network state for persistent offline banner
    const unsubscribeNetwork = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable !== false;
      
      if (!connected && isOnline) {
        // Just went offline
        // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
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
  
  // Subscribe to queue changes
  useEffect(() => {
    const unsubscribe = subscribeToQueue((queue: QueuedMessage[]) => {
      const pendingCount = queue.filter(msg => msg.status === 'pending' || msg.status === 'sending').length;
      setQueuedCount(pendingCount);
      
      // Show banner if there are queued messages
      if (pendingCount > 0 && !showBanner) {
        setShowBanner(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });
    
    // Initialize with current queue
    const currentQueue = getQueue();
    const pendingCount = currentQueue.filter(msg => msg.status === 'pending' || msg.status === 'sending').length;
    setQueuedCount(pendingCount);
    
    return unsubscribe;
  }, []);

  if (!showBanner) return null;

  const getBannerText = () => {
    if (!isOnline) {
      if (queuedCount > 0) {
        return `📴 Offline • ${queuedCount} message${queuedCount === 1 ? '' : 's'} queued`;
      }
      return '📴 Offline';
    }
    
    if (queuedCount > 0) {
      return `🔄 Syncing ${queuedCount} message${queuedCount === 1 ? '' : 's'}...`;
    }
    
    return '✅ Synced';
  };
  
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
        {getBannerText()}
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

