# MessageAI Setup Guide

**✅ Note: This project is already fully set up and working! This guide is for reference or for setting up from scratch.**

MessageAI is a real-time messaging app for remote teams with AI-powered features built on React Native, Firebase, and OpenAI.

**Current Status:** 🎉 100% MVP Complete - All 11 requirements met and tested!

## Prerequisites

- Node.js 18+ and npm
- Firebase account
- OpenAI API key
- Expo CLI: `npm install -g expo-cli`
- Firebase CLI: `npm install -g firebase-tools`

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" and follow the wizard
3. Once created, you'll need to enable the Blaze (pay-as-you-go) plan for Cloud Functions

### 2. Enable Firebase Services

In your Firebase project console:

**Authentication:**
- Go to Authentication → Sign-in method
- Enable "Email/Password" provider

**Firestore Database:**
- Go to Firestore Database → Create database
- Start in test mode (we'll deploy security rules later)
- Choose a region close to your users

**Storage:**
- Go to Storage → Get started
- Start in test mode

**Cloud Functions:**
- Already enabled with Blaze plan

### 3. Create Web App Config

1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" and click the web icon (`</>`)
3. Register app with nickname "MessageAI Web"
4. Copy the configuration object

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Fill in your Firebase credentials from step 3:

```
EXPO_PUBLIC_FB_API_KEY=your_api_key
EXPO_PUBLIC_FB_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FB_PROJECT_ID=your_project_id
EXPO_PUBLIC_FB_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FB_SENDER_ID=your_sender_id
EXPO_PUBLIC_FB_APP_ID=your_app_id
```

## Mobile App Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm start
```

This will open Expo Developer Tools in your browser.

### 3. Run on Device or Emulator

**iOS (Mac only):**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

**Using Expo Go (easiest):**
1. Install Expo Go app on your phone
2. Scan the QR code from the terminal or Expo Developer Tools
3. App will load on your device

## Firebase Functions Setup

### 1. Login to Firebase

```bash
firebase login
```

### 2. Initialize Firebase (if not already done)

```bash
firebase init
```

Select:
- Firestore
- Functions
- Choose your existing project
- Use TypeScript for Functions
- Install dependencies

### 3. Configure OpenAI API Key

Set the OpenAI API key in Firebase Functions config:

```bash
firebase functions:config:set openai.api_key="your_openai_api_key"
```

Or set it as an environment variable in `.env` files for local development.

### 4. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 5. Deploy Cloud Functions

```bash
cd firebase/functions
npm install
cd ../..
firebase deploy --only functions
```

## Testing

### Create Test Users and Threads

1. **Create two test accounts:**
   - Open the app and sign up with two different emails
   - Note down the user IDs (UIDs) from Firebase Console → Authentication

2. **Create a test thread in Firestore:**
   - Go to Firestore Console
   - Create a new document in the `threads` collection:
   
   ```json
   {
     "type": "direct",
     "members": ["uid1", "uid2"],
     "createdAt": [current timestamp],
     "updatedAt": [current timestamp],
     "lastMessage": null
   }
   ```

3. **Create member documents:**
   - Under the thread document, create a `members` subcollection
   - Add two documents (one for each UID):
   
   ```json
   {
     "role": "member",
     "joinedAt": [current timestamp],
     "readAt": null,
     "typing": false
   }
   ```

### Test Scenarios

1. **Real-time messaging:**
   - Open app on two devices with different accounts
   - Send messages and verify they appear instantly

2. **Offline queue:**
   - Turn on airplane mode on one device
   - Send messages (they'll queue locally)
   - Turn off airplane mode
   - Messages should flush to Firestore

3. **AI Summarization:**
   - Send 10-15 messages in a thread
   - Tap the "Summarize" button
   - View the AI-generated summary

4. **Priority detection:**
   - Send an urgent message like "URGENT: Server is down!"
   - Check if it gets marked as high priority (red border)

## Architecture

### Data Model

```
users/{uid}
  - email, displayName, photoURL
  - lastSeen, pushToken

threads/{threadId}
  - type: 'direct' | 'group'
  - members: [uid...]
  - lastMessage: {text, senderId, timestamp}
  
  /messages/{messageId}
    - senderId, text, media
    - status, priority, createdAt
  
  /members/{uid}
    - readAt, typing, role
  
  /summaries/{summaryId}
    - text, actionItems, decisions
    - range: {from, to}, createdAt
  
  /decisions/{decisionId}
    - summary, owner, messageId
    - decidedAt, createdAt
```

### Cloud Functions

- **messageCreated**: Triggered on new message, classifies priority and extracts decisions
- **summarize**: Callable function that generates thread summaries
- **extract**: Callable function that extracts action items and decisions

## Production Deployment

### Mobile App

For production builds:

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

You'll need an Expo account. See [Expo EAS Build docs](https://docs.expo.dev/build/introduction/).

### Backend

All backend services are automatically deployed on Firebase:
- Firestore scales automatically
- Cloud Functions scale based on usage
- Storage has generous free tier

### Environment Variables for Production

For production, set environment variables:
- In Expo: Use `eas secret:create`
- In Firebase: Use `firebase functions:config:set`

## Troubleshooting

**App won't start:**
- Clear cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

**Firebase errors:**
- Check that all services are enabled
- Verify environment variables are correct
- Check Firestore rules aren't blocking access

**Cloud Functions not working:**
- Check function logs: `firebase functions:log`
- Verify OpenAI API key is set
- Check billing is enabled (Blaze plan required)

**Push notifications not working:**
- Verify permissions are granted
- Check FCM/APNs configuration
- Test in foreground first, then background

## Cost Estimates

**Firebase (Free tier → Blaze plan):**
- Firestore: Free up to 1GB, 50K reads/day
- Functions: Free up to 2M invocations/month
- Storage: 5GB free

**OpenAI (Pay-as-you-go):**
- GPT-4o-mini: ~$0.15 per 1M input tokens
- Embeddings: ~$0.02 per 1M tokens
- Estimated: $5-10/month for moderate usage

## Support

For issues and questions:
- Check Firebase Console logs
- Check Expo error messages
- Review Cloud Functions logs: `firebase functions:log`

