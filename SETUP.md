# MessageAI Setup Instructions

Quick start guide to get MessageAI running on your machine.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed (`node --version`)
- **npm** or **yarn** package manager
- **Git** for version control
- **Expo account** (free) at expo.dev
- **Firebase account** (free tier works for development)
- **OpenAI API key** with credits

## Step 1: Install Dependencies

```bash
# Install project dependencies
npm install

# Install Firebase CLI globally
npm install -g firebase-tools

# Install Expo CLI globally (optional but recommended)
npm install -g expo-cli

# Install dependencies for Cloud Functions
cd firebase/functions
npm install
cd ../..
```

## Step 2: Firebase Setup

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: "messageai" (or your choice)
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2.2 Upgrade to Blaze Plan

Cloud Functions require the Blaze (pay-as-you-go) plan:

1. In Firebase Console, click "Upgrade" in the bottom left
2. Select "Blaze" plan
3. Set up billing (has generous free tier)
4. Confirm upgrade

### 2.3 Enable Firebase Services

**Enable Authentication:**
1. Go to "Authentication" in left sidebar
2. Click "Get started"
3. Click "Sign-in method" tab
4. Enable "Email/Password"
5. Click "Save"

**Enable Firestore:**
1. Go to "Firestore Database"
2. Click "Create database"
3. Select "Start in test mode" (we'll deploy secure rules later)
4. Choose location closest to your users
5. Click "Enable"

**Enable Storage:**
1. Go to "Storage"
2. Click "Get started"
3. Start in test mode
4. Use default location
5. Click "Done"

### 2.4 Get Firebase Config

1. In Firebase Console, click the gear icon → "Project settings"
2. Scroll to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Register app with nickname "MessageAI Web"
5. **Copy the firebaseConfig object**

### 2.5 Configure Environment Variables

Create a `.env` file in project root:

```bash
cp .env.example .env
```

Edit `.env` and paste your Firebase config:

```
EXPO_PUBLIC_FB_API_KEY=AIza...
EXPO_PUBLIC_FB_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FB_PROJECT_ID=your-project
EXPO_PUBLIC_FB_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FB_SENDER_ID=123456789
EXPO_PUBLIC_FB_APP_ID=1:123456789:web:abc...
```

## Step 3: Firebase CLI Setup

### 3.1 Login to Firebase

```bash
firebase login
```

This opens a browser to authenticate.

### 3.2 Initialize Firebase Project

```bash
firebase use --add
```

- Select your Firebase project from the list
- Choose an alias (e.g., "default")

### 3.3 Set OpenAI API Key

Set your OpenAI API key for Cloud Functions:

```bash
firebase functions:config:set openai.api_key="sk-..."
```

Replace `sk-...` with your actual OpenAI API key.

### 3.4 Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

This deploys the security rules from `firebase/firestore.rules`.

## Step 4: Deploy Cloud Functions

```bash
# Build and deploy functions
cd firebase/functions
npm run build
cd ../..
firebase deploy --only functions
```

This takes a few minutes. You should see:
- ✓ messageCreated
- ✓ summarize
- ✓ extract
- ✓ search
- ✓ generateEmbeddings
- ✓ detectScheduling
- ✓ suggestTimes

## Step 5: Run the App

### 5.1 Start Expo Dev Server

```bash
npm start
```

This opens Expo Developer Tools in your browser.

### 5.2 Run on Device or Simulator

**Option A: Use Expo Go (Easiest)**

1. Install "Expo Go" app on your phone (iOS/Android)
2. Scan the QR code from the terminal
3. App loads on your device

**Option B: iOS Simulator (Mac only)**

```bash
npm run ios
```

**Option C: Android Emulator**

```bash
npm run android
```

## Step 6: Create Test Data

### 6.1 Create Test Users

1. Run the app and sign up with two test emails:
   - user1@test.com / password123
   - user2@test.com / password123

2. Note the UIDs:
   - Open Firebase Console → Authentication
   - Copy the UID for each user

### 6.2 Create a Test Thread

1. Go to Firebase Console → Firestore Database
2. Click "Start collection"
3. Collection ID: `threads`
4. Add first document:

```json
{
  "type": "direct",
  "members": ["UID1", "UID2"],
  "createdAt": [click "Add field" → type: timestamp → current timestamp],
  "updatedAt": [timestamp, current],
  "lastMessage": null
}
```

5. Copy the generated thread ID

### 6.3 Create Member Documents

1. In the thread document, click "Start collection"
2. Collection ID: `members`
3. Document ID: UID1
4. Fields:

```json
{
  "role": "member",
  "joinedAt": [timestamp, current],
  "readAt": null,
  "typing": false
}
```

5. Add another document with ID: UID2 (same fields)

### 6.4 Test Messaging

1. Open app on two devices with the two test accounts
2. You should see the thread in your list
3. Send messages back and forth
4. Test AI features:
   - Tap "Summarize" button
   - Send urgent message to test priority detection
   - View decisions automatically extracted

## Troubleshooting

### App won't start

```bash
# Clear cache
expo start -c

# Reinstall dependencies
rm -rf node_modules
npm install
```

### Firebase connection errors

- Check `.env` file has correct values
- Verify Firebase services are enabled
- Check Firestore rules were deployed

### Cloud Functions not working

```bash
# Check deployment status
firebase functions:list

# View logs
firebase functions:log

# Verify OpenAI key is set
firebase functions:config:get
```

### Push notifications not working

- Verify you're testing on a physical device (not simulator for push)
- Check notification permissions are granted
- Test foreground notifications first

### TypeScript errors

```bash
# In project root
npm install --save-dev @types/react @types/react-native

# In functions directory
cd firebase/functions
npm install --save-dev @types/node
```

## Next Steps

Once everything is running:

1. **Test Core Features:**
   - Send messages in real-time
   - Test offline mode (airplane mode)
   - Verify push notifications
   - Try image uploads

2. **Test AI Features:**
   - Generate thread summaries
   - Check priority detection
   - View extracted decisions
   - Try semantic search (after generating embeddings)

3. **Generate Embeddings:**
   - In Firebase Console, go to Functions
   - Manually call `generateEmbeddings` with `{"threadId": "your-thread-id"}`
   - This enables semantic search

4. **Customize:**
   - Update app.json with your app name/icons
   - Modify AI prompts in Cloud Functions
   - Adjust UI styling to your preferences

## Production Deployment

When ready for production:

1. **Build Mobile App:**
   ```bash
   eas build --platform ios
   eas build --platform android
   ```

2. **Configure Push Notifications:**
   - Set up FCM for Android
   - Configure APNs for iOS
   - Update Firebase console with push credentials

3. **Secure Firestore Rules:**
   - Review and tighten security rules
   - Test with Firebase emulator

4. **Monitor Costs:**
   - Set up billing alerts in Firebase
   - Monitor OpenAI API usage
   - Configure rate limiting

## Support Resources

- **Expo Docs:** https://docs.expo.dev/
- **Firebase Docs:** https://firebase.google.com/docs
- **React Navigation:** https://reactnavigation.org/
- **OpenAI API:** https://platform.openai.com/docs

## Cost Estimates

**Development (Free Tier):**
- Firebase: Free tier sufficient for development
- OpenAI: ~$1-2 for initial testing

**Production (Light Usage):**
- Firebase Blaze: ~$5-10/month (with free tier included)
- OpenAI: ~$10-20/month for moderate usage
- Total: ~$15-30/month

---

**Ready to build!** If you encounter issues, check the troubleshooting section or review the detailed documentation in `docs/README.md`.

