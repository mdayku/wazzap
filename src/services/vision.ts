import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

export interface ImageAnalysis {
  description: string;
  model: string;
  analyzedAt: any;
}

/**
 * Analyze an image using GPT-4 Vision
 */
export const analyzeImageContent = async (
  messageId: string,
  threadId: string
): Promise<ImageAnalysis> => {
  const analyzeImage = httpsCallable(functions, 'analyzeImageContent');
  
  const result = await analyzeImage({ messageId, threadId });
  
  return (result.data as any).imageAnalysis;
};

