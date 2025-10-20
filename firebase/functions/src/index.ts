import * as functions from 'firebase-functions';
import { onMessageCreate } from './priority';
import { summarizeThread, extractAI } from './summary';
import { semanticSearch, batchGenerateEmbeddings } from './embeddings';
import { detectSchedulingIntent, suggestMeetingTimes } from './proactive';

// Firestore trigger: runs when a new message is created
export const messageCreated = functions.firestore
  .document('threads/{threadId}/messages/{messageId}')
  .onCreate(onMessageCreate);

// Callable functions for AI features
export const summarize = functions.https.onCall(summarizeThread);
export const extract = functions.https.onCall(extractAI);

// Semantic search with embeddings
export const search = functions.https.onCall(semanticSearch);
export const generateEmbeddings = functions.https.onCall(batchGenerateEmbeddings);

// Proactive assistant
export const detectScheduling = functions.https.onCall(detectSchedulingIntent);
export const suggestTimes = functions.https.onCall(suggestMeetingTimes);

