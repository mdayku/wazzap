/**
 * Script to check Seinfeld Mode status for a thread
 * Run with: npx ts-node scripts/checkSeinfeldThread.ts <threadId>
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  // Try to use application default credentials or service account
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (error) {
    console.error('Error initializing Firebase Admin. Make sure you have credentials set up.');
    console.error('Run: export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"');
    process.exit(1);
  }
}

async function checkThread(threadId: string) {
  console.log(`\n🔍 Checking thread: ${threadId}\n`);
  
  try {
    const db = admin.firestore();
    const threadDoc = await db.collection('threads').doc(threadId).get();
    
    if (!threadDoc.exists) {
      console.log('❌ Thread not found!');
      return;
    }
    
    const data = threadDoc.data();
    
    console.log('📊 Thread Data:');
    console.log('  Type:', data?.type || 'direct');
    console.log('  Members:', data?.members || []);
    console.log('  Name:', data?.name || '(no name)');
    console.log('\n🎭 Seinfeld Mode:');
    console.log('  Enabled:', data?.seinfeldMode?.enabled || false);
    console.log('  Active Characters:', data?.seinfeldMode?.activeCharacters || []);
    console.log('  Enabled At:', data?.seinfeldMode?.enabledAt?.toDate?.() || 'N/A');
    console.log('  Enabled By:', data?.seinfeldMode?.enabledBy || 'N/A');
    
    // Check recent messages
    console.log('\n💬 Recent Messages:');
    const messagesSnap = await db.collection('threads').doc(threadId).collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    messagesSnap.docs.forEach((doc, i) => {
      const msg = doc.data();
      console.log(`  ${i + 1}. ${msg.senderName || msg.senderId}: ${msg.text?.substring(0, 50) || '[media]'}...`);
    });
    
    console.log('\n✅ Done!\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Get threadId from command line
const threadId = process.argv[2];

if (!threadId) {
  console.error('Usage: npx ts-node scripts/checkSeinfeldThread.ts <threadId>');
  process.exit(1);
}

checkThread(threadId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });

