import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

type Pending = { 
  threadId: string; 
  text?: string; 
  media?: any; 
  tempId: string 
};

export async function sendMessageOptimistic(p: Pending, uid: string) {
  const { threadId, text, media, tempId } = p;
  
  try {
    // Client writes; serverTimestamp becomes authoritative
    await addDoc(collection(db, `threads/${threadId}/messages`), {
      senderId: uid,
      text: text ?? '',
      media: media ?? null,
      status: 'sent',
      priority: 'normal',
      readBy: [uid], // Sender has "read" their own message
      createdAt: serverTimestamp()
    });
    
    // Update thread's lastMessage
    await updateDoc(doc(db, `threads/${threadId}`), {
      lastMessage: {
        text: text ?? '',
        senderId: uid,
        timestamp: serverTimestamp(),
        media: media ?? null,
        readBy: [uid] // Initialize with sender
      },
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

