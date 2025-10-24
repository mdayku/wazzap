import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage: string;
  targetLanguage: string;
}

/**
 * Translate text using Cloud Function (which uses GPT-4o-mini)
 * This is called client-side when needed
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslationResult> {
  try {
    const translateFunction = httpsCallable(functions, 'translate');
    const result = await translateFunction({
      text,
      targetLanguage,
      sourceLanguage,
    });

    return result.data as TranslationResult;
  } catch (error) {
    console.error('Error translating text:', error);
    throw error;
  }
}

/**
 * Batch translate multiple messages
 * Useful for translating message history when user changes language
 */
export async function batchTranslate(
  messages: Array<{ id: string; text: string }>,
  targetLanguage: string
): Promise<Map<string, string>> {
  const translations = new Map<string, string>();

  // Translate in batches of 10 to avoid overwhelming the API
  for (let i = 0; i < messages.length; i += 10) {
    const batch = messages.slice(i, i + 10);
    const promises = batch.map(msg =>
      translateText(msg.text, targetLanguage)
        .then(result => ({ id: msg.id, translation: result.translatedText }))
        .catch(error => {
          console.error(`Error translating message ${msg.id}:`, error);
          return { id: msg.id, translation: msg.text }; // Fallback to original
        })
    );

    const results = await Promise.all(promises);
    results.forEach(r => translations.set(r.id, r.translation));
  }

  return translations;
}

/**
 * Detect language of text using Cloud Function
 */
export async function detectLanguage(text: string): Promise<string> {
  try {
    const detectFunction = httpsCallable(functions, 'detectLang');
    const result = await detectFunction({ text });
    return (result.data as { language: string }).language;
  } catch (error) {
    console.error('Error detecting language:', error);
    return 'en'; // Default to English on error
  }
}

