import { getFirestore } from 'firebase-admin/firestore';
import OpenAI from 'openai';
import * as admin from 'firebase-admin';
import { getRelevantContext } from './embeddings';

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
 * Proactive Assistant: Detects scheduling intent and suggests times
 * Can be triggered on message create or called manually
 */
export const detectSchedulingIntent = async (data: any, context: any) => {
  const openai = getOpenAI();
  const { threadId, limit = 20 } = data || {};

  if (!threadId) {
    throw new Error('threadId is required');
  }

  try {
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

    // RAG: Get relevant historical context for scheduling
    let contextSection = '';
    try {
      const relevantMessages = await getRelevantContext(
        'schedule meeting availability calendar time',
        threadId,
        3
      );
      
      if (relevantMessages.length > 0) {
        contextSection = '\n\nRelevant historical context:\n' + 
          relevantMessages.map(m => `- ${m.text}`).join('\n');
      }
    } catch (error) {
      console.error('Error fetching RAG context:', error);
      // Continue without context if it fails
    }

    const conversationText = JSON.stringify(messages).slice(0, 4000);

    // Prompt to detect scheduling intent
    const prompt = `Analyze this conversation to detect if there's a scheduling or meeting intent.

Look for:
- Explicit requests to schedule, meet, sync, have a call
- Date/time mentions or questions about availability
- Need for coordination between people

If scheduling intent is detected, extract:
- participants: who needs to meet
- constraints: any time constraints, preferences, or blockers mentioned
- urgency: is this urgent or flexible
- suggestedTimes: based on context, suggest 2-3 specific time options (with day of week and time)

Return JSON:
{
  "hasIntent": true/false,
  "participants": ["person1", "person2"],
  "constraints": ["constraint1", "constraint2"],
  "urgency": "high/medium/low",
  "suggestedTimes": ["Tuesday at 2pm EST", "Wednesday at 10am EST", "Thursday at 3pm EST"],
  "reasoning": "brief explanation"
}${contextSection}

Conversation:
${conversationText}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 300,
    });

    const result = JSON.parse(
      response.choices[0].message?.content ?? '{"hasIntent":false}'
    );

    if (result.hasIntent) {
      // Store the suggestion
      await db.collection(`threads/${threadId}/suggestions`).add({
        type: 'meeting_scheduler',
        ...result,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return result;
  } catch (error) {
    console.error('Error detecting scheduling intent:', error);
    throw new Error('Failed to detect scheduling intent');
  }
};

/**
 * Generate meeting time suggestions based on constraints
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

