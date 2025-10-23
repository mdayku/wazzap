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
    media?: { type: 'image' | 'video' | 'audio'; url: string };
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
    const lastReadCache = new Map<string, { seconds: number; nanoseconds: number; toMillis?: () => number }>();

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
           cachedLastRead.toMillis?.() !== currentLastRead.toMillis?.());
        
        // Set up or refresh unread count listener if needed
        if (!unsubscribers.has(threadId) || lastReadChanged) {
          // Clean up old listener if it exists
          if (unsubscribers.has(threadId)) {
            unsubscribers.get(threadId)?.();
            unsubscribers.delete(threadId);
          }
          
          // Update cache
          if (currentLastRead) {
            lastReadCache.set(threadId, currentLastRead);
          }
          
          // Optimistically reset count when lastRead changes (will be updated by listener)
          if (lastReadChanged) {
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
            // Filter out load test messages from unread count
            const realUnreadCount = messagesSnap.docs.filter(doc => {
              const data = doc.data();
              const isLoadTestMessage = data.text?.includes('Load test message') || data.text?.includes('[WARMUP]');
              return !isLoadTestMessage;
            }).length;
            
            threadUnreadCounts.set(threadId, realUnreadCount);
            
            // Re-render threads with updated counts
            setThreads((prevThreads) =>
              prevThreads.map((t) =>
                t.id === threadId ? { ...t, unreadCount: realUnreadCount } : t
              )
            );
          }, (error) => {
            // Silently handle permission errors (can happen during auth transitions)
            if (error.code === 'permission-denied') {
              // Silent - this is expected during auth transitions
            } else {
              console.error('Error counting unread for thread:', threadId, error);
            }
            threadUnreadCounts.set(threadId, 0);
          });
          
          unsubscribers.set(threadId, unsubMessages);
        }
        
        return {
          ...threadData,
          id: threadId,
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

