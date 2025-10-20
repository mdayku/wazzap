import { useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { AppState } from 'react-native';
import { db } from '../services/firebase';

export function usePresence(uid: string | null) {
  useEffect(() => {
    if (!uid) return;

    let isActive = true;

    const updatePresence = async () => {
      if (!isActive || !uid) return;
      
      try {
        await updateDoc(doc(db, 'users', uid), {
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        // Silently fail if user doc doesn't exist yet
        if (error && typeof error === 'object' && 'code' in error && error.code !== 'not-found') {
          console.error('Error updating presence:', error);
        }
      }
    };

    // Update on mount and every 60 seconds (reduced frequency)
    updatePresence();
    const interval = setInterval(updatePresence, 60000);

    // Listen to app state changes with debouncing
    let timeout: NodeJS.Timeout;
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (nextAppState === 'active') {
          updatePresence();
        }
      }, 500); // Debounce by 500ms
    });

    return () => {
      isActive = false;
      clearInterval(interval);
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [uid]);
}

