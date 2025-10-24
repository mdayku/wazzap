import * as admin from 'firebase-admin';
import OpenAI, { toFile } from 'openai';
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
 * Transcribe audio message using OpenAI Whisper API
 * Callable function: transcribeAudio(messageId, threadId)
 */
export const transcribeAudio = async (data: any, context: any) => {
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
    
    // Check if it's an audio message
    if (!messageData?.media || messageData.media.type !== 'audio') {
      throw new functions.https.HttpsError('invalid-argument', 'Message is not an audio message');
    }
    
    // Check if already transcribed
    if (messageData.transcription) {
      console.log(`Message ${messageId} already transcribed`);
      return { transcription: messageData.transcription };
    }
    
    const audioUrl = messageData.media.url;
    
    if (!audioUrl) {
      throw new functions.https.HttpsError('invalid-argument', 'Audio URL not found');
    }
    
    console.log(`Transcribing audio from: ${audioUrl}`);
    
    // Download audio file from Firebase Storage
    const response = await fetch(audioUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }
    
    const audioBuffer = await response.arrayBuffer();
    
    // Convert ArrayBuffer to Buffer for Node.js
    const buffer = Buffer.from(audioBuffer);
    
    // Use OpenAI's toFile helper to create a proper file object
    const audioFile = await toFile(buffer, `audio_${messageId}.m4a`, { type: 'audio/m4a' });
    
    // Call Whisper API
    const transcriptionStart = Date.now();
    const openai = getOpenAIClient();
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Can be auto-detected by removing this
      response_format: 'verbose_json', // Get timestamps for word-level highlighting
    });
    
    const transcriptionTime = Date.now() - transcriptionStart;
    console.log(`Transcription completed in ${transcriptionTime}ms`);
    
    const transcription = {
      text: transcriptionResponse.text,
      language: transcriptionResponse.language || 'en',
      duration: transcriptionResponse.duration,
      // Word-level timestamps for inline highlighting (if available)
      words: (transcriptionResponse as any).words || [],
      transcribedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Store transcription in message document
    await messageRef.update({
      transcription,
    });
    
    console.log(`Transcription stored for message ${messageId}`);
    
    // Generate embedding for transcription text (for RAG/search)
    const { generateEmbedding } = await import('./embeddings');
    await generateEmbedding(messageId, threadId, transcription.text, messageData.senderId);
    
    console.log(`Embedding generated for manual transcription of ${messageId}`);
    
    // Return transcription
    return { transcription };
    
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Transcription failed');
  }
};

/**
 * Automatically transcribe audio messages on creation
 * Firestore trigger: runs when a new audio message is created
 */
export const autoTranscribeAudio = async (
  snap: admin.firestore.QueryDocumentSnapshot,
  context: functions.EventContext
) => {
  const messageData = snap.data();
  const messageId = snap.id;
  const threadId = context.params.threadId;
  
  // Only process audio messages
  if (!messageData.media || messageData.media.type !== 'audio') {
    return null;
  }
  
  // Skip if already transcribed
  if (messageData.transcription) {
    console.log(`Message ${messageId} already has transcription`);
    return null;
  }
  
  console.log(`Auto-transcribing audio message ${messageId}`);
  
  try {
    const audioUrl = messageData.media.url;
    
    if (!audioUrl) {
      console.error('Audio URL not found');
      return null;
    }
    
    // Download audio file
    const response = await fetch(audioUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }
    
    const audioBuffer = await response.arrayBuffer();
    
    // Convert ArrayBuffer to Buffer for Node.js
    const buffer = Buffer.from(audioBuffer);
    
    // Use OpenAI's toFile helper to create a proper file object
    const audioFile = await toFile(buffer, `audio_${messageId}.m4a`, { type: 'audio/m4a' });
    
    // Call Whisper API
    const openai = getOpenAIClient();
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
    });
    
    const transcription = {
      text: transcriptionResponse.text,
      language: transcriptionResponse.language || 'en',
      duration: transcriptionResponse.duration,
      words: (transcriptionResponse as any).words || [],
      transcribedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    console.log(`Auto-transcription completed for ${messageId}: "${transcription.text}"`);
    
    // Translate transcription for thread participants
    const db = admin.firestore();
    const threadDoc = await db.collection('threads').doc(threadId).get();
    const threadData = threadDoc.data();
    
    if (threadData) {
      const participants = threadData.members || [];
      const transcriptionTranslations: { [key: string]: string } = {};
      
      // Get preferred languages of all participants (except sender)
      for (const userId of participants) {
        if (userId === messageData.senderId) continue;
        
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const preferredLanguage = userData?.preferredLanguage || 'en';
        
        // Translate if the transcription language differs from user's preferred language
        const transcriptionLanguage = transcription.language || 'en';
        if (preferredLanguage !== transcriptionLanguage && !transcriptionTranslations[preferredLanguage]) {
          try {
            const languageNames: { [key: string]: string } = {
              'en': 'English',
              'zh': 'Chinese (Simplified)',
              'es': 'Spanish',
              'fr': 'French',
              'de': 'German',
              'ja': 'Japanese',
              'ko': 'Korean',
              'ar': 'Arabic',
              'hi': 'Hindi',
              'pt': 'Portuguese',
              'ru': 'Russian',
              'it': 'Italian',
            };
            
            const targetLanguage = languageNames[preferredLanguage] || preferredLanguage;
            
            const translationResponse = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [{
                role: 'user',
                content: `Translate the following text to ${targetLanguage}. Only return the translation, no explanations:\n\n${transcription.text}`
              }],
              temperature: 0.3,
              max_tokens: 500,
            });
            
            transcriptionTranslations[preferredLanguage] = translationResponse.choices[0].message.content || transcription.text;
            console.log(`Translated transcription to ${targetLanguage} (${preferredLanguage}):`, transcriptionTranslations[preferredLanguage]);
          } catch (error) {
            console.error(`Error translating transcription to ${preferredLanguage}:`, error);
          }
        }
      }
      
      // Store transcription with translations
      await snap.ref.update({
        transcription: {
          ...transcription,
          translations: transcriptionTranslations,
        },
      });
    } else {
      // No thread data, just store transcription
      await snap.ref.update({
        transcription,
      });
    }
    
    // Generate embedding for transcription text (for RAG/search)
    // Import dynamically to avoid circular dependency
    const { generateEmbedding } = await import('./embeddings');
    await generateEmbedding(messageId, threadId, transcription.text, messageData.senderId);
    
    console.log(`Embedding generated for transcription of ${messageId}`);
    
    return null;
    
  } catch (error: any) {
    console.error(`Error auto-transcribing message ${messageId}:`, error);
    // Don't throw - let the message exist without transcription
    return null;
  }
};

