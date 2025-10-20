# Firebase Initialization Script

This guide helps you set up Firebase from scratch.

## Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Enter project name (e.g., "messageai")
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Upgrade to Blaze Plan

```
1. In Firebase Console, click "Upgrade" in bottom left
2. Select "Blaze - Pay as you go"
3. Set up billing information
4. Confirm upgrade
```

## Step 3: Enable Services via Console

### Authentication
```
1. Navigate to: Authentication
2. Click: "Get started"
3. Click: "Sign-in method" tab
4. Enable: "Email/Password"
5. Save
```

### Firestore Database
```
1. Navigate to: Firestore Database
2. Click: "Create database"
3. Select: "Start in test mode"
4. Choose: Region closest to users
5. Enable
```

### Storage
```
1. Navigate to: Storage
2. Click: "Get started"
3. Start in: test mode
4. Use: default location
5. Done
```

## Step 4: Get Web App Config

```
1. Go to: Project Settings (gear icon)
2. Scroll to: "Your apps"
3. Click: Web icon (</>)
4. Register app: "MessageAI Web"
5. Copy the firebaseConfig object
```

Example output:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

## Step 5: Configure Local Environment

Update `.env` file:
```bash
EXPO_PUBLIC_FB_API_KEY=AIzaSyC...
EXPO_PUBLIC_FB_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FB_PROJECT_ID=your-project
EXPO_PUBLIC_FB_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FB_SENDER_ID=123456789
EXPO_PUBLIC_FB_APP_ID=1:123456789:web:abc...
```

## Step 6: Firebase CLI Setup

```bash
# Login
firebase login

# Initialize (select existing project)
firebase use --add

# Select your project and set alias to "default"
```

Update `.firebaserc`:
```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

## Step 7: Set Cloud Functions Config

```bash
# Set OpenAI API key
firebase functions:config:set openai.api_key="sk-..."

# Verify
firebase functions:config:get
```

## Step 8: Deploy Firebase Resources

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes

# Install Cloud Functions dependencies
cd firebase/functions
npm install

# Deploy Cloud Functions
cd ../..
firebase deploy --only functions
```

## Step 9: Create Test Data

### Create Users
1. Run the mobile app
2. Sign up with: user1@test.com / password123
3. Sign up with: user2@test.com / password123
4. Note the UIDs from Firebase Console → Authentication

### Create Thread
In Firestore Console:

1. Create collection: `threads`
2. Add document with auto-ID:
```json
{
  "type": "direct",
  "members": ["uid1", "uid2"],
  "createdAt": [Timestamp - now],
  "updatedAt": [Timestamp - now],
  "lastMessage": null
}
```

3. In that thread document, create subcollection: `members`
4. Add document with ID = uid1:
```json
{
  "role": "member",
  "joinedAt": [Timestamp - now],
  "readAt": null,
  "typing": false
}
```

5. Add document with ID = uid2 (same fields)

## Step 10: Verify Setup

Test checklist:
- [ ] Can sign up new users
- [ ] Users appear in Authentication tab
- [ ] Thread appears in app
- [ ] Can send messages
- [ ] Messages appear in real-time
- [ ] "Summarize" button works
- [ ] Cloud Functions logs show activity

## Monitoring

```bash
# Watch Cloud Functions logs
firebase functions:log --follow

# Check function status
firebase functions:list

# View Firestore usage
# Go to: Firebase Console → Firestore → Usage tab
```

## Troubleshooting

**Functions won't deploy:**
- Ensure Blaze plan is active
- Check functions/package.json for errors
- Run `npm install` in functions directory

**Can't write to Firestore:**
- Check security rules are deployed
- Verify user is authenticated
- Check user UID is in thread members array

**AI features not working:**
- Verify OpenAI API key is set: `firebase functions:config:get`
- Check function logs: `firebase functions:log`
- Ensure you have OpenAI credits

## Cost Monitoring

Set up billing alerts:
1. Go to: Google Cloud Console
2. Navigate to: Billing → Budgets & alerts
3. Create budget: $10/month
4. Set alert threshold: 80%

## Next Steps

Once everything works:
1. Tighten Firestore security rules
2. Set up monitoring/alerts
3. Configure FCM for push notifications
4. Add custom domain (optional)
5. Set up CI/CD (optional)

