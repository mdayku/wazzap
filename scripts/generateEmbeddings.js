/**
 * Generate embeddings for messages in a thread
 * This enables semantic search functionality
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function generateEmbeddings(threadId, limit = 100) {
  try {
    console.log(`\n🔄 Generating embeddings for thread: ${threadId}`);
    
    // Fetch messages
    const messagesSnap = await db
      .collection(`threads/${threadId}/messages`)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    console.log(`📨 Found ${messagesSnap.docs.length} messages`);
    
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (const messageDoc of messagesSnap.docs) {
      const messageData = messageDoc.data();
      
      // Skip messages without text
      if (!messageData.text || messageData.text.trim().length === 0) {
        skipped++;
        continue;
      }

      // Check if embedding already exists
      const existingEmbedding = await db.collection('embeddings').doc(messageDoc.id).get();
      
      if (existingEmbedding.exists) {
        console.log(`  ⏭️  Skipping (already exists): ${messageData.text.slice(0, 50)}...`);
        skipped++;
        continue;
      }

      // Generate embedding using OpenAI
      try {
        console.log(`  🤖 Generating embedding: ${messageData.text.slice(0, 50)}...`);
        
        // Call the OpenAI API directly (you could also use the Cloud Function)
        const OpenAI = require('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
        });

        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: messageData.text.slice(0, 8000),
        });

        const vector = response.data[0].embedding;

        // Store in Firestore
        await db.collection('embeddings').doc(messageDoc.id).set({
          messageId: messageDoc.id,
          threadId: threadId,
          vector: vector,
          text: messageData.text.slice(0, 500),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`  ✅ Generated embedding for message: ${messageDoc.id}`);
        generated++;
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  ❌ Error generating embedding for message ${messageDoc.id}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ Complete!`);
    console.log(`   Generated: ${generated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    
    return { generated, skipped, errors };
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

async function main() {
  try {
    // Get all threads
    console.log('🔍 Fetching all threads...');
    const threadsSnap = await db.collection('threads').get();
    
    console.log(`📋 Found ${threadsSnap.docs.length} threads\n`);
    
    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const threadDoc of threadsSnap.docs) {
      const threadData = threadDoc.data();
      const threadName = threadData.name || 'Chat';
      
      console.log(`\n📁 Thread: ${threadName} (${threadDoc.id})`);
      
      const result = await generateEmbeddings(threadDoc.id, 50);
      
      totalGenerated += result.generated;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }

    console.log(`\n\n🎉 All done!`);
    console.log(`   Total generated: ${totalGenerated}`);
    console.log(`   Total skipped: ${totalSkipped}`);
    console.log(`   Total errors: ${totalErrors}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();

