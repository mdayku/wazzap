# 🤖 AI Chatbot Implementation Scope

## Overview
Add a universal AI assistant that appears in every user's contact list and can be messaged like any other user.

---

## Option 2: Advanced Implementation (2 hours)

### Features
- AI assistant visible in all users' contact lists
- Can start 1:1 chats with AI like any user
- AI responds intelligently to questions
- Can be @mentioned in group chats (future)
- Remembers conversation context
- Personalized to each user

---

## Implementation Plan

### Phase 1: AI User Setup (20 min)

**1.1 Create System User (5 min)**
- Sign up special account: `ai-assistant@messageai.system`
- Store UID in Firebase Functions config
- Add system flag to user document

**1.2 User Document Structure:**
```typescript
{
  uid: "AI_USER_UID",
  email: "ai-assistant@messageai.system",
  displayName: "AI Assistant",
  photoURL: "https://...", // Robot avatar
  isSystem: true,
  isAI: true,
  createdAt: serverTimestamp()
}
```

**1.3 Cloud Function Config:**
```bash
firebase functions:config:set ai.uid="AI_USER_UID"
```

---

### Phase 2: UI Updates (30 min)

**2.1 NewChatScreen Updates (10 min)**
- Always show AI Assistant at top of user list
- Special styling (robot emoji 🤖, blue background)
- Filter out from normal user results
- Pin to top with separator

**Location:** `src/screens/NewChatScreen.tsx`

**Changes:**
```typescript
// Add AI user to top of list
const AI_ASSISTANT = {
  uid: 'HARDCODED_AI_UID', // Or fetch from config
  displayName: '🤖 AI Assistant',
  email: 'AI-powered helper',
  isAI: true
};

// In render:
<FlatList
  ListHeaderComponent={() => (
    <TouchableOpacity onPress={() => createThread(AI_ASSISTANT)}>
      {/* Special AI user tile */}
    </TouchableOpacity>
  )}
  data={filteredUsers}
  ...
/>
```

**2.2 ChatScreen Updates (10 min)**
- Detect if chatting with AI user
- Show special header ("AI Assistant" with robot icon)
- Show "AI is typing..." when waiting
- Style AI messages differently (blue bubble?)

**Location:** `src/screens/ChatScreen.tsx`

**2.3 ThreadsScreen Updates (10 min)**
- Show robot icon for AI threads
- Mark as "AI Chat" in thread list
- Pin AI chats to top (optional)

---

### Phase 3: AI Response Logic (45 min)

**3.1 Message Trigger Function (15 min)**

**Location:** `firebase/functions/src/ai-chat.ts`

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import OpenAI from 'openai';

const AI_USER_UID = functions.config().ai.uid;

export const onAIChatMessage = onDocumentCreated(
  'threads/{threadId}/messages/{messageId}',
  async (event) => {
    const message = event.data?.data();
    const { threadId } = event.params;
    
    if (!message) return;
    
    // Check if this thread includes AI user
    const threadDoc = await getFirestore()
      .collection('threads')
      .doc(threadId)
      .get();
    
    const threadData = threadDoc.data();
    if (!threadData?.members.includes(AI_USER_UID)) {
      return; // Not an AI chat
    }
    
    // Don't respond to AI's own messages
    if (message.senderId === AI_USER_UID) {
      return;
    }
    
    // Generate AI response
    await generateAIResponse(threadId, message);
  }
);
```

**3.2 AI Response Generation (20 min)**

```typescript
async function generateAIResponse(threadId: string, userMessage: any) {
  const db = getFirestore();
  
  // Get conversation history (last 20 messages)
  const messagesSnapshot = await db
    .collection(`threads/${threadId}/messages`)
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();
  
  const history = messagesSnapshot.docs
    .reverse()
    .map(doc => ({
      role: doc.data().senderId === AI_USER_UID ? 'assistant' : 'user',
      content: doc.data().text
    }));
  
  // Call OpenAI
  const openai = new OpenAI({ apiKey: functions.config().openai.key });
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a helpful AI assistant for a team messaging app called MessageAI. 
You help users with:
- Summarizing conversations
- Answering questions
- Organizing action items
- Scheduling meetings
- Finding information

Be concise, friendly, and professional. Keep responses under 200 words unless asked for detail.`
      },
      ...history,
      {
        role: 'user',
        content: userMessage.text
      }
    ],
    max_tokens: 300,
    temperature: 0.7
  });
  
  const aiResponse = completion.choices[0].message.content;
  
  // Send AI message
  await db.collection(`threads/${threadId}/messages`).add({
    senderId: AI_USER_UID,
    text: aiResponse,
    timestamp: FieldValue.serverTimestamp(),
    status: 'sent',
    type: 'text'
  });
  
  // Update thread's lastMessage
  await db.collection('threads').doc(threadId).update({
    lastMessage: {
      text: aiResponse,
      senderId: AI_USER_UID,
      timestamp: FieldValue.serverTimestamp()
    }
  });
}
```

**3.3 Smart Capabilities (10 min)**

Add special command detection:

```typescript
// In generateAIResponse, before calling OpenAI:

const text = userMessage.text.toLowerCase();

// Summarize command
if (text.includes('summarize') || text.includes('summary')) {
  const summary = await callExistingSummarizeFunction(threadId);
  return sendAIMessage(threadId, `Here's a summary:\n\n${summary}`);
}

// Search command
if (text.startsWith('search ') || text.startsWith('find ')) {
  const query = text.replace(/^(search|find)\s+/, '');
  const results = await callExistingSearchFunction(threadId, query);
  return sendAIMessage(threadId, formatSearchResults(results));
}

// Decisions command
if (text.includes('decision') || text.includes('what did we decide')) {
  const decisions = await getDecisions(threadId);
  return sendAIMessage(threadId, formatDecisions(decisions));
}
```

---

### Phase 4: Testing & Polish (25 min)

**4.1 Test Scenarios (15 min)**
- [ ] AI user appears in contact list
- [ ] Can create chat with AI
- [ ] AI responds to messages
- [ ] AI uses conversation context
- [ ] AI handles special commands
- [ ] Multiple users can chat with AI separately
- [ ] AI doesn't respond to own messages
- [ ] Works offline (queues messages)

**4.2 UI Polish (10 min)**
- Loading indicator while AI "types"
- Error handling if AI fails
- Retry button for failed AI messages
- Settings to disable AI chat (optional)

---

## File Changes Summary

### New Files (1)
- `firebase/functions/src/ai-chat.ts` - AI response logic

### Modified Files (4)
- `src/screens/NewChatScreen.tsx` - Show AI user
- `src/screens/ChatScreen.tsx` - AI chat UI
- `src/screens/ThreadsScreen.tsx` - AI thread styling
- `firebase/functions/src/index.ts` - Export AI function

### Configuration
- Firebase Functions config: `AI_USER_UID`
- Create AI user account manually
- Deploy new Cloud Function

---

## Cost Estimate

**Per AI conversation (20 messages back and forth):**
- OpenAI API: ~$0.01-0.02
- Firebase Functions: ~$0.0001

**Monthly (100 active users, 10 AI chats each):**
- OpenAI: $10-20
- Firebase: $1-2
- **Total: $11-22/month**

---

## Implementation Time

| Phase | Time | Dependencies |
|-------|------|--------------|
| 1. AI User Setup | 20 min | Firebase Console |
| 2. UI Updates | 30 min | Phase 1 complete |
| 3. AI Logic | 45 min | Phase 1 complete |
| 4. Testing | 25 min | All phases |
| **Total** | **2 hours** | - |

---

## Future Enhancements

### V2 Features (Later)
- [ ] @mention AI in group chats
- [ ] AI can tag team members
- [ ] AI learns from user preferences
- [ ] Voice message support
- [ ] Multi-language support
- [ ] Custom AI personality per team
- [ ] AI can create reminders
- [ ] AI can search external knowledge base

### V3 Features (Much Later)
- [ ] AI-powered meeting scheduler (full integration)
- [ ] AI suggests action items proactively
- [ ] AI detects conflicts/issues
- [ ] AI generates reports
- [ ] AI sentiment analysis
- [ ] AI translation between users

---

## Decision: When to Build?

**Build NOW if:**
- Core messaging is working ✅
- You want a "wow" demo feature
- You have 2 hours available

**Build LATER if:**
- Core features still need testing
- Limited time before submission
- Want to focus on stability first

**Recommendation:** Build after core messaging is verified working! 

---

## Alternative: Quick "Ask AI" Button

Instead of full chatbot, add a button to every chat:

**Implementation: 30 min**
- Add floating "Ask AI" button in ChatScreen
- Tap → Shows modal with AI suggestions
- No separate user needed
- Uses existing Cloud Functions
- Simpler, faster, less complex

**Trade-off:**
- Less interactive
- No conversation history
- But easier to build
- And less error-prone

---

*Priority: DEFER until after core testing complete*

