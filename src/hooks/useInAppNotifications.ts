import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import Toast from 'react-native-toast-message';
import { AppState, AppStateStatus } from 'react-native';

export function useInAppNotifications(userId: string | null) {
  const lastMessageTimeRef = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!userId) return;


    // Track app state to avoid showing notifications on app launch
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
    });

    // Listen to all threads the user is part of
    const threadsRef = collection(db, 'threads');
    const q = query(threadsRef, where('members', 'array-contains', userId));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const now = Date.now();
      
      // Skip initial load
      if (now - lastMessageTimeRef.current < 2000) {
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type === 'modified') {
          const threadData = change.doc.data();
          const lastMessage = threadData.lastMessage;

          // Check if there's a new message from someone else
          if (
            lastMessage &&
            lastMessage.senderId !== userId &&
            lastMessage.timestamp
          ) {
            const messageTime = lastMessage.timestamp instanceof Timestamp
              ? lastMessage.timestamp.toMillis()
              : Date.now();

            // Only show toast for messages newer than our last check
            if (messageTime > lastMessageTimeRef.current) {
              // Fetch sender's display name
              try {
                const senderDoc = await getDoc(doc(db, 'users', lastMessage.senderId));
                const senderName = senderDoc.exists()
                  ? senderDoc.data().displayName || 'Someone'
                  : 'Someone';


                // Show toast notification
                Toast.show({
                  type: 'success',
                  text1: `New message from ${senderName}`,
                  text2: lastMessage.text || '📷 Image',
                  visibilityTime: 5000,
                  position: 'top',
                  topOffset: 60,
                });
              } catch (error) {
                console.error('🔔 [TOAST] Error fetching sender name:', error);
              }

              lastMessageTimeRef.current = messageTime;
            }
          }
        }
      }
    });

    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [userId]);
}

