# Test Data Seeding Scripts

## Overview
These scripts inject realistic test data into your Firebase project to enable proper testing and demonstration of AI features.

## Prerequisites
1. Firebase Admin SDK service account key
2. Node.js installed
3. Firebase Admin npm package

## Setup

### 1. Get your Firebase service account key:
```bash
# Go to Firebase Console → Project Settings → Service Accounts
# Click "Generate new private key"
# Save as serviceAccountKey.json in project root
```

### 2. Install Firebase Admin SDK:
```bash
npm install firebase-admin --save-dev
```

### 3. Get your test user IDs:
```bash
# Option A: Check Firestore Console → users collection
# Option B: Run this in your app console:
# console.log('User ID:', user.uid);
```

### 4. Update the script with your user IDs:
Edit `scripts/seedTestData.js` and replace:
```javascript
const USERS = {
  sarah: 'USER_ID_1', // ← Your primary test user ID
  alex: 'USER_ID_2',  // ← Your second test user ID  
  mike: 'USER_ID_3',  // ← Your third test user ID
};
```

## Running the Script

```bash
node scripts/seedTestData.js
```

Expected output:
```
🚀 MessageAI Test Data Seeder
Persona: Sarah Chen - Startup Product Manager

🌱 Starting data seed...

📝 Creating Thread 1: Product Launch Discussion...
✅ Thread 1 created with 20 messages

🚨 Creating Thread 2: Urgent Production Issue...
✅ Thread 2 created with 16 messages (including urgent ones)

🎨 Creating Thread 3: Design Review Discussion...
✅ Thread 3 created with 18 messages

📅 Creating Thread 4: Meeting Scheduling...
✅ Thread 4 created with 9 messages

🎉 Data seed complete!

Summary:
- Thread 1: Product Launch (20 messages) - Tests Summarize, Actions, Decisions
- Thread 2: Urgent Issue (16 messages) - Tests Priority Detection
- Thread 3: Design Review (18 messages) - Tests Semantic Search, Decisions
- Thread 4: Scheduling (9 messages) - Tests Proactive Scheduler

✨ Total: 4 threads, 63 realistic messages
```

## What Gets Created

### Thread 1: Product Launch Discussion (Sarah ↔ Alex)
**Tests:** Summarize, Extract Actions, Decisions
- 20 messages about planning a Q1 product launch
- Contains action items: "Maria will handle authentication by Friday"
- Contains decisions: "We decided to go with PostgreSQL over MongoDB"
- Contains meeting times: "Monday morning, 9am sprint kickoff"

### Thread 2: Urgent Production Issue (Sarah ↔ Alex)
**Tests:** Priority Detection, High-Priority Badges
- 16 messages about a critical production outage
- Contains URGENT and CRITICAL keywords
- Messages are marked with `priority: 'high'`
- Should display red badges and "URGENT" labels

### Thread 3: Design Review Discussion (Sarah ↔ Mike)
**Tests:** Semantic Search, Decisions
- 18 messages about reviewing dashboard designs
- Rich discussion about UI/UX, colors, navigation, dark mode
- Searchable content: "API", "design", "dashboard", "accessibility"
- Contains decision: "Let's go with this design"

### Thread 4: Meeting Scheduling (Sarah ↔ Alex)
**Tests:** Proactive Scheduler
- 9 messages about scheduling various meetings
- Contains time references: "tomorrow at 3pm", "next Friday at 10am", "Thursday at noon"
- Should trigger AI scheduler suggestions

## Testing AI Features After Seeding

1. **Summarize Feature**
   - Open Thread 1 (Product Launch)
   - Tap the "✨" (sparkles) button
   - Verify summary includes: launch date, key features, decisions

2. **Extract Actions**
   - Open Thread 1
   - Tap "Extract Actions" button
   - Verify action items found: "Maria - authentication by Friday", "Alex - API specs review"

3. **Priority Detection**
   - Open Thread 2 (Urgent Issue)
   - Verify messages with "URGENT"/"CRITICAL" show red badges
   - Verify "🚨 URGENT" label appears

4. **Semantic Search**
   - Go to Search screen
   - Enable "Smart Search (AI-powered)" toggle
   - Search for "dashboard design"
   - Verify Thread 3 results appear

5. **Decisions Screen**
   - Navigate to Decisions screen
   - Verify decisions logged:
     - "PostgreSQL over MongoDB"
     - "Go with this design"

6. **Proactive Scheduler**
   - Open Thread 4 (Scheduling)
   - Look for AI-suggested meeting times
   - Verify "tomorrow at 3pm", "next Friday at 10am" are detected

## Troubleshooting

**Error: "Cannot find module 'firebase-admin'"**
```bash
npm install firebase-admin --save-dev
```

**Error: "Service account key not found"**
- Make sure `serviceAccountKey.json` is in your project root
- Don't commit this file to git (it's in `.gitignore`)

**Error: "Permission denied"**
- Verify your service account has Firestore write permissions
- Check Firebase Console → IAM & Admin → Service Accounts

**No threads appear in app**
- Double-check you updated the USERS object with correct IDs
- Verify user IDs exist in your Firestore `users` collection
- Check Firestore Console to see if data was written

## Cleanup

To remove all test data:
```javascript
// Run this in Firebase Console → Firestore
// Or create a cleanup script if needed
```

**Warning:** Be careful not to delete real user data!

## Notes
- Timestamps are set relative to "now" (e.g., 48 hours ago, 2 hours ago)
- All messages are marked as `status: 'read'` to avoid triggering notifications
- Messages include realistic startup PM conversations
- Conversations align with Sarah Chen persona from PRD

