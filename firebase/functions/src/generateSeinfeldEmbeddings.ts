import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

// Lazy-load OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: functions.config().openai?.key || process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Generate embeddings for all Seinfeld scripts that don't have them yet
 * Callable function - run once to generate embeddings for all scripts
 */
export const generateSeinfeldEmbeddings = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes max
    memory: '1GB',
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const db = admin.firestore();
    const openai = getOpenAIClient();

    try {
      console.log('[EMBEDDINGS] Starting embedding generation for Seinfeld scripts...');

      // Get all scripts without embeddings
      const scriptsSnapshot = await db
        .collection('seinfeldScripts')
        .where('embedding', '==', null)
        .get();

      if (scriptsSnapshot.empty) {
        // Check if any scripts exist at all
        const allScripts = await db.collection('seinfeldScripts').limit(1).get();
        if (allScripts.empty) {
          return {
            success: true,
            message: 'No scripts found in database',
            processed: 0,
            total: 0,
          };
        }

        return {
          success: true,
          message: 'All scripts already have embeddings',
          processed: 0,
          total: 0,
        };
      }

      console.log(`[EMBEDDINGS] Found ${scriptsSnapshot.size} scripts without embeddings`);

      let processed = 0;
      const batchSize = 10; // Process in batches to avoid rate limits
      const scripts = scriptsSnapshot.docs;

      for (let i = 0; i < scripts.length; i += batchSize) {
        const batch = scripts.slice(i, i + batchSize);
        const batchPromises = batch.map(async (doc) => {
          const data = doc.data();
          const text = `${data.character}: ${data.line}`;

          try {
            // Generate embedding
            const response = await openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: text,
            });

            const embedding = response.data[0].embedding;

            // Update document with embedding
            await doc.ref.update({
              embedding,
              embeddingModel: 'text-embedding-3-small',
              embeddedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            processed++;
            console.log(`[EMBEDDINGS] Processed ${processed}/${scripts.length}: ${data.character} - "${data.line.substring(0, 50)}..."`);

            return { success: true, id: doc.id };
          } catch (error: any) {
            console.error(`[EMBEDDINGS] Error processing ${doc.id}:`, error.message);
            return { success: false, id: doc.id, error: error.message };
          }
        });

        await Promise.all(batchPromises);

        // Small delay between batches to respect rate limits
        if (i + batchSize < scripts.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(`[EMBEDDINGS] ✅ Completed! Processed ${processed}/${scripts.length} scripts`);

      return {
        success: true,
        message: `Successfully generated embeddings for ${processed} scripts`,
        processed,
        total: scripts.length,
      };
    } catch (error: any) {
      console.error('[EMBEDDINGS] Error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * Search for relevant Seinfeld quotes using vector similarity
 * This replaces the simple keyword search
 */
export async function searchSeinfeldQuotes(
  query: string,
  character: string,
  limit: number = 5
): Promise<string[]> {
  const openai = getOpenAIClient();
  const db = admin.firestore();

  try {
    // Generate embedding for the query
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = response.data[0].embedding;

    // Get all scripts for this character that have embeddings
    const scriptsSnapshot = await db
      .collection('seinfeldScripts')
      .where('character', '==', character)
      .where('embedding', '!=', null)
      .get();

    if (scriptsSnapshot.empty) {
      console.log(`[SEARCH] No embedded scripts found for ${character}`);
      return [];
    }

    // Extract keywords from query for hybrid search
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(w => w.length > 3);

    // Calculate cosine similarity for each script
    const similarities = scriptsSnapshot.docs.map((doc) => {
      const data = doc.data();
      const embedding = data.embedding;
      const lineLower = (data.line || '').toLowerCase();

      if (!embedding || !Array.isArray(embedding)) {
        return { line: data.line, similarity: 0 };
      }

      // Cosine similarity
      const dotProduct = queryEmbedding.reduce(
        (sum: number, val: number, idx: number) => sum + val * embedding[idx],
        0
      );
      const magnitudeA = Math.sqrt(queryEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
      const magnitudeB = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
      let similarity = dotProduct / (magnitudeA * magnitudeB);

      // Hybrid boost: if line contains query keywords, boost similarity
      const keywordMatches = keywords.filter(kw => lineLower.includes(kw)).length;
      if (keywordMatches > 0) {
        similarity += (keywordMatches * 0.15); // Boost by 0.15 per keyword match
      }

      return {
        line: data.line,
        similarity,
        episode: data.episode,
      };
    });

    // Sort by boosted similarity and return top results
    const topResults = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((r) => r.line);

    console.log(`[SEARCH] Found ${topResults.length} relevant quotes for ${character}`);
    return topResults;
  } catch (error: any) {
    console.error('[SEARCH] Error searching quotes:', error);
    return [];
  }
}

