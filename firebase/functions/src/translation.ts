import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Normalize language codes to 2-letter ISO 639-1 (en-US -> en, zh_CN -> zh)
function normalizeLang(langCode: string): string {
  return langCode.toLowerCase().replace('_', '-').split('-')[0];
}

// Map language codes to full names for better prompting
export const languageNames: { [key: string]: string } = {
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

/**
 * Get user's preferred language (normalized to 2-letter code)
 * Can be called from other Cloud Functions
 */
export async function getUserLanguage(userId: string): Promise<string> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return 'en'; // Default to English
    }
    const userData = userDoc.data();
    const preferredLanguage = userData?.preferredLanguage || 'en';
    return normalizeLang(preferredLanguage);
  } catch (error) {
    console.error(`Error fetching language for user ${userId}:`, error);
    return 'en'; // Default to English on error
  }
}

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
    
    console.log('🟢🟢🟢 TRANSLATION FUNCTION v2.1 CALLED - Message text:', message.text?.substring(0, 50));

    // Skip load test messages
    if (message.isLoadTest) {
      console.log('Skipping translation for load test message');
      return null;
    }

    // Skip if no text content
    if (!message.text) {
      console.log('🔴 NO TEXT - returning early');
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
      console.log('🔵 Participants:', participants);
      console.log('🔵 Sender ID:', message.senderId);

      // Get preferred languages of all participants (except sender)
      const languages = new Set<string>();
      
      
      for (const userId of participants) {
        console.log(`🔵 Checking participant: ${userId}`);
        
        // Skip the sender - they see their own language
        if (userId === message.senderId) {
          console.log(`🔵 Skipping sender: ${userId}`);
          continue;
        }

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        console.log(`🔵 User ${userId} data:`, { preferredLanguage: userData?.preferredLanguage });

        const preferredLanguage = userData?.preferredLanguage || 'en';
        // Normalize to 2-letter code
        const normalized = normalizeLang(preferredLanguage);
        languages.add(normalized);
        console.log(`🔵 Added language: ${normalized} (from ${preferredLanguage})`);
      }

      console.log('🔵 Final languages set:', Array.from(languages));

      // If no translations needed, skip
      if (languages.size === 0) {
        console.log('🔴 No languages to translate to - returning early');
        return null;
      }

      const openai = getOpenAI();
      
      // Detect source language once
      const detectionResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 5,
        messages: [{
          role: 'user',
          content: `Return ONLY the ISO 639-1 language code for this text:\n\n${message.text}`
        }]
      });
      const detectedLang = normalizeLang(detectionResponse.choices[0].message.content || 'unknown');
      console.log(`Detected source language: ${detectedLang}`);
      console.log(`Target languages: ${Array.from(languages).join(', ')}`);
      
      const translations: { [key: string]: string } = {};
      
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

      // Translate to each required language
      for (const rawLang of languages) {
        const code = normalizeLang(rawLang);
        const targetName = languageNames[code] || 'English';
        
        try {
          // If source and target are the same, just copy the text
          if (detectedLang !== 'unknown' && detectedLang === code) {
            translations[code] = message.text;
            console.log(`Skipped translation to ${targetName} (${code}) - same as source`);
            continue;
          }
          
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0,
            max_tokens: 500,
            messages: [
              {
                role: 'system',
                content: 'You are a precise translation engine. Output only the translated text with no commentary.'
              },
              {
                role: 'user',
                content: `Translate from ${detectedLang} to ${targetName}:\n\n${message.text}`
              }
            ]
          });

          const raw = response.choices[0].message.content || message.text;
          const cleaned = raw.trim().replace(/^["'`]+|["'`]+$/g, '');
          translations[code] = cleaned;
          console.log(`Translated to ${targetName} (${code}):`, translations[code]);
        } catch (error) {
          console.error(`Error translating to ${code}:`, error);
          translations[code] = message.text; // Fallback to original
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

