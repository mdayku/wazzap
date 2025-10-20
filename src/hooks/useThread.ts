import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface Thread {
  id: string;
  type: 'direct' | 'group';
  members: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  };
  name?: string; // For group chats
  lastRead?: { [userId: string]: Timestamp }; // Track last read time per user
  unreadCount?: number; // Calculated client-side
}

export function useThreads(uid: string | null) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setThreads([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'threads'),
      where('members', 'array-contains', uid),
      orderBy('updatedAt', 'desc')
    );

    // Set up listeners for each thread's unread count
    const threadUnreadCounts = new Map<string, number>();
    const unsubscribers = new Map<string, () => void>();
    const lastReadCache = new Map<string, any>();

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const threadsData = snapshot.docs.map((doc) => {
        const threadData = doc.data() as Thread;
        const threadId = doc.id;
        const currentLastRead = threadData.lastRead?.[uid];
        
        // Check if lastRead timestamp has changed (e.g., user opened the chat)
        const cachedLastRead = lastReadCache.get(threadId);
        const lastReadChanged = 
          (cachedLastRead === undefined && currentLastRead !== undefined) ||
          (cachedLastRead !== undefined && currentLastRead === undefined) ||
          (cachedLastRead && currentLastRead && 
           cachedLastRead.toMillis() !== currentLastRead.toMillis());
        
        // Set up or refresh unread count listener if needed
        if (!unsubscribers.has(threadId) || lastReadChanged) {
          // Clean up old listener if it exists
          if (unsubscribers.has(threadId)) {
            console.log('🔄 [UNREAD] Refreshing listener for thread:', threadId);
            unsubscribers.get(threadId)?.();
            unsubscribers.delete(threadId);
          }
          
          // Update cache
          lastReadCache.set(threadId, currentLastRead);
          
          // Optimistically reset count when lastRead changes (will be updated by listener)
          if (lastReadChanged) {
            console.log('🔄 [UNREAD] LastRead changed, resetting count optimistically');
            threadUnreadCounts.set(threadId, 0);
            
            // Force immediate UI update
            setThreads((prevThreads) =>
              prevThreads.map((t) =>
                t.id === threadId ? { ...t, unreadCount: 0 } : t
              )
            );
          }
          
          const messagesRef = collection(db, `threads/${threadId}/messages`);
          
          let messagesQuery;
          if (currentLastRead) {
            messagesQuery = query(
              messagesRef,
              where('createdAt', '>', currentLastRead),
              where('senderId', '!=', uid),
              orderBy('senderId'),
              orderBy('createdAt', 'asc')
            );
          } else {
            messagesQuery = query(
              messagesRef,
              where('senderId', '!=', uid),
              orderBy('senderId'),
              orderBy('createdAt', 'asc')
            );
          }
          
          const unsubMessages = onSnapshot(messagesQuery, (messagesSnap) => {
            threadUnreadCounts.set(threadId, messagesSnap.size);
            console.log('📊 [UNREAD] Thread:', threadId, 'Count:', messagesSnap.size);
            
            // Re-render threads with updated counts
            setThreads((prevThreads) =>
              prevThreads.map((t) =>
                t.id === threadId ? { ...t, unreadCount: messagesSnap.size } : t
              )
            );
          }, (error) => {
            // Silently handle permission errors (can happen during auth transitions)
            if (error.code === 'permission-denied') {
              console.log('⚠️ [UNREAD] Permission denied (auth transition) - setting count to 0');
            } else {
              console.error('Error counting unread for thread:', threadId, error);
            }
            threadUnreadCounts.set(threadId, 0);
          });
          
          unsubscribers.set(threadId, unsubMessages);
        }
        
        return {
          id: threadId,
          ...threadData,
          unreadCount: threadUnreadCounts.get(threadId) || 0,
        } as Thread;
      });
      
      setThreads(threadsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching threads:', error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Clean up all message listeners
      unsubscribers.forEach((unsub) => unsub());
      unsubscribers.clear();
    };
  }, [uid]);

  return { threads, loading };
}

