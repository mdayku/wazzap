import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/**
 * Transcribe an audio message using OpenAI Whisper
 */
export async function transcribeAudioMessage(messageId: string, threadId: string): Promise<{ transcription: any }> {
  const transcribeFunction = httpsCallable(functions, 'transcribe');
  
  try {
    const result = await transcribeFunction({ messageId, threadId });
    return result.data as { transcription: any };
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

