import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

const createSeinfeldUsersCallable = httpsCallable(functions, 'createSeinfeldUsers');

/**
 * Call this once to create Firebase user accounts for all Seinfeld characters
 * This makes them appear in New Chat screen and member lists
 */
export async function setupSeinfeldUsers() {
  try {
    const result = await createSeinfeldUsersCallable({});
    console.log('Seinfeld users setup result:', result.data);
    return result.data;
  } catch (error) {
    console.error('Error setting up Seinfeld users:', error);
    throw error;
  }
}

