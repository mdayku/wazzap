import * as functions from 'firebase-functions';
import { onMessageCreate } from './priority';
import { summarizeThread, extractAI } from './summary';
import { semanticSearch, batchGenerateEmbeddings } from './embeddings';
import { analyzeThreadContext, submitSuggestionFeedback, dismissSuggestion as dismissSuggestionHandler, suggestMeetingTimes } from './proactive';
import { transcribeAudio, autoTranscribeAudio } from './transcription';
import { generateImage } from './imageGeneration';
import { analyzeImage, autoAnalyzeImage } from './vision';
import { seinfeldAgentResponse, enableSeinfeldMode, disableSeinfeldMode } from './seinfeldAgents';

// Firestore trigger: runs when a new message is created
export const messageCreated = functions.firestore
  .document('threads/{threadId}/messages/{messageId}')
  .onCreate(onMessageCreate);

// Firestore trigger: auto-transcribe audio messages
export const audioMessageCreated = functions.firestore
  .document('threads/{threadId}/messages/{messageId}')
  .onCreate(autoTranscribeAudio);

// Firestore trigger: auto-analyze image messages
export const imageMessageCreated = functions.firestore
  .document('threads/{threadId}/messages/{messageId}')
  .onCreate(autoAnalyzeImage);

// Callable functions for AI features
export const summarize = functions.https.onCall(summarizeThread);
export const extract = functions.https.onCall(extractAI);

// Semantic search with embeddings
export const search = functions.https.onCall(semanticSearch);
export const generateEmbeddings = functions.https.onCall(batchGenerateEmbeddings);

// Proactive assistant
export const analyzeContext = functions.https.onCall(analyzeThreadContext);
export const suggestionFeedback = functions.https.onCall(submitSuggestionFeedback);
export const dismissSuggestion = functions.https.onCall(dismissSuggestionHandler);
export const suggestTimes = functions.https.onCall(suggestMeetingTimes); // Legacy

// Voice transcription
export const transcribe = functions.https.onCall(transcribeAudio);

// AI image generation
export const generate = generateImage;

// GPT-4 Vision image analysis
export const analyzeImageContent = functions.https.onCall(analyzeImage);

// Seinfeld Mode - AI agent system
export const seinfeldAgent = seinfeldAgentResponse;
export const enableSeinfeld = enableSeinfeldMode;
export const disableSeinfeld = disableSeinfeldMode;
