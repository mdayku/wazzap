# 🔧 Configuration Reference

**Critical configurations for MessageAI project**  
**Keep this file updated whenever configurations change!**

---

## 📍 Firebase Project Info

| Setting | Value |
|---------|-------|
| **Project ID** | `wazapp-c7903` |
| **Project Name** | MessageAI |
| **Region** | us-central1 (Cloud Functions) |
| **Plan** | Blaze (Pay-as-you-go) |

---

## 🔒 Firestore Security Rules

**File:** `firebase/firestore.rules`  
**Last Updated:** Testing Phase - Session 1  
**Status:** ✅ Production Ready

### Key Features:
- ✅ Users can only edit their own profile
- ✅ Thread access restricted to members
- ✅ Messages require sender validation
- ✅ Cloud Functions can update AI data
- ✅ Embeddings are read-only (functions write)

### Production Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    
    // Threads collection
    match /threads/{threadId} {
      // Allow reading if user is a member
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.members;
      
      // Allow creating if user is in the members array being created
      allow create: if request.auth != null && 
        request.auth.uid in request.resource.data.members;
      
      // Allow updating if user is a member
      allow update: if request.auth != null && 
        request.auth.uid in resource.data.members;
      
      // Messages subcollection
      match /messages/{messageId} {
        allow read: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/threads/$(threadId)).data.members;
        allow create: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/threads/$(threadId)).data.members &&
          request.resource.data.senderId == request.auth.uid;
        allow update: if request.auth != null; // Allow Cloud Functions to update
      }
      
      // Members subcollection
      match /members/{uid} {
        allow read, write: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/threads/$(threadId)).data.members;
      }
      
      // Summaries subcollection
      match /summaries/{sid} {
        allow read: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/threads/$(threadId)).data.members;
        allow write: if request.auth != null; // Allow Cloud Functions to write
      }
      
      // Decisions subcollection
      match /decisions/{did} {
        allow read: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/threads/$(threadId)).data.members;
        allow write: if request.auth != null; // Allow Cloud Functions to write
      }
    }
    
    // Embeddings collection (for semantic search)
    match /embeddings/{embeddingId} {
      allow read: if request.auth != null;
      allow write: if false; // Only Cloud Functions can write
    }
  }
}
```

### Deploy Command:
```bash
firebase deploy --only firestore:rules
```

---

## 🗄️ Storage Security Rules

**File:** `firebase/storage.rules`  
**Last Updated:** Testing Phase - Session 1  
**Status:** ✅ Production Ready

### Key Features:
- ✅ Only authenticated users can access files
- ✅ Users can only upload to their own folders
- ✅ Image uploads organized by type (messages/profiles)
- ✅ Default deny for security

### Production Rules:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Message images - authenticated users can upload to their own folder
    match /messages/{userId}/{fileName} {
      // Anyone authenticated can read (thread members will see in their chats)
      allow read: if request.auth != null;
      
      // Only the uploader can write/delete their own files
      allow write, delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Profile photos - users can manage their own profile pictures
    match /profiles/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write, delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Block everything else - security default
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Upload Path Structure:
- **Message Images**: `messages/{userId}/{timestamp}.jpg` - where `userId` is the uploader's UID
- **Profile Photos**: `profiles/{userId}/avatar.jpg` - where `userId` is the user's own UID

**Important:** Always use the uploader's `uid` in the path, not the `threadId`, to match the security rules!

### Deploy Command:
```bash
firebase deploy --only storage
```

**Note:** Storage rules are NOT in firebase.json by default. Deploy manually via console or CLI.

---

## 📊 Firestore Indexes

**File:** `firebase/firestore.indexes.json`  
**Last Updated:** Testing Phase - Session 1  
**Status:** ✅ Production Ready

### Required Indexes:

#### Index 1: Message Timeline
```json
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Sort messages by timestamp in chat threads

#### Index 2: Unread Messages Count
```json
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "senderId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Count unread messages (messages from others after last read timestamp)

#### Index 3: Thread List
```json
{
  "collectionGroup": "threads",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "members", "arrayConfig": "CONTAINS" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Query user's threads sorted by most recent activity

### Deploy Command:
```bash
firebase deploy --only firestore:indexes
```

### Build Status:
- Check index build status: [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/wazapp-c7903/firestore/indexes)
- Indexes take 2-5 minutes to build initially
- Status: Building → Enabled ✅

---

## 🔑 Environment Variables

**File:** `.env` (NOT in git)  
**Status:** ✅ Configured

### Required Variables:
```bash
# Firebase Web App Config
EXPO_PUBLIC_FB_API_KEY=your_api_key_here
EXPO_PUBLIC_FB_AUTH_DOMAIN=wazapp-c7903.firebaseapp.com
EXPO_PUBLIC_FB_PROJECT_ID=wazapp-c7903
EXPO_PUBLIC_FB_STORAGE_BUCKET=wazapp-c7903.firebasestorage.app
EXPO_PUBLIC_FB_SENDER_ID=your_sender_id_here
EXPO_PUBLIC_FB_APP_ID=your_app_id_here
```

### Get Values:
Firebase Console → Project Settings → General → Your apps → Web app → SDK setup and configuration

---

## ☁️ Cloud Functions Configuration

**Directory:** `firebase/functions/`  
**Runtime:** Node.js 18  
**Region:** us-central1  

### Functions Config (Secrets):
```bash
# OpenAI API Key (server-side only)
firebase functions:config:set openai.key="sk-..."

# View current config
firebase functions:config:get

# Deploy functions
cd firebase/functions && npm run build && cd ../.. && firebase deploy --only functions
```

### Deployed Functions (7):

| Function | Type | Trigger | Purpose |
|----------|------|---------|---------|
| `summarize` | Callable | Client request | Thread summarization |
| `extract` | Callable | Client request | Action item extraction |
| `messageCreated` | Trigger | Firestore onCreate | Priority detection & decision tracking |
| `generateEmbeddings` | Callable | Client request | Generate message embeddings |
| `search` | Callable | Client request | Semantic search |
| `detectScheduling` | Callable | Client request | Meeting intent detection |
| `suggestTimes` | Callable | Client request | Meeting time suggestions |

### Function Logs:
```bash
# Real-time logs
firebase functions:log --follow

# Or view in console
https://console.firebase.google.com/project/wazapp-c7903/functions/logs
```

---

## 📱 App Configuration

**File:** `app.json`  
**SDK Version:** 54  
**Platforms:** iOS, Android

### Key Settings:
```json
{
  "expo": {
    "name": "MessageAI",
    "slug": "messageai",
    "version": "0.1.0",
    "ios": {
      "bundleIdentifier": "com.messageai.app"
    },
    "android": {
      "package": "com.messageai.app"
    },
    "extra": {
      "eas": {
        "projectId": "wazapp-c7903"
      }
    }
  }
}
```

---

## 🔄 Deployment Checklist

### Deploy Everything:
```bash
# 1. Deploy Firestore rules
firebase deploy --only firestore:rules

# 2. Deploy Firestore indexes (wait 2-5 min for build)
firebase deploy --only firestore:indexes

# 3. Build and deploy Cloud Functions
cd firebase/functions
npm run build
cd ../..
firebase deploy --only functions

# 4. Update Storage rules (via Firebase Console)
# Go to: https://console.firebase.google.com/project/wazapp-c7903/storage/rules
# Copy/paste from firebase/storage.rules
```

### Verify Deployment:
```bash
# Check rules
firebase firestore:rules:get

# Check indexes
firebase firestore:indexes:list

# Check functions
firebase functions:list

# Check logs
firebase functions:log --only summarize --limit 10
```

---

## 🔍 Quick Reference Links

| Resource | URL |
|----------|-----|
| **Firebase Console** | https://console.firebase.google.com/project/wazapp-c7903 |
| **Firestore Database** | https://console.firebase.google.com/project/wazapp-c7903/firestore |
| **Firestore Rules** | https://console.firebase.google.com/project/wazapp-c7903/firestore/rules |
| **Firestore Indexes** | https://console.firebase.google.com/project/wazapp-c7903/firestore/indexes |
| **Storage** | https://console.firebase.google.com/project/wazapp-c7903/storage |
| **Storage Rules** | https://console.firebase.google.com/project/wazapp-c7903/storage/rules |
| **Authentication** | https://console.firebase.google.com/project/wazapp-c7903/authentication |
| **Cloud Functions** | https://console.firebase.google.com/project/wazapp-c7903/functions |
| **Function Logs** | https://console.firebase.google.com/project/wazapp-c7903/functions/logs |

---

## 🚨 Troubleshooting Common Issues

### "Missing or insufficient permissions"
→ Check Firestore rules are deployed  
→ Verify user is authenticated  
→ Check user is in thread.members array

### "The query requires an index"
→ Click the link in error message  
→ Or deploy firestore.indexes.json  
→ Wait 2-5 minutes for index to build

### "Storage rule error"
→ Storage rules must be updated in Firebase Console  
→ Not controlled by firebase.json (yet)  
→ Copy/paste from firebase/storage.rules

### "Cloud Function timeout"
→ Check OpenAI API key is set: `firebase functions:config:get`  
→ Check function logs: `firebase functions:log --follow`  
→ Verify functions are deployed: `firebase functions:list`

### "Environment variables not loading"
→ Check .env file exists in project root  
→ Verify EXPO_PUBLIC_ prefix on all variables  
→ Restart Expo dev server: `Ctrl+C` then `npm start`

---

## 📝 Change Log

### Session 1 - Testing Phase
- ✅ Created CONFIG_REFERENCE.md
- ✅ Fixed Firestore rules to allow thread creation
- ✅ Updated Storage rules to production mode
- ✅ Added updatedAt field to thread creation
- ✅ Documented all configurations
- ✅ Added Firestore indexes to JSON

### Next Updates
- [ ] Document actual deployed Storage rules (check if they match)
- [ ] Add performance monitoring config
- [ ] Add analytics config
- [ ] Document push notification certificates

---

## 🎯 Important Notes

1. **Keep this file updated!** Whenever you change rules or config, update this document.
2. **Test mode = BAD** - Never use test mode in production (expires after 30 days)
3. **Storage rules** are not in firebase.json by default - deploy manually
4. **Function secrets** use Firebase config, not environment variables
5. **Indexes** can take several minutes to build - be patient

---

*This file is the single source of truth for all Firebase and app configuration.*  
*Last updated: Testing Phase - Session 1*

