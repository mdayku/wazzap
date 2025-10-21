const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkThread() {
  const threadId = 'JrlNg6zVicSvkUKnlTUr'; // The problematic thread from logs
  
  try {
    const threadDoc = await db.collection('threads').doc(threadId).get();
    
    if (!threadDoc.exists) {
      console.log('❌ Thread not found');
      return;
    }
    
    const data = threadDoc.data();
    console.log('\n📋 Thread Data:');
    console.log('Members:', data.members);
    console.log('\n🕐 LastRead:');
    
    if (data.lastRead) {
      for (const [userId, timestamp] of Object.entries(data.lastRead)) {
        console.log(`  ${userId}: ${timestamp ? new Date(timestamp.toMillis()).toISOString() : 'undefined'}`);
      }
    } else {
      console.log('  No lastRead field!');
    }
    
    // Check if all members have lastRead
    console.log('\n🔍 Missing lastRead:');
    let hasMissing = false;
    for (const memberId of data.members) {
      if (!data.lastRead || !data.lastRead[memberId]) {
        console.log(`  ❌ ${memberId} - MISSING`);
        hasMissing = true;
      }
    }
    
    if (!hasMissing) {
      console.log('  ✅ All members have lastRead');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkThread();

