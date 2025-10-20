import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MessageAI',
  slug: 'messageai',
  android: {
    ...config.android,
    package: 'com.messageai.app',
  },
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.messageai.app',
  },
  extra: {
    firebaseApiKey: process.env.EXPO_PUBLIC_FB_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FB_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FB_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FB_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FB_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FB_APP_ID,
  },
});

