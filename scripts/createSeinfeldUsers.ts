/**
 * Script to create Firebase user accounts for Seinfeld characters
 * Run with: npx ts-node scripts/createSeinfeldUsers.ts
 */

import * as admin from 'firebase-admin';
import { ALL_CHARACTERS } from '../src/data/seinfeldCharacters';

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function createSeinfeldUsers() {
  console.log('🎭 Creating Seinfeld character user accounts...\n');

  for (const profile of ALL_CHARACTERS) {
    try {
      console.log(`Creating user for ${profile.character}...`);

      // Check if user already exists
      try {
        const existingUser = await admin.auth().getUserByEmail(profile.email);
        console.log(`  ✓ ${profile.character} already exists (UID: ${existingUser.uid})`);
        
        // Update display name if needed
        if (existingUser.displayName !== profile.displayName) {
          await admin.auth().updateUser(existingUser.uid, {
            displayName: profile.displayName,
          });
          console.log(`  ✓ Updated display name to "${profile.displayName}"`);
        }
        
        // Also create/update Firestore user document
        await admin.firestore().collection('users').doc(existingUser.uid).set({
          uid: existingUser.uid,
          email: profile.email,
          displayName: profile.displayName,
          photoURL: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isSeinfeldAgent: true,
          character: profile.character,
        }, { merge: true });
        
        console.log(`  ✓ Firestore user document updated\n`);
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
        password: `seinfeld_${profile.character.toLowerCase()}_2025`, // Secure password
        emailVerified: true,
      });

      console.log(`  ✓ Created Firebase Auth user (UID: ${userRecord.uid})`);

      // Create Firestore user document
      await admin.firestore().collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: profile.email,
        displayName: profile.displayName,
        photoURL: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isSeinfeldAgent: true,
        character: profile.character,
        personality: profile.personality,
        traits: profile.traits,
        catchphrases: profile.catchphrases,
      });

      console.log(`  ✓ Created Firestore user document`);
      console.log(`  ✓ ${profile.character} is ready!\n`);

    } catch (error) {
      console.error(`  ✗ Error creating ${profile.character}:`, error);
    }
  }

  console.log('✨ Done! All Seinfeld characters are now registered users.');
  console.log('\nYou can now:');
  console.log('  1. See them in the New Chat screen');
  console.log('  2. See them in group member lists');
  console.log('  3. Start 1-on-1 chats with them');
  console.log('  4. They will auto-respond when Seinfeld Mode is enabled\n');
}

// Run if called directly
if (require.main === module) {
  createSeinfeldUsers()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { createSeinfeldUsers };

