import * as admin from 'firebase-admin';
import OpenAI from 'openai';
import * as functions from 'firebase-functions';

// Lazy-load OpenAI client to avoid initialization errors during deployment
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
 * Analyze image using GPT-4 Vision API
 * Callable function: analyzeImage(messageId, threadId)
 */
export const analyzeImage = async (data: any, context: any) => {
  const { messageId, threadId } = data || {};

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  if (!messageId || !threadId) {
    throw new functions.https.HttpsError('invalid-argument', 'messageId and threadId are required');
  }

  try {
    const db = admin.firestore();
    
    // Fetch the message
    const messageRef = db.collection('threads').doc(threadId).collection('messages').doc(messageId);
    const messageDoc = await messageRef.get();
    
    if (!messageDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Message not found');
    }
    
    const messageData = messageDoc.data();
    
    // Check if it's an image message
    if (!messageData?.media || messageData.media.type !== 'image') {
      throw new functions.https.HttpsError('invalid-argument', 'Message is not an image message');
    }
    
    // Check if already analyzed
    if (messageData.imageAnalysis) {
      console.log(`Message ${messageId} already analyzed`);
      return { imageAnalysis: messageData.imageAnalysis };
    }
    
    const imageUrl = messageData.media.url;
    
    if (!imageUrl) {
      throw new functions.https.HttpsError('invalid-argument', 'Image URL not found');
    }
    
    console.log(`Analyzing image from: ${imageUrl}`);
    
    // Call GPT-4 Vision API
    const analysisStart = Date.now();
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this image in detail. Provide:
1. A brief description (1-2 sentences)
2. Key objects, people, or elements visible
3. Any text visible in the image (OCR)
4. Context or setting
5. Notable details or features

Format your response as a natural paragraph that can be used for search and context.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high', // Use high detail for better analysis
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3, // Lower temperature for more consistent analysis
    });
    
    const analysisTime = Date.now() - analysisStart;
    console.log(`Image analysis completed in ${analysisTime}ms`);
    
    const analysisText = response.choices[0].message.content || '';
    
    const imageAnalysis = {
      description: analysisText,
      model: 'gpt-4o',
      analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Store analysis in message document
    await messageRef.update({
      imageAnalysis,
    });
    
    console.log(`Image analysis stored for message ${messageId}`);
    
    // Generate embedding for image analysis text (for RAG/search)
    const { generateEmbedding } = await import('./embeddings');
    await generateEmbedding(messageId, threadId, analysisText, messageData.senderId);
    
    console.log(`Embedding generated for image analysis of ${messageId}`);
    
    // Return analysis
    return { imageAnalysis };
    
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Image analysis failed');
  }
};

/**
 * Automatically analyze images on creation
 * Firestore trigger: runs when a new image message is created
 */
export const autoAnalyzeImage = async (
  snap: admin.firestore.QueryDocumentSnapshot,
  context: functions.EventContext
) => {
  const messageData = snap.data();
  const messageId = snap.id;
  const threadId = context.params.threadId;
  
  // Skip test data
  if (messageData.isTestData) {
    console.log('Skipping image analysis for test data');
    return null;
  }
  
  // Only process image messages
  if (!messageData.media || messageData.media.type !== 'image') {
    return null;
  }
  
  // Skip if already analyzed
  if (messageData.imageAnalysis) {
    console.log(`Message ${messageId} already has image analysis`);
    return null;
  }
  
  console.log(`Auto-analyzing image message ${messageId}`);
  
  try {
    const imageUrl = messageData.media.url;
    
    if (!imageUrl) {
      console.error('Image URL not found');
      return null;
    }
    
    // Call GPT-4 Vision API
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this image in detail. Provide:
1. A brief description (1-2 sentences)
2. Key objects, people, or elements visible
3. Any text visible in the image (OCR)
4. Context or setting
5. Notable details or features

Format your response as a natural paragraph that can be used for search and context.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });
    
    const analysisText = response.choices[0].message.content || '';
    
    const imageAnalysis = {
      description: analysisText,
      model: 'gpt-4o',
      analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Store analysis
    await snap.ref.update({
      imageAnalysis,
    });
    
    console.log(`Auto-analysis completed for ${messageId}: "${analysisText.slice(0, 100)}..."`);
    
    // Generate embedding for image analysis text (for RAG/search)
    const { generateEmbedding } = await import('./embeddings');
    await generateEmbedding(messageId, threadId, analysisText, messageData.senderId);
    
    console.log(`Embedding generated for image analysis of ${messageId}`);
    
    return null;
    
  } catch (error: any) {
    console.error(`Error auto-analyzing image ${messageId}:`, error);
    // Don't throw - let the message exist without analysis
    return null;
  }
};

