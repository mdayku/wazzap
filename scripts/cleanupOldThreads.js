/**
 * Cleanup old test threads with placeholder USER_ID_X values
 * Run with: node scripts/cleanupOldThreads.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin (reuse existing app or create new)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function cleanupOldThreads() {
  console.log('🧹 Starting cleanup of old test threads...\n');
  
  try {
    const threadsSnapshot = await db.collection('threads').get();
    let deletedCount = 0;
    
    for (const doc of threadsSnapshot.docs) {
      const data = doc.data();
      const members = data.members || [];
      
      // Check if any member has placeholder ID
      const hasPlaceholder = members.some(m => 
        m.includes('USER_ID_1') || 
        m.includes('USER_ID_2') || 
        m.includes('USER_ID_3')
      );
      
      if (hasPlaceholder) {
        console.log(`🗑️  Deleting thread ${doc.id} with placeholder members:`, members);
        
        // Delete all messages in the thread first
        const messagesSnapshot = await doc.ref.collection('messages').get();
        const messageBatch = db.batch();
        messagesSnapshot.docs.forEach(msgDoc => {
          messageBatch.delete(msgDoc.ref);
        });
        await messageBatch.commit();
        console.log(`   ✅ Deleted ${messagesSnapshot.size} messages`);
        
        // Delete the thread
        await doc.ref.delete();
        console.log(`   ✅ Deleted thread\n`);
        deletedCount++;
      }
    }
    
    if (deletedCount === 0) {
      console.log('✨ No old threads found! Database is clean.\n');
    } else {
      console.log(`🎉 Cleanup complete! Deleted ${deletedCount} old thread(s)\n`);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

console.log('🚀 MessageAI Thread Cleanup Tool\n');
cleanupOldThreads();

