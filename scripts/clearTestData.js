/**
 * Clear all test data from Firestore
 * Run this before re-seeding to start fresh
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function clearCollection(collectionPath) {
  const snapshot = await db.collection(collectionPath).get();
  
  if (snapshot.empty) {
    console.log(`  ✅ ${collectionPath} already empty`);
    return 0;
  }

  const batch = db.batch();
  let count = 0;

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    count++;
  });

  await batch.commit();
  console.log(`  🗑️  Deleted ${count} documents from ${collectionPath}`);
  return count;
}

async function clearThreadsAndSubcollections() {
  const threadsSnapshot = await db.collection('threads').get();
  
  if (threadsSnapshot.empty) {
    console.log('  ✅ threads already empty');
    return 0;
  }

  let totalDeleted = 0;

  for (const threadDoc of threadsSnapshot.docs) {
    const threadId = threadDoc.id;
    
    // Delete subcollections
    const subcollections = ['messages', 'members', 'summaries', 'decisions'];
    
    for (const subcollection of subcollections) {
      const subSnapshot = await db
        .collection(`threads/${threadId}/${subcollection}`)
        .get();
      
      if (!subSnapshot.empty) {
        const batch = db.batch();
        subSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        totalDeleted += subSnapshot.docs.length;
      }
    }
    
    // Delete thread document
    await threadDoc.ref.delete();
    totalDeleted++;
  }

  console.log(`  🗑️  Deleted ${totalDeleted} documents from threads and subcollections`);
  return totalDeleted;
}

async function main() {
  try {
    console.log('🧹 Clearing all test data...\n');

    // Clear threads and all subcollections
    console.log('📁 Clearing threads...');
    await clearThreadsAndSubcollections();

    // Clear embeddings
    console.log('\n🧠 Clearing embeddings...');
    await clearCollection('embeddings');

    console.log('\n✅ All test data cleared!');
    console.log('\nYou can now run: node scripts/seedTestData.js');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
main();

