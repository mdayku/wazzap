import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

// Seinfeld character type
type SeinfeldCharacter = 'Jerry' | 'George' | 'Elaine' | 'Kramer';

// Lazy-load OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: functions.config().openai?.key || process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// Character profiles (simplified for Cloud Function)
const CHARACTER_PROFILES = {
  Jerry: {
    uid: 'seinfeld_jerry',
    personality: `Observational comedian, sarcastic, neat freak. Voice of reason. Finds humor in mundane situations.`,
    style: `Responds with observational humor. Asks rhetorical questions. Slightly sarcastic but friendly.`,
    catchphrases: ["What's the deal with", "That's gold", "Not that there's anything wrong with that"],
    avgWords: 25,
    exclamation: 0.2,
  },
  George: {
    uid: 'seinfeld_george',
    personality: `Neurotic, insecure, cheap, anxious. Chronic liar. Believes world is against him. Master of schemes that backfire.`,
    style: `Anxious and verbose. Complains constantly. Turns everything into a crisis. Yells frequently.`,
    catchphrases: ["I'm out!", "Serenity now!", "It's not a lie if you believe it"],
    avgWords: 30,
    exclamation: 0.5,
  },
  Elaine: {
    uid: 'seinfeld_elaine',
    personality: `Confident, assertive, competitive. Strong opinions. Not afraid to speak her mind. Can be petty.`,
    style: `Direct and assertive. Uses "Get out!" when surprised. Competitive in conversations.`,
    catchphrases: ["Get out!", "Shut up!", "Maybe the dingo ate your baby"],
    avgWords: 22,
    exclamation: 0.4,
  },
  Kramer: {
    uid: 'seinfeld_kramer',
    personality: `Eccentric, spontaneous, energetic. Childlike enthusiasm. No boundaries. Surprisingly successful at random things.`,
    style: `Enthusiastic and scattered. Jumps between topics. Always has a scheme. Giddy up!`,
    catchphrases: ["Giddy up!", "Yeah yeah yeah", "I'm out there Jerry, and I'm loving every minute of it!"],
    avgWords: 20,
    exclamation: 0.6,
  },
};

/**
 * Determine which Seinfeld character should respond
 * Based on conversation context and character availability
 */
function selectResponder(
  message: any,
  threadData: any,
  lastResponder?: SeinfeldCharacter
): SeinfeldCharacter {
  const activeCharacters = threadData.seinfeldMode?.activeCharacters || ['Jerry', 'George', 'Elaine', 'Kramer'];
  
  // Don't let same character respond twice in a row
  const availableCharacters = activeCharacters.filter((c: SeinfeldCharacter) => c !== lastResponder);
  
  // Simple random selection for now
  // In production, could use ML to determine best responder based on message content
  const randomIndex = Math.floor(Math.random() * availableCharacters.length);
  return availableCharacters[randomIndex] || 'Jerry';
}

/**
 * Get recent conversation history
 */
async function getRecentMessages(threadId: string, limit: number = 10): Promise<string> {
  const messagesRef = admin.firestore()
    .collection('threads')
    .doc(threadId)
    .collection('messages')
    .orderBy('createdAt', 'desc')
    .limit(limit);
  
  const snapshot = await messagesRef.get();
  const messages = snapshot.docs
    .reverse()
    .map(doc => {
      const data = doc.data();
      return `${data.senderName || 'User'}: ${data.text || '[media]'}`;
    });
  
  return messages.join('\n');
}

/**
 * Search for relevant Seinfeld quotes from Firestore
 * Uses simple text matching for now, will upgrade to semantic search
 */
async function getRelevantQuotes(messageText: string, character: SeinfeldCharacter): Promise<string[]> {
  try {
    // Search Firestore for character's lines
    const scriptsRef = admin.firestore()
      .collection('seinfeldScripts')
      .where('character', '==', character)
      .limit(100); // Get sample of character's lines
    
    const snapshot = await scriptsRef.get();
    
    if (snapshot.empty) {
      // Fallback to catchphrases if no scripts loaded yet
      const profile = CHARACTER_PROFILES[character];
      return profile.catchphrases.slice(0, 2);
    }
    
    // Get all lines
    const allLines = snapshot.docs.map(doc => doc.data().line as string);
    
    // Simple keyword matching (will upgrade to semantic search)
    const keywords = messageText.toLowerCase().split(' ').filter(w => w.length > 3);
    const relevantLines = allLines.filter(line => 
      keywords.some(keyword => line.toLowerCase().includes(keyword))
    );
    
    // Return relevant lines or random sample
    if (relevantLines.length > 0) {
      return relevantLines.slice(0, 3);
    } else {
      // Return random sample
      const shuffled = allLines.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 2);
    }
  } catch (error) {
    console.error('Error fetching relevant quotes:', error);
    const profile = CHARACTER_PROFILES[character];
    return profile.catchphrases.slice(0, 2);
  }
}

/**
 * Generate Seinfeld character response using GPT-4o-mini
 */
async function generateSeinfeldResponse(
  character: SeinfeldCharacter,
  incomingMessage: any,
  threadId: string
): Promise<string> {
  const profile = CHARACTER_PROFILES[character];
  const openai = getOpenAIClient();
  
  // Get conversation history
  const conversationHistory = await getRecentMessages(threadId);
  
  // Get relevant quotes from Firestore
  const relevantQuotes = await getRelevantQuotes(incomingMessage.text || '', character);
  
  const prompt = `You are ${character} from Seinfeld.

PERSONALITY: ${profile.personality}

YOUR STYLE: ${profile.style}

YOUR CATCHPHRASES (use occasionally, not every message): ${relevantQuotes.join(', ')}

RECENT CONVERSATION:
${conversationHistory}

NEW MESSAGE: "${incomingMessage.text || '[The user sent media]'}"

Respond as ${character} would in the Seinfeld TV show. Stay in character. Keep it under ${profile.avgWords + 10} words.
Be natural and conversational. Reference the conversation context. ${profile.exclamation > 0.3 ? 'Show emotion!' : 'Stay cool.'}

Response:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.85, // High for personality variation
    });
    
    return response.choices[0].message.content || "...";
  } catch (error) {
    console.error(`Error generating ${character} response:`, error);
    // Fallback to catchphrase
    return relevantQuotes[0] || "Yeah...";
  }
}

/**
 * Cloud Function: Seinfeld Agent Auto-Response
 * Triggered when a message is created in a Seinfeld Mode thread
 */
export const seinfeldAgentResponse = functions.firestore
  .document('threads/{threadId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const threadId = context.params.threadId;
    
    console.log(`[SEINFELD] 🎬 New message in thread ${threadId}`);
    console.log(`[SEINFELD] Message from: ${message.senderId}`);
    console.log(`[SEINFELD] Message text: ${message.text?.substring(0, 50)}...`);
    
    // Get thread data
    const threadDoc = await admin.firestore()
      .collection('threads')
      .doc(threadId)
      .get();
    
    if (!threadDoc.exists) {
      console.log(`[SEINFELD] ❌ Thread ${threadId} not found`);
      return null;
    }
    
    const threadData = threadDoc.data();
    console.log(`[SEINFELD] Thread data:`, {
      hasSeinfeldMode: !!threadData?.seinfeldMode,
      enabled: threadData?.seinfeldMode?.enabled,
      activeCharacters: threadData?.seinfeldMode?.activeCharacters,
      members: threadData?.members,
      type: threadData?.type,
    });
    
    // Check if Seinfeld Mode is enabled
    if (!threadData?.seinfeldMode?.enabled) {
      console.log(`[SEINFELD] ⏸️  Seinfeld Mode not enabled for thread ${threadId}`);
      return null;
    }
    
    // Don't respond to Seinfeld agents' own messages
    const senderUid = message.senderId;
    if (senderUid.startsWith('seinfeld_')) {
      console.log(`[SEINFELD] ⏭️  Skipping - message from agent ${senderUid}`);
      return null;
    }
    
    console.log(`[SEINFELD] ✅ Generating response for thread ${threadId}`);
    
    // Get last responder to avoid same character twice
    const recentMessages = await admin.firestore()
      .collection('threads')
      .doc(threadId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(2)
      .get();
    
    let lastResponder: SeinfeldCharacter | undefined;
    if (recentMessages.docs.length > 1) {
      const lastMsg = recentMessages.docs[1].data();
      if (lastMsg.senderId.startsWith('seinfeld_')) {
        lastResponder = lastMsg.senderName as SeinfeldCharacter;
      }
    }
    
    // Select which character should respond
    const responder = selectResponder(message, threadData, lastResponder);
    const responderProfile = CHARACTER_PROFILES[responder];
    
    console.log(`[SEINFELD] ${responder} will respond`);
    
    // Generate response
    const responseText = await generateSeinfeldResponse(responder, message, threadId);
    
    // Add realistic delay (1-4 seconds)
    const delay = 1000 + Math.random() * 3000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Send message as Seinfeld character
    const messageRef = admin.firestore()
      .collection('threads')
      .doc(threadId)
      .collection('messages')
      .doc();
    
    await messageRef.set({
      text: responseText,
      senderId: responderProfile.uid,
      senderName: responder,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
      media: null,
      seinfeldAgent: true, // Mark as agent message
    });
    
    // Update thread's lastMessage
    await admin.firestore()
      .collection('threads')
      .doc(threadId)
      .update({
        lastMessage: responseText,
        lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    
    console.log(`[SEINFELD] ${responder} responded: "${responseText}"`);
    
    return null;
  });

/**
 * Callable function: Enable Seinfeld Mode for a thread
 */
export const enableSeinfeldMode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { threadId, activeCharacters } = data;
  
  if (!threadId) {
    throw new functions.https.HttpsError('invalid-argument', 'threadId is required');
  }
  
  const characters = activeCharacters || ['Jerry', 'George', 'Elaine', 'Kramer'];
  
  try {
    const threadRef = admin.firestore().collection('threads').doc(threadId);
    const threadDoc = await threadRef.get();
    
    if (!threadDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Thread not found');
    }
    
    const threadData = threadDoc.data();
    const currentMembers = threadData?.members || [];
    
    // Add character UIDs to members array (if not already present)
    const characterUids = characters.map((char: SeinfeldCharacter) => `seinfeld_${char.toLowerCase()}`);
    const updatedMembers = [...new Set([...currentMembers, ...characterUids])];
    
    // If adding characters increases member count beyond 2, convert to group
    const shouldBeGroup = updatedMembers.length > 2;
    
    const updateData: any = {
      members: updatedMembers,
      seinfeldMode: {
        enabled: true,
        activeCharacters: characters,
        enabledAt: admin.firestore.FieldValue.serverTimestamp(),
        enabledBy: context.auth.uid,
      },
    };
    
    // Convert to group if needed
    if (shouldBeGroup && threadData?.type !== 'group') {
      updateData.type = 'group';
      // Add a default group name if none exists
      if (!threadData?.name) {
        updateData.name = `Chat with ${characters.join(', ')}`;
      }
    }
    
    await threadRef.update(updateData);
    
    console.log(`[SEINFELD] Mode enabled for thread ${threadId} with ${characters.length} characters`);
    console.log(`[SEINFELD] Updated members: ${updatedMembers.join(', ')}`);
    console.log(`[SEINFELD] Thread type: ${updateData.type || threadData?.type || 'direct'}`);
    
    // Send welcome message from Jerry
    const welcomeRef = admin.firestore()
      .collection('threads')
      .doc(threadId)
      .collection('messages')
      .doc();
    
    await welcomeRef.set({
      text: "Hey! So we're all in this chat now? What's the deal with that?",
      senderId: 'seinfeld_jerry',
      senderName: 'Jerry',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
      media: null,
      seinfeldAgent: true,
    });
    
    return { success: true, message: 'Seinfeld Mode enabled!' };
  } catch (error: any) {
    console.error('[SEINFELD] Error enabling mode:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Callable function: Disable Seinfeld Mode for a thread
 */
export const disableSeinfeldMode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { threadId } = data;
  
  if (!threadId) {
    throw new functions.https.HttpsError('invalid-argument', 'threadId is required');
  }
  
  try {
    await admin.firestore()
      .collection('threads')
      .doc(threadId)
      .update({
        'seinfeldMode.enabled': false,
        'seinfeldMode.disabledAt': admin.firestore.FieldValue.serverTimestamp(),
      });
    
    console.log(`[SEINFELD] Mode disabled for thread ${threadId}`);
    
    return { success: true, message: 'Seinfeld Mode disabled' };
  } catch (error: any) {
    console.error('[SEINFELD] Error disabling mode:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

