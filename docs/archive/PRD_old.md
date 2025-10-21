# MessageAI - Product Requirements Document

## Executive Summary

MessageAI is a real-time messaging application designed for remote software teams, combining reliable chat functionality with AI-powered features to reduce information overload and improve team coordination.

## Target Users

**Primary Persona:** Remote software teams (engineers, product managers, designers)

**User Needs:**
1. Reliable real-time communication across time zones
2. Reduce thread overload without reading everything
3. Track decisions and action items from conversations
4. Find critical information quickly
5. Identify urgent messages that need immediate attention

## Product Goals

### MVP (24 hours)
Deliver a functional messaging app with:
- ✅ Email/password authentication
- ✅ 1:1 and group chat support
- ✅ Real-time message delivery
- ✅ Optimistic sends with offline queue
- ✅ Message persistence across restarts
- ✅ Online/offline presence indicators
- ✅ Typing indicators
- ✅ Read receipts (per-user)
- ✅ Foreground push notifications
- ✅ Message status tracking (sending/sent/delivered/read)

### Early Submission (4 days)
Add rich media and initial AI:
- ✅ Image upload and display
- ✅ User profiles with avatars
- ✅ Group management (create, add/remove members)
- ✅ Basic client-side search
- ✅ AI thread summarization
- ✅ Background push notifications

### Final Submission (7 days)
Complete AI feature set:
- ✅ Thread summarization
- ✅ Action item extraction
- ✅ Priority message detection
- ✅ Decision tracking
- ✅ Smart semantic search with embeddings
- ✅ Proactive meeting scheduler assistant

## Core Features

### 1. Authentication & User Management
- Email/password authentication via Firebase
- User profiles with display name and avatar
- Presence tracking (online/last seen)

### 2. Real-Time Messaging
- Instant message delivery via Firestore listeners
- Optimistic UI updates
- Message status indicators
- Typing indicators
- Read receipts

### 3. Threads
- 1:1 direct messages
- Group chats (3+ members)
- Thread list with last message preview
- Unread indicators

### 4. Media
- Image upload via Firebase Storage
- Image display in messages
- Upload progress indicators

### 5. Offline Support
- Local message queue when offline
- Automatic flush when reconnected
- Firestore offline persistence
- No data loss

### 6. Push Notifications
- Foreground and background support
- Different channels for high-priority messages
- Badge counts for unread messages
- Tap to open specific thread

## AI Features

### 1. Thread Summarization
**Purpose:** Help users catch up on long conversations quickly

**Implementation:**
- On-demand summarization via "Summarize" button
- Cloud Function fetches last N messages
- OpenAI GPT-4o-mini generates concise summary
- Cached in Firestore for instant re-access

**User Flow:**
1. User taps "Summarize" button in chat header
2. Loading indicator appears
3. Summary displays in modal with key points, decisions, action items

### 2. Action Item Extraction
**Purpose:** Automatically capture tasks and assignments from chat

**Implementation:**
- Cloud Function analyzes conversation
- Extracts tasks with assignees and due dates
- Stores in Firestore subcollection
- UI displays as actionable checklist

**Output Format:**
```json
{
  "task": "Update API documentation",
  "assignee": "Alice",
  "due": "Friday"
}
```

### 3. Priority Message Detection
**Purpose:** Highlight urgent messages that need immediate attention

**Implementation:**
- Firestore trigger on new message
- LLM classifies as high/normal priority
- High priority: urgent issues, blocking problems, direct questions
- Visual indicator (red border + badge)
- Different push notification channel

**Criteria for High Priority:**
- Time-sensitive decisions
- Blocking issues
- Direct questions requiring response
- Critical announcements
- Keywords: "urgent", "blocking", "asap", "critical"

### 4. Decision Tracking
**Purpose:** Maintain searchable log of team decisions

**Implementation:**
- Extracted automatically by priority function
- Stores decisions with context and timestamp
- Links back to original message
- Queryable decision history

**UI:** Decisions view showing:
- What was decided
- Who made the decision
- When it happened
- Link to conversation context

### 5. Smart Semantic Search
**Purpose:** Find relevant messages by meaning, not just keywords

**Implementation:**
- Generate embeddings for messages (OpenAI Embeddings API)
- Store vectors in Firestore
- Semantic search converts query to embedding
- Returns ranked results by similarity

**Example Queries:**
- "decisions about the API design"
- "blockers mentioned yesterday"
- "action items for Alice"

### 6. Proactive Meeting Assistant (Advanced)
**Purpose:** Suggest meeting times based on conversation

**Implementation:**
- Detects scheduling intent in messages
- Extracts participants and constraints
- Suggests 2-3 time windows
- Displays as inline suggestion chip

**Trigger Keywords:**
- "let's meet", "schedule a call"
- "sync up", "quick chat"
- Date/time mentions

## Technical Architecture

### Frontend
- **Framework:** React Native with Expo 51
- **Navigation:** React Navigation v6
- **State:** Zustand for global state
- **Styling:** React Native StyleSheet

### Backend
- **Authentication:** Firebase Auth
- **Database:** Cloud Firestore
- **Storage:** Firebase Storage
- **Serverless:** Cloud Functions (Node 18)
- **Push:** Firebase Cloud Messaging + Expo Notifications

### AI
- **Provider:** OpenAI
- **Models:** GPT-4o-mini for text, text-embedding-3-small for search
- **Integration:** Cloud Functions as secure proxy

## Data Security

### Firestore Rules
- Users can only access threads they're members of
- Message creation requires membership
- Server-side timestamp enforcement
- Cloud Functions have elevated permissions

### Privacy
- Messages stored in Firestore (encrypted at rest)
- Images in Firebase Storage (access-controlled URLs)
- AI processing: only last 50 messages sent to OpenAI
- No long-term conversation storage by OpenAI

## Success Metrics

### Reliability
- Zero message loss in testing
- < 400ms message round-trip on good network
- 100% offline queue delivery on reconnect

### AI Utility
- Users find summaries helpful (qualitative feedback)
- Action items accurately extracted (> 80% precision)
- Priority detection catches urgent messages (> 70% recall)

### Performance
- App launch < 2 seconds
- Message send feels instant (optimistic UI)
- No UI freezes during network transitions

## Future Enhancements

### Phase 2 (Post-Launch)
- Voice messages
- File attachments (PDFs, docs)
- Message reactions
- Thread pinning
- Search filters and advanced queries

### Phase 3
- Video/audio calls
- Screen sharing
- End-to-end encryption
- Desktop/web client
- Calendar integration
- Slack/Teams import

## Non-Goals (V1)
- End-to-end encryption (using Firebase's transport security)
- Voice/video calls
- Desktop application
- Third-party integrations
- Message editing/deletion
- Message forwarding

## Appendix

### Demo Script for Reviewers

1. **Setup:** Two devices, two test accounts
2. **Real-time:** Send messages back and forth, observe instant delivery
3. **Offline:** Airplane mode → send → reconnect → verify delivery
4. **Push:** Background app → receive message → tap notification → opens thread
5. **Restart:** Force quit → reopen → history intact
6. **Rapid send:** Paste 20 messages quickly → correct order maintained
7. **Group:** 3-user group with read receipts for each member
8. **AI:** Summarize conversation → extract action items → show priority messages

### Test Data

Create threads with varied content:
- Technical discussion about API design
- Project planning with action items
- Urgent production issue
- Casual team chat
- Decision-making conversation

### Risk Mitigation

**Risk:** AI costs spiral out of control
**Mitigation:** Truncate context, cache results, rate limit per user

**Risk:** Push notifications don't work reliably
**Mitigation:** Focus on foreground first, use Expo's battle-tested libraries

**Risk:** Offline sync conflicts
**Mitigation:** Server timestamp is source of truth, rare conflicts acceptable

**Risk:** Poor AI accuracy
**Mitigation:** Conservative prompts, user can always read full context

