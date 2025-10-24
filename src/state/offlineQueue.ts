import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../services/firebase';

const QUEUE_KEY = '@offline_message_queue';
const MAX_RETRY_ATTEMPTS = 3;

export type QueuedMessage = { 
  id: string; // Unique ID for queue item
  threadId: string; 
  text?: string; 
  media?: any; 
  tempId: string;
  uid: string;
  timestamp: number; // When it was queued
  retryCount: number;
  status: 'pending' | 'sending' | 'failed';
  error?: string;
  // For offline media uploads
  localMediaUri?: string; // Local file URI (before upload)
  mediaType?: 'image' | 'audio';
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
};

type Pending = { 
  threadId: string; 
  text?: string; 
  media?: any; 
  tempId: string 
};

// In-memory queue for fast access
let memoryQueue: QueuedMessage[] = [];
let isProcessing = false;
let queueListeners: Array<(queue: QueuedMessage[]) => void> = [];

// Use a global flag that survives hot reloads
if (!(global as any).__offlineQueueInitialized) {
  (global as any).__offlineQueueInitialized = false;
}
if (!(global as any).__networkUnsubscribe) {
  (global as any).__networkUnsubscribe = null;
}
if (!(global as any).__lastNetworkState) {
  (global as any).__lastNetworkState = null;
}

/**
 * Initialize the offline queue system
 * Call this once on app startup
 */
export async function initializeOfflineQueue() {
  if ((global as any).__offlineQueueInitialized) {
    return;
  }
  
  (global as any).__offlineQueueInitialized = true;
  
  try {
    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    if (stored) {
      memoryQueue = JSON.parse(stored);
      notifyListeners();
    }
    
    // Remove old listener if exists
    if ((global as any).__networkUnsubscribe) {
      (global as any).__networkUnsubscribe();
    }
    
    // Listen for network changes and auto-process queue (only once)
    (global as any).__networkUnsubscribe = NetInfo.addEventListener(state => {
      const isOnline = state.isConnected && state.isInternetReachable !== false;
      const wasOnline = (global as any).__lastNetworkState;
      
      // Update state
      (global as any).__lastNetworkState = isOnline;
      
      // Process queue when:
      // 1. Transitioning from offline to online (wasOnline === false)
      // 2. OR first network check and we're online with queued messages (wasOnline === null)
      if (isOnline && (wasOnline === false || (wasOnline === null && memoryQueue.length > 0))) {
        if (memoryQueue.length > 0 && !isProcessing) {
          // Add a small delay to ensure Firestore is ready
          setTimeout(() => {
            processQueue();
          }, 500);
        }
        // Also sync pending read receipts
        if (wasOnline === false) {
          syncPendingReadReceipts();
        }
      }
    });
  } catch (error) {
    console.error('Failed to initialize offline queue:', error);
  }
}

/**
 * Subscribe to queue changes
 */
export function subscribeToQueue(listener: (queue: QueuedMessage[]) => void) {
  queueListeners.push(listener);
  return () => {
    queueListeners = queueListeners.filter(l => l !== listener);
  };
}

/**
 * Get current queue
 */
export function getQueue(): QueuedMessage[] {
  return [...memoryQueue];
}

/**
 * Notify all listeners of queue changes
 */
function notifyListeners() {
  queueListeners.forEach(listener => listener([...memoryQueue]));
}

/**
 * Save queue to AsyncStorage
 */
async function persistQueue() {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(memoryQueue));
  } catch (error) {
    console.error('❌ [OFFLINE_QUEUE] Failed to persist queue:', error);
  }
}

/**
 * Add message to offline queue
 */
async function enqueueMessage(message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount' | 'status'>) {
  const queuedMessage: QueuedMessage = {
    ...message,
    id: `queue_${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  };
  
  memoryQueue.push(queuedMessage);
  await persistQueue();
  notifyListeners();
  
  // Message enqueued
}

/**
 * Remove message from queue
 */
async function dequeueMessage(id: string) {
  memoryQueue = memoryQueue.filter(msg => msg.id !== id);
  await persistQueue();
  // Small delay before notifying to prevent race condition with Firestore listener
  setTimeout(() => {
    notifyListeners();
  }, 100);
}

/**
 * Update message status in queue
 */
async function updateMessageStatus(id: string, updates: Partial<QueuedMessage>) {
  const index = memoryQueue.findIndex(msg => msg.id === id);
  if (index !== -1) {
    memoryQueue[index] = { ...memoryQueue[index], ...updates };
    await persistQueue();
    notifyListeners();
  }
}

/**
 * Process the offline queue
 * Sends all pending messages in FIFO order
 */
export async function processQueue() {
  if (isProcessing) {
    return;
  }
  
  if (memoryQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  
  try {
    // Process messages in order
    const messagesToProcess = [...memoryQueue];
    
    for (const message of messagesToProcess) {
      try {
        // Update status to sending
        await updateMessageStatus(message.id, { status: 'sending' });
        
        // Attempt to send (pass queued message for media upload handling)
        await sendMessageToFirestore({
          threadId: message.threadId,
          text: message.text,
          media: message.media,
          tempId: message.tempId,
        }, message.uid, message);
        
        // Success - remove from queue
        // Message sent successfully
        await dequeueMessage(message.id);
      
    } catch (error: any) {
      console.error(`❌ [OFFLINE_QUEUE] Failed to send message ${message.id}:`, error);
      
      // Increment retry count
      const newRetryCount = message.retryCount + 1;
      
      if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
        // Max retries reached - mark as failed
        await updateMessageStatus(message.id, {
          status: 'failed',
          retryCount: newRetryCount,
          error: error.message || 'Unknown error',
        });
        // Message failed after max retries
      } else {
        // Update retry count and reset to pending
        await updateMessageStatus(message.id, {
          status: 'pending',
          retryCount: newRetryCount,
          error: error.message || 'Unknown error',
        });
        // Message will retry
      }
      }
    }
    
    isProcessing = false;
    // Queue processing complete
  } catch (error) {
    console.error('❌ [OFFLINE_QUEUE] Fatal error during queue processing:', error);
    isProcessing = false;
    throw error;
  }
}

/**
 * Retry a specific failed message
 */
export async function retryMessage(id: string) {
  const message = memoryQueue.find(msg => msg.id === id);
  if (!message) {
    console.warn(`⚠️ [OFFLINE_QUEUE] Message ${id} not found in queue`);
    return;
  }
  
  // Reset status and retry count
  await updateMessageStatus(id, {
    status: 'pending',
    retryCount: 0,
    error: undefined,
  });
  
  // Process queue
  await processQueue();
}

/**
 * Clear all failed messages from queue
 */
export async function clearFailedMessages() {
  memoryQueue = memoryQueue.filter(msg => msg.status !== 'failed');
  await persistQueue();
  notifyListeners();
  // Cleared failed messages
}

/**
 * Internal function to send message to Firestore
 * Handles media uploads if localMediaUri is provided
 */
async function sendMessageToFirestore(p: Pending, uid: string, queuedMsg?: QueuedMessage) {
  const { threadId, text, media } = p;
  
  let finalMedia = media;
  
  // If there's a local media URI, upload it first
  if (queuedMsg?.localMediaUri && queuedMsg?.mediaType) {
    try {
      // Starting media upload
      
      // Dynamic import to avoid circular dependency
      const { uploadImage } = await import('../services/storage');
      
      const timestamp = Date.now();
      const extension = queuedMsg.mediaType === 'audio' ? 'm4a' : 'jpg';
      const uploadStart = Date.now();
      
      const mediaUrl = await uploadImage(
        queuedMsg.localMediaUri,
        `messages/${uid}/${queuedMsg.mediaType}_${timestamp}.${extension}`
      );
      
      const uploadTime = Date.now() - uploadStart;
      // Media uploaded successfully
      
      finalMedia = {
        type: queuedMsg.mediaType,
        url: mediaUrl,
        ...queuedMsg.mediaMetadata,
      };
    } catch (error) {
      console.error(`❌ [OFFLINE_QUEUE] Failed to upload ${queuedMsg.mediaType}:`, error);
      throw error;
    }
  }
  
  // Client writes; serverTimestamp becomes authoritative
  await addDoc(collection(db, `threads/${threadId}/messages`), {
    senderId: uid,
    text: text ?? '',
    media: finalMedia ?? null,
    status: 'sent',
    priority: 'normal',
    createdAt: serverTimestamp()
  });
  
  // Update thread's lastMessage
  await updateDoc(doc(db, `threads/${threadId}`), {
    lastMessage: {
      text: text ?? '',
      senderId: uid,
      timestamp: serverTimestamp(),
      media: finalMedia ?? null
    },
    updatedAt: serverTimestamp()
  });
}

/**
 * Sync pending read receipts from AsyncStorage
 */
async function syncPendingReadReceipts() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const readReceiptKeys = keys.filter(k => k.startsWith('@pending_read_receipt_'));
    
    if (readReceiptKeys.length === 0) return;
    
    // Syncing pending read receipts
    
    for (const key of readReceiptKeys) {
      try {
        const timestamp = await AsyncStorage.getItem(key);
        if (!timestamp) continue;
        
        // Parse key: @pending_read_receipt_{threadId}_{uid}
        const parts = key.replace('@pending_read_receipt_', '').split('_');
        if (parts.length < 2) continue;
        
        const uid = parts.pop();
        const threadId = parts.join('_');
        
        // Update Firestore
        const { updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('../services/firebase');
        
        const memberDoc = doc(db, `threads/${threadId}/members`, uid!);
        await updateDoc(memberDoc, {
          readAt: new Date(timestamp)
        }).catch(() => {
          // Member doc might not exist yet
        });
        
        const threadDoc = doc(db, 'threads', threadId);
        await updateDoc(threadDoc, {
          [`lastRead.${uid}`]: serverTimestamp()
        });
        
        // Remove from AsyncStorage
        await AsyncStorage.removeItem(key);
        // Read receipt synced
      } catch (error) {
        console.error(`❌ [OFFLINE_QUEUE] Failed to sync read receipt ${key}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ [OFFLINE_QUEUE] Error syncing read receipts:', error);
  }
}

/**
 * Main function to send a message (with offline queue support)
 * @param p - Message data
 * @param uid - User ID
 * @param localMediaUri - Optional local media URI for offline queueing
 * @param mediaType - Type of media (image or audio)
 * @param mediaMetadata - Optional media metadata (width, height, duration)
 */
export async function sendMessageOptimistic(
  p: Pending, 
  uid: string,
  localMediaUri?: string,
  mediaType?: 'image' | 'audio',
  mediaMetadata?: { width?: number; height?: number; duration?: number }
) {
  const { threadId, text, media, tempId } = p;
  
  try {
    // Check network status
    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected && netInfo.isInternetReachable !== false;
    
    if (!isOnline) {
      // Offline - add to queue with local media URI
      // Offline - queueing message
      await enqueueMessage({ 
        threadId, 
        text, 
        media, 
        tempId, 
        uid,
        localMediaUri,
        mediaType,
        mediaMetadata,
      });
      return;
    }
    
    // Online - try to send immediately
    await sendMessageToFirestore(p, uid);
    // Message sent successfully
    
  } catch (error: any) {
    console.error('❌ [OFFLINE_QUEUE] Error sending message:', error);
    
    // If it's a network error, queue it with local media URI
    if (error.code === 'unavailable' || error.message?.includes('network')) {
      // Network error - queueing message
      await enqueueMessage({ 
        threadId, 
        text, 
        media, 
        tempId, 
        uid,
        localMediaUri,
        mediaType,
        mediaMetadata,
      });
    } else {
      // Other errors (permissions, etc.) - throw
      throw error;
    }
  }
}

