const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixLastRead() {
  try {
    console.log('🔧 Fixing lastRead for all threads...');
    
    const threadsSnapshot = await db.collection('threads').get();
    
    let fixed = 0;
    let skipped = 0;
    
    for (const threadDoc of threadsSnapshot.docs) {
      const threadData = threadDoc.data();
      const members = threadData.members || [];
      const existingLastRead = threadData.lastRead || {};
      
      let needsUpdate = false;
      const updates = {};
      
      // Check each member
      for (const memberId of members) {
        if (!existingLastRead[memberId]) {
          // Member has no lastRead - initialize to thread creation time
          updates[`lastRead.${memberId}`] = threadData.createdAt || admin.firestore.Timestamp.now();
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await db.collection('threads').doc(threadDoc.id).update(updates);
        console.log(`✅ Fixed thread ${threadDoc.id}: ${Object.keys(updates).length} members`);
        fixed++;
      } else {
        skipped++;
      }
    }
    
    console.log(`\n✅ Done! Fixed ${fixed} threads, skipped ${skipped} threads`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixLastRead();

