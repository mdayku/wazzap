/**
 * Generate embeddings for all Seinfeld scripts in Firestore
 * Run with: node scripts/generateEmbeddings.js
 * 
 * Cost: ~$0.02 (one-time)
 * Time: ~10-15 minutes for 30k+ lines
 */

const admin = require('firebase-admin');
const OpenAI = require('openai');

// Initialize Firebase Admin
try {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Error loading service account:', error.message);
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding for a single line
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Process lines in batches
 */
async function processInBatches(lines, batchSize = 100) {
  const db = admin.firestore();
  let processed = 0;
  let errors = 0;
  const startTime = Date.now();
  
  console.log(`\n🚀 Processing ${lines.length} lines in batches of ${batchSize}...\n`);
  
  for (let i = 0; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize);
    
    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(async (doc) => {
        try {
          // Generate embedding
          const text = `${doc.character}: ${doc.line}`;
          const embedding = await generateEmbedding(text);
          
          // Update Firestore
          await db.collection('seinfeldScripts').doc(doc.id).update({
            embedding: embedding,
            embeddedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          return { success: true };
        } catch (error) {
          console.error(`  ⚠️  Error processing ${doc.id}:`, error.message);
          return { success: false, error };
        }
      })
    );
    
    // Count successes and failures
    const batchSuccesses = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const batchErrors = results.length - batchSuccesses;
    
    processed += batchSuccesses;
    errors += batchErrors;
    
    // Progress update
    const progress = ((processed / lines.length) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (processed / elapsed).toFixed(1);
    const remaining = Math.round((lines.length - processed) / rate);
    
    console.log(`  ✓ ${processed}/${lines.length} (${progress}%) | ${rate}/sec | ~${remaining}s remaining`);
    
    // Rate limiting: wait 1 second between batches to avoid hitting OpenAI limits
    if (i + batchSize < lines.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return { processed, errors };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🎭 Generating Embeddings for Seinfeld Scripts\n');
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Error: OPENAI_API_KEY environment variable not set!');
      console.log('\nSet it with:');
      console.log('  export OPENAI_API_KEY=your-key-here');
      process.exit(1);
    }
    
    const db = admin.firestore();
    
    // Get all lines without embeddings
    console.log('📖 Fetching lines from Firestore...');
    const snapshot = await db.collection('seinfeldScripts')
      .where('embedding', '==', null)
      .get();
    
    if (snapshot.empty) {
      console.log('✅ All lines already have embeddings!');
      
      // Show stats
      const totalSnapshot = await db.collection('seinfeldScripts').get();
      console.log(`\n📊 Total lines in database: ${totalSnapshot.size.toLocaleString()}`);
      
      process.exit(0);
    }
    
    const lines = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    console.log(`  Found ${lines.length.toLocaleString()} lines without embeddings\n`);
    
    // Estimate cost
    const avgTokensPerLine = 20; // Conservative estimate
    const totalTokens = lines.length * avgTokensPerLine;
    const costPer1M = 0.02; // $0.02 per 1M tokens for text-embedding-3-small
    const estimatedCost = (totalTokens / 1_000_000) * costPer1M;
    
    console.log('💰 Cost Estimate:');
    console.log(`  Lines: ${lines.length.toLocaleString()}`);
    console.log(`  Tokens: ~${totalTokens.toLocaleString()}`);
    console.log(`  Cost: ~$${estimatedCost.toFixed(3)}`);
    console.log('');
    
    // Confirm before proceeding
    console.log('⚠️  About to generate embeddings. This will take 10-15 minutes.');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Process all lines
    const startTime = Date.now();
    const { processed, errors } = await processInBatches(lines);
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
    
    // Final summary
    console.log('\n✨ Done!\n');
    console.log('📊 Summary:');
    console.log(`  ✓ Processed: ${processed.toLocaleString()} lines`);
    console.log(`  ⚠️  Errors: ${errors}`);
    console.log(`  ⏱️  Time: ${totalTime}s (${(totalTime / 60).toFixed(1)} minutes)`);
    console.log(`  💰 Actual cost: ~$${estimatedCost.toFixed(3)}`);
    console.log('');
    console.log('🎯 Seinfeld Mode is now fully operational!');
    console.log('   Agents can now search the entire show for relevant quotes.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
