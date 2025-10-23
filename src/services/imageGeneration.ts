import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

interface GenerateImageRequest {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

interface GenerateImageResponse {
  imageUrl: string;
  revisedPrompt?: string;
}

/**
 * Generate an image using DALL-E 3
 */
export async function generateAIImage(
  prompt: string,
  size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
  quality: 'standard' | 'hd' = 'standard'
): Promise<GenerateImageResponse> {
  const generateImage = httpsCallable<GenerateImageRequest, GenerateImageResponse>(
    functions,
    'generate'
  );

  const result = await generateImage({ prompt, size, quality });
  return result.data;
}

