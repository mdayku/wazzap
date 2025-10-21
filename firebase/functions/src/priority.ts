import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';
import { generateEmbedding } from './embeddings';

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

export const onMessageCreate = async (snap: any, context: any) => {
  const message = snap.data();
  const { threadId } = context.params;
  const openai = getOpenAI();

  try {
    // Create prompt for priority classification and decision extraction
    const messageText = JSON.stringify({
      text: message.text,
      sender: message.senderId,
    }).slice(0, 2000);

    const prompt = `Analyze this message from a team chat and:
1. Classify priority as "high" or "normal"
   - HIGH priority: urgent matters, blocking issues, time-sensitive decisions, direct questions needing immediate response, critical announcements
   - NORMAL priority: general discussion, updates, non-urgent questions, casual conversation

2. Extract any decisions made in this message
   - Look for commitments, choices made, directions set, approvals given

Return JSON:
{
  "priority": "high" or "normal",
  "decisions": [{"summary": "brief description", "owner": "person if identifiable"}]
}

Message: ${messageText}`;

    // Call OpenAI for classification
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 200,
    });

    const result = JSON.parse(
      res.choices[0].message?.content ?? '{"priority":"normal","decisions":[]}'
    );

    // Update message with priority
    await snap.ref.update({ 
      priority: result.priority || 'normal' 
    });

    // Store decisions if any
    if (result.decisions && result.decisions.length > 0) {
      const batch = db.batch();
      
      result.decisions.forEach((decision: any) => {
        const ref = db.collection(`threads/${threadId}/decisions`).doc();
        batch.set(ref, {
          summary: decision.summary,
          owner: decision.owner || null,
          messageId: snap.id,
          decidedAt: message.createdAt,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
    }

    console.log(`Message ${snap.id} classified as ${result.priority}`);
    
    // Generate embedding for semantic search (non-blocking)
    if (message.text && message.text.trim().length > 0) {
      try {
        await generateEmbedding(snap.id, threadId, message.text);
        console.log(`Embedding generated for message ${snap.id}`);
      } catch (embeddingError) {
        console.error('Error generating embedding:', embeddingError);
        // Don't fail the whole function if embedding generation fails
      }
    }
  } catch (error) {
    console.error('Error in onMessageCreate:', error);
    // Don't throw - we don't want to fail message delivery if AI fails
  }
};

