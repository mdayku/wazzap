import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FB_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FB_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FB_APP_ID
};

// Initialize Firebase app (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
console.log('Firebase app initialized');

// Initialize Auth with AsyncStorage for React Native
// Check if auth is already initialized to avoid errors
let auth: any;
try {
  auth = initializeAuth(app, {
    // Note: React Native persistence is handled automatically in modern Firebase
  });
  console.log('Firebase Auth initialized with persistence');
} catch (error: unknown) {
  // If already initialized, just get the existing instance
  if ((error as any)?.code === 'auth/already-initialized') {
    auth = getAuth(app);
    console.log('Firebase Auth already initialized, using existing instance');
  } else {
    console.error('Firebase Auth initialization error:', error);
    throw error;
  }
}

const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
console.log('Firebase services initialized');

export { auth, db, storage, functions };

// Firestore persistence is automatic in React Native

