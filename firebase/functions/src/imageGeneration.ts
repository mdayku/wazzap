import * as functions from 'firebase-functions';
import OpenAI from 'openai';

// Lazy-load OpenAI client to avoid deployment errors
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

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
 * Cloud Function to generate images using DALL-E 3
 */
export const generateImage = functions.https.onCall(
  async (data: GenerateImageRequest, context): Promise<GenerateImageResponse> => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to generate images'
      );
    }

    const { prompt, size = '1024x1024', quality = 'standard' } = data;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Prompt is required and must be a non-empty string'
      );
    }

    if (prompt.length > 4000) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Prompt must be less than 4000 characters'
      );
    }

    try {
      const openai = getOpenAIClient();

      console.log(`Generating image for user ${context.auth.uid}: "${prompt.substring(0, 50)}..."`);

      // Generate image using DALL-E 3
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt.trim(),
        n: 1,
        size,
        quality,
        response_format: 'url',
      });

      const imageUrl = response.data?.[0]?.url;
      const revisedPrompt = response.data?.[0]?.revised_prompt;

      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      console.log(`Image generated successfully for user ${context.auth.uid}`);

      return {
        imageUrl,
        revisedPrompt,
      };
    } catch (error: any) {
      console.error('Error generating image:', error);

      // Handle OpenAI API errors
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error?.message || 'Unknown OpenAI error';

        if (status === 400) {
          throw new functions.https.HttpsError('invalid-argument', `Invalid prompt: ${message}`);
        } else if (status === 429) {
          throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded. Please try again later.');
        } else if (status === 500) {
          throw new functions.https.HttpsError('internal', 'OpenAI service error. Please try again.');
        }
      }

      throw new functions.https.HttpsError(
        'internal',
        `Failed to generate image: ${error.message}`
      );
    }
  }
);

