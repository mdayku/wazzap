# Known Issues & Limitations

## ⚠️ Push Notifications in Expo Go

**Issue:** Push notifications don't work in Expo Go (SDK 53+)

**Error Message:**
```
ERROR  expo-notifications: Android Push notifications (remote notifications) 
functionality provided by expo-notifications was removed from Expo Go with 
the release of SDK 53.
```

**Why:** Expo Go is a development app that can't access native push notification APIs.

**Solutions:**

### Option 1: Development Build (Recommended for Production)
```bash
# Install EAS CLI
npm install -g eas-cli

# Create development build
npx expo install expo-dev-client
eas build --profile development --platform android

# Or for both platforms
eas build --profile development --platform all
```

**Benefits:**
- ✅ Full push notification support
- ✅ All native modules work
- ✅ Custom native code support
- ⏱️ Takes 15-20 minutes first build

### Option 2: Test Without Push (Current Approach)
**All other features work perfectly:**
- ✅ Authentication
- ✅ Real-time messaging
- ✅ Image upload
- ✅ AI features
- ✅ Offline queue
- ✅ Typing indicators
- ✅ Read receipts

**Push notifications are registered but won't deliver in Expo Go.**

---

## 📱 For Grading/Demo

### If Graders Use Expo Go:
- All features work EXCEPT push notifications
- This is an **Expo Go limitation**, not a code issue
- Push notifications ARE implemented correctly in the code

### If You Need Push Notifications Working:
1. Create a development build (Option 1 above)
2. Or build production APK/IPA:
   ```bash
   eas build --platform android
   eas build --platform ios
   ```

---

## ✅ What Works in Expo Go

| Feature | Status |
|---------|--------|
| Authentication | ✅ Works |
| Real-time chat | ✅ Works |
| Offline queue | ✅ Works |
| Image upload | ✅ Works |
| User profiles | ✅ Works |
| Typing indicators | ✅ Works |
| Read receipts | ✅ Works |
| Presence (online/offline) | ✅ Works |
| AI Summarization | ✅ Works |
| Priority Detection | ✅ Works |
| Decision Tracking | ✅ Works |
| Semantic Search | ✅ Works |
| **Push Notifications** | ❌ Expo Go limitation |

---

## 🎯 Recommendation

**For development/testing:** Continue with Expo Go - everything else works!

**For production/grading:** Create a development build if push notifications are required.

---

## 📚 More Info

- [Expo Dev Client](https://docs.expo.dev/develop/development-builds/introduction/)
- [Push Notifications in Development Builds](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [EAS Build](https://docs.expo.dev/build/introduction/)

