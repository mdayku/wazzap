import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';

// Google OAuth Configuration
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  offlineAccess: false,
});

export async function signInWithGoogle() {
  try {
    // Check if device supports Google Play Services
    await GoogleSignin.hasPlayServices();
    
    // Sign in with Google
    const userInfo = await GoogleSignin.signIn();
    
    // Get the ID token
    const idToken = userInfo.data?.idToken;
    
    if (!idToken) {
      throw new Error('No ID token received from Google');
    }
    
    // Sign in to Firebase with the Google credential
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    
    return result.user;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw new Error(error.message || 'Failed to sign in with Google');
  }
}

export async function signOutFromGoogle() {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.error('Error signing out from Google:', error);
  }
}

