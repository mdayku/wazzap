#!/usr/bin/env node

/**
 * Automated Google OAuth Setup Script
 * 
 * This script helps automate the Google Sign-In setup process by:
 * 1. Checking if required tools are installed
 * 2. Getting the Android SHA-1 fingerprint automatically
 * 3. Providing direct links to Firebase/GCP consoles
 * 4. Validating the .env configuration
 * 
 * Run with: node scripts/setup-google-auth.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('\n🔐 Google Sign-In Setup Wizard\n');
console.log('This script will help you configure Google OAuth for your app.\n');

// Step 1: Check if Firebase project is configured
console.log('📋 Step 1: Checking Firebase configuration...');
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found! Please create it first.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const projectId = envContent.match(/EXPO_PUBLIC_FB_PROJECT_ID=(.+)/)?.[1];

if (!projectId) {
  console.error('❌ Firebase project ID not found in .env');
  process.exit(1);
}

console.log(`✅ Found Firebase project: ${projectId}\n`);

// Step 2: Get Android SHA-1 fingerprint
console.log('📱 Step 2: Getting Android debug keystore SHA-1...');

const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const javaHome = process.env.JAVA_HOME;

if (!javaHome && !androidHome) {
  console.log('⚠️  Java/Android SDK not found in PATH');
  console.log('   You\'ll need to get the SHA-1 manually:');
  console.log('   1. Install Android Studio');
  console.log('   2. Run: keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android\n');
} else {
  try {
    const keytoolPath = javaHome 
      ? path.join(javaHome, 'bin', 'keytool')
      : 'keytool';
    
    const keystorePath = os.platform() === 'win32'
      ? path.join(os.homedir(), '.android', 'debug.keystore')
      : path.join(os.homedir(), '.android', 'debug.keystore');

    if (!fs.existsSync(keystorePath)) {
      console.log('⚠️  Debug keystore not found. You may need to:');
      console.log('   1. Build your app once with: npx expo run:android');
      console.log('   2. Or create a keystore manually\n');
    } else {
      const output = execSync(
        `"${keytoolPath}" -list -v -keystore "${keystorePath}" -alias androiddebugkey -storepass android -keypass android`,
        { encoding: 'utf-8' }
      );
      
      const sha1Match = output.match(/SHA1:\s*([A-F0-9:]+)/i);
      if (sha1Match) {
        console.log(`✅ SHA-1 Fingerprint: ${sha1Match[1]}`);
        console.log('   📋 Copied to clipboard (if available)\n');
        
        // Try to copy to clipboard
        try {
          if (os.platform() === 'darwin') {
            execSync(`echo "${sha1Match[1]}" | pbcopy`);
          } else if (os.platform() === 'win32') {
            execSync(`echo ${sha1Match[1]} | clip`);
          }
        } catch (e) {
          // Clipboard not available, that's ok
        }
      }
    }
  } catch (error) {
    console.log('⚠️  Could not automatically get SHA-1');
    console.log('   Error:', error.message);
    console.log('   Get it manually with the command above\n');
  }
}

// Step 3: Provide setup links
console.log('🌐 Step 3: Configure OAuth in Firebase & Google Cloud\n');

console.log('1️⃣  Enable Google Sign-In in Firebase:');
console.log(`   https://console.firebase.google.com/project/${projectId}/authentication/providers\n`);

console.log('2️⃣  Create OAuth Client IDs in Google Cloud:');
console.log(`   https://console.cloud.google.com/apis/credentials?project=${projectId}\n`);

console.log('   Create THREE OAuth 2.0 Client IDs:\n');

console.log('   📱 Android:');
console.log('      - Type: Android');
console.log('      - Package name: com.messageai.app');
console.log('      - SHA-1: (paste the fingerprint from above)');
console.log('      - Click Create\n');

console.log('   🍎 iOS:');
console.log('      - Type: iOS');
console.log('      - Bundle ID: com.messageai.app');
console.log('      - Click Create\n');

console.log('   🌐 Web (should already exist from Firebase):');
console.log('      - Check the list for a Web client');
console.log('      - Copy the Client ID\n');

// Step 4: Update .env
console.log('📝 Step 4: Update your .env file\n');

console.log('Add these three lines to your .env file:');
console.log('');
console.log('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com');
console.log('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com');
console.log('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com');
console.log('');

// Check if already configured
const hasWebId = envContent.includes('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
const hasAndroidId = envContent.includes('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');
const hasIosId = envContent.includes('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');

if (hasWebId && hasAndroidId && hasIosId) {
  console.log('✅ Google OAuth client IDs already configured in .env!\n');
  
  // Validate they're not placeholder values
  const webId = envContent.match(/EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=(.+)/)?.[1];
  if (webId && !webId.includes('your-') && webId.includes('.apps.googleusercontent.com')) {
    console.log('✅ Configuration looks valid!\n');
    console.log('🎉 Google Sign-In is ready to use!');
    console.log('   Restart your Expo server: npm start\n');
  } else {
    console.log('⚠️  Client IDs look like placeholders. Please update them with real values.\n');
  }
} else {
  console.log('⚠️  Google OAuth not yet configured in .env\n');
  console.log('After adding the client IDs:');
  console.log('1. Save the .env file');
  console.log('2. Restart Expo: npm start');
  console.log('3. Test Google Sign-In on the login screen\n');
}

console.log('📚 For more details, see README.md (Google Sign-In Setup section)\n');

