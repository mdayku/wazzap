import { getFirestore } from 'firebase-admin/firestore';
import OpenAI from 'openai';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// Lazy initialize OpenAI
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

interface SchedulingIntent {
  hasSchedulingIntent: boolean;
  eventDetails?: {
    summary: string;
    description?: string;
    location?: string;
    startTime: string; // ISO 8601
    endTime: string; // ISO 8601
    attendees: string[]; // email addresses
    confidence: number; // 0-1
  };
  suggestedMessage?: string; // Message to send to the user
}

/**
 * Analyze messages for scheduling intent
 * This is called by the proactive assistant
 */
export async function detectSchedulingIntent(
  messages: Array<{ sender: string; text: string; senderName?: string }>,
  threadParticipants: Array<{ id: string; email?: string; displayName?: string }>
): Promise<SchedulingIntent> {
  const openai = getOpenAI();

  try {
    // Build context about participants
    const participantsContext = threadParticipants
      .map(p => `- ${p.displayName || 'User'} (${p.email || 'no email'})`)
      .join('\n');

    // Build conversation context
    const conversationContext = messages
      .map(m => `${m.senderName || m.sender}: ${m.text}`)
      .join('\n');

    const prompt = `You are an AI assistant that detects scheduling intent in conversations and extracts event details.

Analyze the following conversation and determine if there's a clear intent to schedule a meeting or event.

PARTICIPANTS:
${participantsContext}

CONVERSATION:
${conversationContext}

CURRENT TIME: ${new Date().toISOString()}

If there is scheduling intent, extract:
1. Event title/summary
2. Start time (convert to ISO 8601 format)
3. End time (convert to ISO 8601 format, default to 1 hour if not specified)
4. Location (if mentioned, can be physical or virtual like "Zoom")
5. Attendees (use participant emails from the conversation)
6. Description (optional context)
7. Confidence (0-1, how confident you are this is a scheduling request)

Respond in JSON format:
{
  "hasSchedulingIntent": boolean,
  "eventDetails": {
    "summary": "string",
    "description": "string (optional)",
    "location": "string (optional)",
    "startTime": "ISO 8601 string",
    "endTime": "ISO 8601 string",
    "attendees": ["email1", "email2"],
    "confidence": 0.0-1.0
  },
  "suggestedMessage": "A friendly message to send to the user confirming the event details"
}

Only return hasSchedulingIntent: true if:
- There's a clear date/time mentioned or implied
- Multiple people are involved (meeting/event context)
- Confidence is at least 0.7

If no scheduling intent, return: { "hasSchedulingIntent": false }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    return result as SchedulingIntent;
  } catch (error) {
    console.error('Error detecting scheduling intent:', error);
    return { hasSchedulingIntent: false };
  }
}

/**
 * Create a calendar event suggestion message
 * This is called when the AI detects scheduling intent
 */
export const suggestCalendarEvent = async (data: any, context: any) => {
  const { threadId, messageLimit = 10 } = data || {};

  if (!threadId) {
    throw new Error('threadId is required');
  }

  try {
    // Fetch recent messages
    const messagesSnap = await db
      .collection(`threads/${threadId}/messages`)
      .orderBy('createdAt', 'desc')
      .limit(messageLimit)
      .get();

    const messages = messagesSnap.docs.reverse().map(d => {
      const data = d.data();
      return {
        sender: data.senderId,
        text: data.text,
        senderName: data.senderName,
      };
    });

    if (messages.length === 0) {
      return { hasSchedulingIntent: false };
    }

    // Get thread participants
    const threadDoc = await db.collection('threads').doc(threadId).get();
    const threadData = threadDoc.data();
    
    if (!threadData) {
      throw new Error('Thread not found');
    }

    const participantIds = threadData.participants || [];
    const participants = [];

    // Fetch participant details
    for (const participantId of participantIds) {
      const userDoc = await db.collection('users').doc(participantId).get();
      const userData = userDoc.data();
      if (userData) {
        participants.push({
          id: participantId,
          email: userData.email,
          displayName: userData.displayName,
        });
      }
    }

    // Detect scheduling intent
    const intent = await detectSchedulingIntent(messages, participants);

    if (intent.hasSchedulingIntent && intent.eventDetails) {
      // Store the calendar suggestion in Firestore
      await db.collection(`threads/${threadId}/calendarSuggestions`).add({
        ...intent.eventDetails,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending', // pending, accepted, rejected
      });
    }

    return intent;
  } catch (error: any) {
    console.error('Error suggesting calendar event:', error);
    throw new Error(error.message || 'Failed to suggest calendar event');
  }
};

/**
 * Parse natural language time into ISO 8601
 * Helper function for testing
 */
export function parseNaturalTime(naturalTime: string, referenceDate: Date = new Date()): string {
  // This is a simple implementation - in production, you'd use a library like chrono-node
  // For now, we'll handle common patterns
  
  const lower = naturalTime.toLowerCase();
  const now = referenceDate;
  
  // Today at X
  if (lower.includes('today')) {
    const timeMatch = lower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const meridiem = timeMatch[3];
      
      if (meridiem?.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (meridiem?.toLowerCase() === 'am' && hours === 12) hours = 0;
      
      const date = new Date(now);
      date.setHours(hours, minutes, 0, 0);
      return date.toISOString();
    }
  }
  
  // Tomorrow at X
  if (lower.includes('tomorrow')) {
    const timeMatch = lower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const meridiem = timeMatch[3];
      
      if (meridiem?.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (meridiem?.toLowerCase() === 'am' && hours === 12) hours = 0;
      
      const date = new Date(now);
      date.setDate(date.getDate() + 1);
      date.setHours(hours, minutes, 0, 0);
      return date.toISOString();
    }
  }
  
  // Default: return current time
  return now.toISOString();
}

