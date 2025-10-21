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

export const summarizeThread = async (data: any, context: any) => {
  const openai = getOpenAI();
  const { threadId, limit = 50 } = data || {};
  
  if (!threadId) {
    throw new Error('threadId is required');
  }

  try {
    // Fetch recent messages
    const snap = await db
      .collection(`threads/${threadId}/messages`)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const msgs = snap.docs
      .reverse()
      .map(d => {
        const data = d.data();
        return {
          sender: data.senderId,
          text: data.text,
          timestamp: data.createdAt,
        };
      });

    if (msgs.length === 0) {
      return { text: 'No messages to summarize' };
    }

    // Fetch user display names for all unique senders
    const uniqueSenderIds = [...new Set(msgs.map(m => m.sender))];
    const userCache: Record<string, string> = {};
    
    await Promise.all(
      uniqueSenderIds.map(async (senderId) => {
        try {
          const userDoc = await db.collection('users').doc(senderId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userCache[senderId] = userData?.displayName || userData?.email || senderId;
          } else {
            userCache[senderId] = senderId; // Fallback to ID if user not found
          }
        } catch (error) {
          console.error(`Error fetching user ${senderId}:`, error);
          userCache[senderId] = senderId;
        }
      })
    );

    // Replace sender IDs with display names
    const msgsWithNames = msgs.map(m => ({
      sender: userCache[m.sender] || m.sender,
      text: m.text,
      timestamp: m.timestamp,
    }));

    // Create prompt for summarization (using messages with display names)
    const messagesText = JSON.stringify(msgsWithNames).slice(0, 6000);
    const prompt = `Summarize the following conversation for a remote team. Include:
- Key discussion points
- Important decisions made
- Action items with assignees if mentioned
- Any blockers or concerns raised

Keep the summary concise but informative.

Messages:
${messagesText}`;

    // Call OpenAI
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const text = res.choices[0].message?.content ?? 'Unable to generate summary';

    // Cache the summary
    const summaryData = {
      text,
      range: {
        from: msgs[0].timestamp,
        to: msgs[msgs.length - 1].timestamp,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection(`threads/${threadId}/summaries`).add(summaryData);

    return { 
      summaryId: ref.id,
      text 
    };
  } catch (error) {
    console.error('Error in summarizeThread:', error);
    throw new Error('Failed to generate summary');
  }
};

export const extractAI = async (data: any, context: any) => {
  const openai = getOpenAI();
  const { threadId, limit = 50 } = data || {};
  
  if (!threadId) {
    throw new Error('threadId is required');
  }

  try {
    // Fetch recent messages
    const snap = await db
      .collection(`threads/${threadId}/messages`)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const msgs = snap.docs
      .reverse()
      .map(d => {
        const data = d.data();
        return {
          sender: data.senderId,
          text: data.text,
          timestamp: data.createdAt,
        };
      });

    if (msgs.length === 0) {
      return { actionItems: [], decisions: [] };
    }

    // Fetch user display names for all unique senders
    const uniqueSenderIds = [...new Set(msgs.map(m => m.sender))];
    const userCache: Record<string, string> = {};
    
    await Promise.all(
      uniqueSenderIds.map(async (senderId) => {
        try {
          const userDoc = await db.collection('users').doc(senderId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userCache[senderId] = userData?.displayName || userData?.email || senderId;
          } else {
            userCache[senderId] = senderId;
          }
        } catch (error) {
          console.error(`Error fetching user ${senderId}:`, error);
          userCache[senderId] = senderId;
        }
      })
    );

    // Replace sender IDs with display names
    const msgsWithNames = msgs.map(m => ({
      sender: userCache[m.sender] || m.sender,
      text: m.text,
      timestamp: m.timestamp,
    }));

    // Create prompt for extraction (using messages with display names)
    const messagesText = JSON.stringify(msgsWithNames).slice(0, 6000);
    const prompt = `Extract action items and decisions from this conversation.

For action items, identify:
- task: what needs to be done
- assignee: who is responsible (if mentioned)
- due: when it's due (if mentioned)

For decisions, identify:
- summary: what was decided
- owner: who made or owns the decision (if clear)
- decidedAt: approximate context

Return JSON with this structure:
{
  "actionItems": [{"task": "...", "assignee": "...", "due": "..."}],
  "decisions": [{"summary": "...", "owner": "..."}]
}

Messages:
${messagesText}`;

    // Call OpenAI
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const parsed = JSON.parse(
      res.choices[0].message?.content ?? '{"actionItems":[],"decisions":[]}'
    );

    // Store the extraction
    await db.collection(`threads/${threadId}/summaries`).add({
      actionItems: parsed.actionItems || [],
      decisions: parsed.decisions || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return parsed;
  } catch (error) {
    console.error('Error in extractAI:', error);
    throw new Error('Failed to extract action items and decisions');
  }
};

