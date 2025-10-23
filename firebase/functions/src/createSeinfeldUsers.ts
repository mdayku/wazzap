import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const SEINFELD_CHARACTERS = [
  {
    uid: 'seinfeld_jerry',
    email: 'jerry@seinfeld.ai',
    displayName: 'Jerry Seinfeld',
    character: 'Jerry',
  },
  {
    uid: 'seinfeld_george',
    email: 'george@seinfeld.ai',
    displayName: 'George Costanza',
    character: 'George',
  },
  {
    uid: 'seinfeld_elaine',
    email: 'elaine@seinfeld.ai',
    displayName: 'Elaine Benes',
    character: 'Elaine',
  },
  {
    uid: 'seinfeld_kramer',
    email: 'kramer@seinfeld.ai',
    displayName: 'Cosmo Kramer',
    character: 'Kramer',
  },
];

/**
 * Callable function to create Seinfeld character user accounts
 * Call this once to set up the characters as real Firebase users
 */
export const createSeinfeldUsers = functions.https.onCall(async (data, context) => {
  // Only allow admins to call this (optional security)
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const results = [];

  for (const profile of SEINFELD_CHARACTERS) {
    try {
      // Check if user already exists
      try {
        const existingUser = await admin.auth().getUserByEmail(profile.email);
        
        // Update display name if needed
        if (existingUser.displayName !== profile.displayName) {
          await admin.auth().updateUser(existingUser.uid, {
            displayName: profile.displayName,
          });
        }
        
        // Update Firestore user document
        await admin.firestore().collection('users').doc(existingUser.uid).set({
          uid: existingUser.uid,
          email: profile.email,
          displayName: profile.displayName,
          photoURL: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isSeinfeldAgent: true,
          character: profile.character,
        }, { merge: true });
        
        results.push({
          character: profile.character,
          status: 'updated',
          uid: existingUser.uid,
        });
        
        continue;
      } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
          throw error;
        }
      }

      // Create new user
      const userRecord = await admin.auth().createUser({
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
        password: `seinfeld_${profile.character.toLowerCase()}_2025`,
        emailVerified: true,
      });

      // Create Firestore user document
      await admin.firestore().collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: profile.email,
        displayName: profile.displayName,
        photoURL: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isSeinfeldAgent: true,
        character: profile.character,
      });

      results.push({
        character: profile.character,
        status: 'created',
        uid: userRecord.uid,
      });

    } catch (error: any) {
      results.push({
        character: profile.character,
        status: 'error',
        error: error.message,
      });
    }
  }

  return {
    success: true,
    message: 'Seinfeld characters processed',
    results,
  };
});

