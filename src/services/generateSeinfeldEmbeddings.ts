import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

interface EmbeddingResponse {
  success: boolean;
  message: string;
  processed: number;
  total: number;
}

const generateEmbeddingsCallable = httpsCallable<{}, EmbeddingResponse>(
  functions,
  'generateSeinfeldEmbeddings'
);

/**
 * Generate embeddings for all Seinfeld scripts
 * Call this once after loading scripts
 */
export async function generateSeinfeldEmbeddings(): Promise<EmbeddingResponse> {
  try {
    const result = await generateEmbeddingsCallable({});
    return result.data;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

