import { getFirestore } from 'firebase-admin/firestore';
import OpenAI from 'openai';
import * as admin from 'firebase-admin';
import { getRelevantContext } from './embeddings';
import { detectSchedulingIntent } from './calendar';

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

/**
 * Proactive Assistant: Analyzes conversation and generates contextual suggestions
 * Supports multi-modal input (text, audio transcripts, image analysis)
 * Uses RAG for historical context and learns from user feedback
 */
export const analyzeThreadContext = async (data: any, context: any) => {
  const openai = getOpenAI();
  const { threadId, limit = 20 } = data || {};

  if (!threadId) {
    throw new Error('threadId is required');
  }

  try {
    // Check for recent dismissed or active suggestions (within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentSuggestionsSnap = await db
      .collection(`threads/${threadId}/suggestions`)
      .where('createdAt', '>=', tenMinutesAgo)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    // If there's an active suggestion or recently dismissed one, don't create a new one
    const hasRecentSuggestion = recentSuggestionsSnap.docs.some(doc => {
      const data = doc.data();
      return data.status === 'active' || data.status === 'dismissed';
    });

    if (hasRecentSuggestion) {
      return { hasIntent: false, reason: 'Recent suggestion exists' };
    }

    // Fetch recent messages for context
    const messagesSnap = await db
      .collection(`threads/${threadId}/messages`)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const messages = messagesSnap.docs
      .reverse()
      .map(d => {
        const data = d.data();
        return {
          sender: data.senderId,
          text: data.text,
        };
      });

    if (messages.length === 0) {
      return { hasIntent: false };
    }

    // RAG: Get relevant historical context from multiple sources
    let contextSection = '';
    
    // 1. Thread-specific context (what's been discussed in THIS chat)
    try {
      const threadContext = await getRelevantContext(
        'important context decisions actions questions',
        threadId,
        3  // Reduced to 3 to make room for other contexts
      );
      
      if (threadContext.length > 0) {
        contextSection += '\n\nThread History:\n' + 
          threadContext.map(m => `- ${m.text}`).join('\n');
      }
    } catch (error) {
      console.error('Error fetching thread context:', error);
    }
    
    // 2. User-specific context (what each participant has said across ALL chats)
    try {
      // Get unique sender IDs from recent messages
      const senderIds = [...new Set(messages.map(m => m.sender))];
      
      // For each unique user, get their cross-chat context
      for (const senderId of senderIds.slice(0, 3)) { // Limit to 3 users to avoid too much data
        const userContext = await getRelevantContext(
          'important patterns preferences communication style',
          '', // Empty threadId = search ALL threads
          2,  // Top 2 messages per user
          senderId // Filter by this specific user
        );
        
        if (userContext.length > 0) {
          contextSection += `\n\nUser ${senderId.slice(0, 8)} (cross-chat history):\n` + 
            userContext.map(m => `- ${m.text}`).join('\n');
        }
      }
    } catch (error) {
      console.error('Error fetching user context:', error);
    }

    // Fetch user feedback history to learn preferences
    let feedbackContext = '';
    try {
      const feedbackSnap = await db
        .collection(`threads/${threadId}/suggestions`)
        .where('feedback', '!=', null)
        .orderBy('feedback', 'desc')
        .limit(10)
        .get();
      
      if (!feedbackSnap.empty) {
        const positiveSuggestions = feedbackSnap.docs
          .filter(d => d.data().feedback === 'positive')
          .map(d => d.data().type);
        
        if (positiveSuggestions.length > 0) {
          feedbackContext = `\n\nUser Preferences (based on past feedback): Users in this thread liked suggestions about: ${[...new Set(positiveSuggestions)].join(', ')}`;
        }
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }

    const conversationText = JSON.stringify(messages).slice(0, 4000);

    // Enhanced prompt for multi-purpose proactive suggestions
    const prompt = `You are a proactive AI assistant analyzing a team conversation. Generate helpful, contextual suggestions.

Analyze for:
1. **Scheduling needs** - meetings, calls, syncs
2. **Unanswered questions** - questions that need follow-up
3. **Action items** - tasks that need assignment or tracking
4. **Draft messages** - helpful replies based on context
5. **Information gaps** - missing context that could help the discussion
6. **Decision points** - moments where a decision is needed

Return JSON with the MOST helpful suggestion:
{
  "hasSuggestion": true/false,
  "type": "schedule|question_followup|action_reminder|draft_message|info_gap|decision_prompt",
  "priority": "high|medium|low",
  "title": "Short title for the suggestion",
  "description": "What the assistant noticed",
  "action": "Specific suggested action or draft text",
  "reasoning": "Why this suggestion is helpful"
}${contextSection}${feedbackContext}

Recent Conversation:
${conversationText}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 400,
    });

    const result = JSON.parse(
      response.choices[0].message?.content ?? '{"hasSuggestion":false}'
    );

    if (result.hasSuggestion) {
      // If this is a scheduling suggestion, also detect calendar event details
      let calendarEventId = null;
      if (result.type === 'schedule') {
        try {
          // Get thread participants for calendar detection
          const threadDoc = await db.collection('threads').doc(threadId).get();
          const threadData = threadDoc.data();
          
          if (threadData) {
            const participantIds = threadData.participants || [];
            const participants: Array<{ id: string; email?: string; displayName?: string }> = [];

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

            // Detect scheduling intent with detailed event extraction
            const messagesWithNames = messages.map(m => ({
              sender: m.sender,
              text: m.text,
              senderName: participants.find(p => p.id === m.sender)?.displayName,
            }));

            const schedulingIntent = await detectSchedulingIntent(messagesWithNames, participants);
            
            if (schedulingIntent.hasSchedulingIntent && schedulingIntent.eventDetails) {
              // Store the calendar event suggestion
              const calendarRef = await db.collection(`threads/${threadId}/calendarSuggestions`).add({
                ...schedulingIntent.eventDetails,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pending', // pending, accepted, rejected
              });
              calendarEventId = calendarRef.id;
            }
          }
        } catch (error) {
          console.error('Error detecting calendar event:', error);
          // Continue without calendar event - don't fail the whole suggestion
        }
      }

      // Store the suggestion for display in UI
      const suggestionRef = await db.collection(`threads/${threadId}/suggestions`).add({
        ...result,
        calendarEventId, // Link to calendar event if this is a scheduling suggestion
        status: 'active', // active, dismissed, accepted
        feedback: null, // null, 'positive', 'negative'
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      return {
        ...result,
        suggestionId: suggestionRef.id,
        calendarEventId,
      };
    }

    return result;
  } catch (error) {
    console.error('Error detecting scheduling intent:', error);
    throw new Error('Failed to detect scheduling intent');
  }
};

/**
 * Submit feedback on a proactive suggestion
 * Helps the AI learn what suggestions are helpful
 */
export const submitSuggestionFeedback = async (data: any, context: any) => {
  const { threadId, suggestionId, feedback, userId } = data || {};

  if (!threadId || !suggestionId || !feedback) {
    throw new Error('threadId, suggestionId, and feedback are required');
  }

  try {
    await db.collection(`threads/${threadId}/suggestions`).doc(suggestionId).update({
      feedback, // 'positive' or 'negative'
      feedbackBy: userId,
      feedbackAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw new Error('Failed to submit feedback');
  }
};

/**
 * Dismiss a proactive suggestion
 */
export const dismissSuggestion = async (data: any, context: any) => {
  const { threadId, suggestionId } = data || {};

  if (!threadId || !suggestionId) {
    throw new Error('threadId and suggestionId are required');
  }

  try {
    await db.collection(`threads/${threadId}/suggestions`).doc(suggestionId).update({
      status: 'dismissed',
      dismissedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error dismissing suggestion:', error);
    throw new Error('Failed to dismiss suggestion');
  }
};

/**
 * Generate meeting time suggestions based on constraints
 * (Legacy function - kept for backwards compatibility)
 */
export const suggestMeetingTimes = async (data: any, context: any) => {
  const openai = getOpenAI();
  const { threadId, participants = [], constraints = [] } = data || {};

  if (!threadId) {
    throw new Error('threadId is required');
  }

  try {
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    const prompt = `You are a scheduling assistant. Generate 3 good meeting time suggestions.

Current context:
- Today is ${dayOfWeek}, ${date}
- Participants: ${participants.join(', ') || 'team members'}
- Constraints: ${constraints.join('; ') || 'none specified'}

Generate 3 specific time suggestions in the next 3-5 business days.
Consider:
- Business hours (9am-5pm in typical time zones)
- Avoid Mondays early and Fridays late
- Space them across different days
- Be specific with day and time

Return JSON:
{
  "suggestions": [
    {"time": "Tuesday, Jan 16 at 2:00pm EST", "reasoning": "mid-week afternoon"},
    {"time": "Wednesday, Jan 17 at 10:00am EST", "reasoning": "morning slot"},
    {"time": "Thursday, Jan 18 at 3:00pm EST", "reasoning": "afternoon alternative"}
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const result = JSON.parse(
      response.choices[0].message?.content ?? '{"suggestions":[]}'
    );

    return result;
  } catch (error) {
    console.error('Error suggesting meeting times:', error);
    throw new Error('Failed to suggest meeting times');
  }
};

