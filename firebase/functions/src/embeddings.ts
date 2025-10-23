import { getFirestore } from 'firebase-admin/firestore';
import OpenAI from 'openai';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// Lazy initialize OpenAI
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

/**
 * Generate embedding for a message
 * This can be called manually or triggered automatically
 */
export const generateEmbedding = async (messageId: string, threadId: string, text: string, senderId?: string) => {
  const openai = getOpenAI();
  try {
    if (!text || text.trim().length === 0) {
      return null;
    }

    // Generate embedding using OpenAI
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // Limit input length
    });

    const vector = response.data[0].embedding;

    // Store in Firestore
    const embeddingDoc: any = {
      messageId,
      threadId,
      vector,
      text: text.slice(0, 500), // Store snippet for reference
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Include senderId if provided (for cross-chat user context)
    if (senderId) {
      embeddingDoc.senderId = senderId;
    }

    await db.collection('embeddings').doc(messageId).set(embeddingDoc);

    return vector;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
};

/**
 * Semantic search using embeddings
 * Callable function from client
 */
export const semanticSearch = async (data: any, context: any) => {
  const openai = getOpenAI();
  const { query, threadId, limit = 10 } = data || {};

  if (!query) {
    throw new Error('query is required');
  }

  try {
    // Generate embedding for the search query
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryVector = response.data[0].embedding;

    // Fetch embeddings for the thread (or all if no threadId)
    let embeddingsQuery = db.collection('embeddings');
    
    if (threadId) {
      embeddingsQuery = embeddingsQuery.where('threadId', '==', threadId) as any;
    }

    const embeddingsSnap = await embeddingsQuery.limit(1000).get();

    // Calculate cosine similarity for each embedding
    const results = embeddingsSnap.docs.map(doc => {
      const data = doc.data();
      const similarity = cosineSimilarity(queryVector, data.vector);
      
      return {
        messageId: data.messageId,
        threadId: data.threadId,
        text: data.text,
        similarity,
      };
    });

    // Sort by similarity and return top results
    results.sort((a, b) => b.similarity - a.similarity);
    
    return {
      results: results.slice(0, limit),
    };
  } catch (error) {
    console.error('Error in semantic search:', error);
    throw new Error('Failed to perform semantic search');
  }
};

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Get relevant context messages for a query
 * Helper function for RAG - used by AI features to augment prompts
 */
export const getRelevantContext = async (
  query: string,
  threadId: string,
  limit: number = 5,
  senderId?: string  // Optional: filter by specific user
): Promise<Array<{ messageId: string; text: string; similarity: number; senderId?: string }>> => {
  const openai = getOpenAI();
  
  try {
    // Generate embedding for the query
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryVector = response.data[0].embedding;

    // Fetch embeddings (optionally filtered by thread and/or sender)
    let embeddingsQuery = db.collection('embeddings');
    
    if (threadId && threadId.length > 0) {
      // Thread-specific search
      embeddingsQuery = embeddingsQuery.where('threadId', '==', threadId) as any;
    }
    // If threadId is empty, search ALL threads (cross-chat context)
    
    if (senderId && senderId.length > 0) {
      // User-specific search
      embeddingsQuery = embeddingsQuery.where('senderId', '==', senderId) as any;
    }
    
    const embeddingsSnap = await embeddingsQuery.limit(1000).get();

    // Calculate cosine similarity for each embedding
    const results = embeddingsSnap.docs.map(doc => {
      const data = doc.data();
      const similarity = cosineSimilarity(queryVector, data.vector);
      
      return {
        messageId: data.messageId,
        text: data.text,
        similarity,
        senderId: data.senderId,
      };
    });

    // Sort by similarity and return top K results
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.slice(0, limit);
  } catch (error) {
    console.error('Error getting relevant context:', error);
    return []; // Return empty array on error - don't fail the AI call
  }
};

/**
 * Batch generate embeddings for existing messages
 * Can be called manually to backfill
 */
export const batchGenerateEmbeddings = async (data: any, context: any) => {
  const { threadId, limit = 100 } = data || {};

  if (!threadId) {
    throw new Error('threadId is required');
  }

  try {
    // Fetch messages that don't have embeddings yet
    const messagesSnap = await db
      .collection(`threads/${threadId}/messages`)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    let count = 0;

    for (const messageDoc of messagesSnap.docs) {
      const messageData = messageDoc.data();
      
      if (!messageData.text || messageData.text.trim().length === 0) {
        continue;
      }

      // Check if embedding already exists
      const existingEmbedding = await db.collection('embeddings').doc(messageDoc.id).get();
      
      if (existingEmbedding.exists) {
        continue;
      }

      // Generate embedding
      try {
        await generateEmbedding(messageDoc.id, threadId, messageData.text);
        count++;
      } catch (error) {
        console.error(`Error generating embedding for message ${messageDoc.id}:`, error);
      }
    }

    return {
      generated: count,
      total: messagesSnap.docs.length,
    };
  } catch (error) {
    console.error('Error in batch generation:', error);
    throw new Error('Failed to generate embeddings');
  }
};

