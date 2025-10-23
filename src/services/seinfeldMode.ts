import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

interface EnableSeinfeldModeRequest {
  threadId: string;
  activeCharacters?: ('Jerry' | 'George' | 'Elaine' | 'Kramer')[];
}

interface SeinfeldModeResponse {
  success: boolean;
  message: string;
}

const enableSeinfeldCallable = httpsCallable<EnableSeinfeldModeRequest, SeinfeldModeResponse>(
  functions,
  'enableSeinfeld'
);

const disableSeinfeldCallable = httpsCallable<{ threadId: string }, SeinfeldModeResponse>(
  functions,
  'disableSeinfeld'
);

/**
 * Enable Seinfeld Mode for a thread
 * This adds 4 AI agents (Jerry, George, Elaine, Kramer) to the conversation
 */
export async function enableSeinfeldMode(
  threadId: string,
  activeCharacters?: ('Jerry' | 'George' | 'Elaine' | 'Kramer')[]
): Promise<SeinfeldModeResponse> {
  try {
    const result = await enableSeinfeldCallable({ threadId, activeCharacters });
    return result.data;
  } catch (error) {
    console.error('Error enabling Seinfeld Mode:', error);
    throw error;
  }
}

/**
 * Disable Seinfeld Mode for a thread
 */
export async function disableSeinfeldMode(threadId: string): Promise<SeinfeldModeResponse> {
  try {
    const result = await disableSeinfeldCallable({ threadId });
    return result.data;
  } catch (error) {
    console.error('Error disabling Seinfeld Mode:', error);
    throw error;
  }
}

