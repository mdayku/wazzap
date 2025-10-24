import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Lazy initialize OpenAI
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage: string;
  targetLanguage: string;
}

/**
 * Translate text using GPT-4o-mini
 * Called by client when manual translation is needed
 */
export const translateText = functions.https.onCall(async (data, context) => {
  const { text, targetLanguage, sourceLanguage } = data;

  if (!text || !targetLanguage) {
    throw new functions.https.HttpsError('invalid-argument', 'text and targetLanguage are required');
  }

  const openai = getOpenAI();

  try {
    const prompt = sourceLanguage
      ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Only return the translation, no explanations:\n\n${text}`
      : `Translate the following text to ${targetLanguage}. Only return the translation, no explanations:\n\n${text}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Low temperature for consistent translations
      max_tokens: 500,
    });

    const translatedText = response.choices[0].message.content || text;

    return {
      translatedText,
      detectedSourceLanguage: sourceLanguage || 'auto',
      targetLanguage,
    } as TranslationResult;
  } catch (error: any) {
    console.error('Error translating text:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to translate text');
  }
});

/**
 * Detect language of text using GPT-4o-mini
 */
export const detectLanguage = functions.https.onCall(async (data, context) => {
  const { text } = data;

  if (!text) {
    throw new functions.https.HttpsError('invalid-argument', 'text is required');
  }

  const openai = getOpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Detect the language of this text and respond with only the ISO 639-1 language code (e.g., 'en', 'es', 'fr'):\n\n${text}`
      }],
      temperature: 0.1,
      max_tokens: 10,
    });

    const language = response.choices[0].message.content?.trim().toLowerCase() || 'en';

    return { language };
  } catch (error: any) {
    console.error('Error detecting language:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to detect language');
  }
});

/**
 * Automatically translate messages when they're created
 * Triggered by Firestore onCreate for messages
 */
export const translateMessage = functions.firestore
  .document('threads/{threadId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const threadId = context.params.threadId;

    // Skip load test messages
    if (message.isLoadTest) {
      console.log('Skipping translation for load test message');
      return null;
    }

    // Skip if no text content
    if (!message.text) {
      return null;
    }

    try {
      // Get all thread participants
      const threadDoc = await db.collection('threads').doc(threadId).get();
      const threadData = threadDoc.data();

      if (!threadData) {
        console.error('Thread not found:', threadId);
        return null;
      }

      const participants = threadData.members || [];

      // Get preferred languages of all participants (except sender)
      const languages = new Set<string>();
      for (const userId of participants) {
        // Skip the sender - they see their own language
        if (userId === message.senderId) {
          continue;
        }

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        const preferredLanguage = userData?.preferredLanguage || 'en';
        
        // Add language for translation (translate to ANY language different from sender)
        if (preferredLanguage) {
          languages.add(preferredLanguage);
        }
      }

      // If no translations needed, skip
      if (languages.size === 0) {
        return null;
      }

      const openai = getOpenAI();
      const translations: { [key: string]: string } = {};

      // Translate to each required language
      for (const lang of languages) {
        try {
          // Map language codes to full names for better translation
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
          
          const targetLanguage = languageNames[lang] || lang;
          
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: `Translate the following text to ${targetLanguage}. Only return the translation, no explanations:\n\n${message.text}`
            }],
            temperature: 0.3,
            max_tokens: 500,
          });

          translations[lang] = response.choices[0].message.content || message.text;
          console.log(`Translated to ${targetLanguage} (${lang}):`, translations[lang]);
        } catch (error) {
          console.error(`Error translating to ${lang}:`, error);
          translations[lang] = message.text; // Fallback to original
        }
      }

      // Update message with translations
      await snap.ref.update({
        translations,
        translatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    } catch (error) {
      console.error('Error in translateMessage function:', error);
      return null; // Don't throw - we don't want to block message creation
    }
  });

