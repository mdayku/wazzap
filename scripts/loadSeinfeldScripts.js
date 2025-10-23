/**
 * Script to load Seinfeld scripts into Firestore
 * Run with: node scripts/loadSeinfeldScripts.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
try {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin initialized\n');
} catch (error) {
  console.error('❌ Error loading service account:', error.message);
  console.log('\nMake sure firebase-service-account.json is in the project root');
  process.exit(1);
}

/**
 * Normalize character names
 */
function normalizeCharacter(name) {
  const normalized = name.trim().toUpperCase();
  
  if (normalized.includes('JERRY')) return 'Jerry';
  if (normalized.includes('GEORGE')) return 'George';
  if (normalized.includes('ELAINE')) return 'Elaine';
  if (normalized.includes('KRAMER')) return 'Kramer';
  
  return name;
}

/**
 * Upload scripts to Firestore
 */
async function uploadToFirestore(lines) {
  const db = admin.firestore();
  const batch = db.batch();
  let count = 0;
  
  console.log(`📤 Uploading ${lines.length} lines to Firestore...\n`);
  
  for (const line of lines) {
    const docRef = db.collection('seinfeldScripts').doc();
    
    batch.set(docRef, {
      character: normalizeCharacter(line.character),
      line: line.line,
      episode: line.episode,
      season: line.season || 0,
      episodeNumber: line.episodeNumber || 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    count++;
    
    // Firestore batch limit is 500
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  ✓ Uploaded ${count} lines...`);
    }
  }
  
  // Commit remaining
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`\n✅ Successfully uploaded ${count} lines!`);
  return count;
}

/**
 * Get statistics
 */
function getStats(lines) {
  const stats = {
    total: lines.length,
    byCharacter: {},
  };
  
  lines.forEach(line => {
    const char = normalizeCharacter(line.character);
    stats.byCharacter[char] = (stats.byCharacter[char] || 0) + 1;
  });
  
  return stats;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🎭 Loading Seinfeld Scripts...\n');
    
    // Load scripts from JSON
    const dataPath = path.join(__dirname, 'seinfeld-scripts.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error('❌ Error: seinfeld-scripts.json not found!');
      console.log('\nExpected location: scripts/seinfeld-scripts.json');
      process.exit(1);
    }
    
    console.log('📖 Reading scripts from JSON...');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const lines = JSON.parse(rawData);
    console.log(`  Found ${lines.length} lines\n`);
    
    // Show statistics
    const stats = getStats(lines);
    console.log('📊 Statistics:');
    console.log(`  Total lines: ${stats.total}`);
    console.log('  By character:');
    Object.entries(stats.byCharacter)
      .sort((a, b) => b[1] - a[1])
      .forEach(([char, count]) => {
        console.log(`    ${char}: ${count} lines`);
      });
    console.log('');
    
    // Upload to Firestore
    const uploaded = await uploadToFirestore(lines);
    
    console.log('\n✨ Done! Seinfeld scripts loaded successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`  - ${uploaded} lines uploaded`);
    console.log(`  - ${Object.keys(stats.byCharacter).length} characters`);
    console.log('\n🎭 Agents will now use these quotes for more nuanced responses!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

