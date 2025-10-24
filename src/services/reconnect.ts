import NetInfo from '@react-native-community/netinfo';
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Fast reconnect service for Firestore
 * Monitors network state and aggressively reconnects when network returns
 * Goal: <1s reconnect after 30s network drop
 */

let isFirestoreEnabled = true;
let lastDisconnectTime: number | null = null;

export function initializeReconnectService() {
  // Listen to network state changes
  const unsubscribe = NetInfo.addEventListener(state => {
    const isConnected = state.isConnected && state.isInternetReachable !== false;
    
    if (!isConnected && isFirestoreEnabled) {
      // Network lost - record time
      lastDisconnectTime = Date.now();
      
      // Don't disable Firestore network - let it handle offline gracefully
      // This prevents "Target ID already exists" errors
      isFirestoreEnabled = false;
      
    } else if (isConnected && !isFirestoreEnabled) {
      // Network restored
      isFirestoreEnabled = true;
      lastDisconnectTime = null;
    }
  });
  
  return unsubscribe;
}

/**
 * Manually trigger a reconnect (useful for testing or force-reconnect button)
 */
export async function forceReconnect(): Promise<boolean> {
  try {
    if (isFirestoreEnabled) {
      await disableNetwork(db);
      isFirestoreEnabled = false;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
    
    await enableNetwork(db);
    isFirestoreEnabled = true;
    
    return true;
  } catch (error) {
    console.error('Force reconnect failed:', error);
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

