/**
 * Generate embeddings for Seinfeld scripts via Cloud Function
 * Run with: node scripts/generateEmbeddings.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin initialized\n');
} catch (error) {
  console.error('❌ Error loading service account:', error.message);
  process.exit(1);
}

async function generateEmbeddings() {
  try {
    console.log('🎭 Generating embeddings for Seinfeld scripts...\n');
    console.log('This will use OpenAI API to create vector embeddings.');
    console.log('Cost: ~$0.0001 per 1000 tokens (very cheap!)\n');

    const db = admin.firestore();

    // Count scripts without embeddings
    const scriptsSnapshot = await db
      .collection('seinfeldScripts')
      .get();

    const withoutEmbeddings = scriptsSnapshot.docs.filter(
      (doc) => !doc.data().embedding
    );

    console.log(`📊 Status:`);
    console.log(`  Total scripts: ${scriptsSnapshot.size}`);
    console.log(`  Without embeddings: ${withoutEmbeddings.length}`);
    console.log(`  With embeddings: ${scriptsSnapshot.size - withoutEmbeddings.length}\n`);

    if (withoutEmbeddings.length === 0) {
      console.log('✅ All scripts already have embeddings!');
      console.log('\n🎯 Next step: Test the agents - they should now use semantic search!');
      return;
    }

    console.log('📞 Calling Cloud Function to generate embeddings...\n');
    
    // Call the Cloud Function
    // You can trigger this from Firebase Console or from the app
    console.log('To generate embeddings, run this command:');
    console.log('\n  firebase functions:shell');
    console.log('  > generateSeinfeldEmbeddings()');
    console.log('\nOr call it from your app using the generateSeinfeldEmbeddings service.\n');
    
    console.log('For now, the agents will use keyword search as fallback.');
    console.log('Once embeddings are generated, they will automatically use semantic search!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateEmbeddings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
