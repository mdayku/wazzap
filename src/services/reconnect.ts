import NetInfo from '@react-native-community/netinfo';
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Fast reconnect service for Firestore
 * Monitors network state and aggressively reconnects when network returns
 * Goal: <1s reconnect after 30s network drop
 */

let isFirestoreEnabled = true;
let reconnectTimer: NodeJS.Timeout | null = null;
let lastDisconnectTime: number | null = null;

export function initializeReconnectService() {
  console.log('🔌 [RECONNECT] Initializing fast reconnect service...');
  
  // Listen to network state changes
  const unsubscribe = NetInfo.addEventListener(state => {
    const isConnected = state.isConnected && state.isInternetReachable !== false;
    
    console.log('🔌 [RECONNECT] Network state:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      effectivelyConnected: isConnected
    });
    
    if (!isConnected && isFirestoreEnabled) {
      // Network lost - record time
      lastDisconnectTime = Date.now();
      console.log('🔌 [RECONNECT] ❌ Network lost');
      
      // Don't disable Firestore network - let it handle offline gracefully
      // This prevents "Target ID already exists" errors
      isFirestoreEnabled = false;
      
    } else if (isConnected && !isFirestoreEnabled) {
      // Network restored
      const disconnectDuration = lastDisconnectTime 
        ? Date.now() - lastDisconnectTime 
        : 0;
      
      console.log('🔌 [RECONNECT] ✅ Network restored after', disconnectDuration, 'ms');
      
      isFirestoreEnabled = true;
      lastDisconnectTime = null;
      
      console.log('🔌 [RECONNECT] ✅✅✅ RECONNECTED');
      console.log('🔌 [RECONNECT] 📊 Total offline duration:', disconnectDuration, 'ms');
    }
  });
  
  console.log('🔌 [RECONNECT] ✅ Fast reconnect service initialized');
  
  return unsubscribe;
}

/**
 * Manually trigger a reconnect (useful for testing or force-reconnect button)
 */
export async function forceReconnect(): Promise<boolean> {
  console.log('🔌 [RECONNECT] 🔄 Force reconnect requested...');
  
  try {
    if (isFirestoreEnabled) {
      await disableNetwork(db);
      isFirestoreEnabled = false;
      console.log('🔌 [RECONNECT] Disabled Firestore');
    }
    
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
    
    const reconnectStart = Date.now();
    await enableNetwork(db);
    const reconnectTime = Date.now() - reconnectStart;
    
    isFirestoreEnabled = true;
    console.log('🔌 [RECONNECT] ✅ Force reconnect completed in', reconnectTime, 'ms');
    
    return true;
  } catch (error) {
    console.error('🔌 [RECONNECT] ❌ Force reconnect failed:', error);
    return false;
  }
}

/**
 * Get current connection status
 */
export function getConnectionStatus(): { isFirestoreEnabled: boolean, lastDisconnectTime: number | null } {
  return {
    isFirestoreEnabled,
    lastDisconnectTime
  };
}

