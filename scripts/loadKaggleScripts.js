/**
 * Load full Kaggle Seinfeld dataset into Firestore
 * Run with: node scripts/loadKaggleScripts.js
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
  process.exit(1);
}

/**
 * Parse CSV file
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // Parse CSV line (handle quotes and commas)
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    data.push(row);
  }
  
  return data;
}

/**
 * Parse a single CSV line (handles quoted fields with commas)
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  
  return values;
}

/**
 * Normalize character names and identify main characters
 */
function normalizeCharacter(name) {
  if (!name) return null;
  
  const normalized = name.trim().toUpperCase();
  
  if (normalized.includes('JERRY')) return { name: 'Jerry', isMain: true };
  if (normalized.includes('GEORGE')) return { name: 'George', isMain: true };
  if (normalized.includes('ELAINE')) return { name: 'Elaine', isMain: true };
  if (normalized.includes('KRAMER')) return { name: 'Kramer', isMain: true };
  
  // Return supporting character with original name
  return { name: name.trim(), isMain: false };
}

/**
 * Upload to Firestore in batches
 */
async function uploadToFirestore(lines) {
  const db = admin.firestore();
  let totalUploaded = 0;
  const batchSize = 500; // Firestore batch limit
  
  console.log(`📤 Uploading ${lines.length} lines to Firestore...\n`);
  
  for (let i = 0; i < lines.length; i += batchSize) {
    const batch = db.batch();
    const chunk = lines.slice(i, i + batchSize);
    
    chunk.forEach(line => {
      const docRef = db.collection('seinfeldScripts').doc();
      batch.set(docRef, {
        character: line.character,
        isMainCharacter: line.isMain,
        line: line.dialogue,
        episode: line.episodeId,
        season: parseInt(line.season) || 0,
        episodeNumber: parseFloat(line.episodeNo) || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        embedding: null, // Will be generated later
      });
    });
    
    await batch.commit();
    totalUploaded += chunk.length;
    
    const progress = ((totalUploaded / lines.length) * 100).toFixed(1);
    console.log(`  ✓ Uploaded ${totalUploaded}/${lines.length} (${progress}%)`);
  }
  
  console.log(`\n✅ Successfully uploaded ${totalUploaded} lines!`);
  return totalUploaded;
}

/**
 * Get statistics
 */
function getStats(lines) {
  const stats = {
    total: lines.length,
    byCharacter: {},
    bySeason: {},
    avgLength: 0,
  };
  
  let totalWords = 0;
  
  lines.forEach(line => {
    // By character
    stats.byCharacter[line.character] = (stats.byCharacter[line.character] || 0) + 1;
    
    // By season
    const season = line.season || 'Unknown';
    stats.bySeason[season] = (stats.bySeason[season] || 0) + 1;
    
    // Word count
    totalWords += line.dialogue.split(' ').length;
  });
  
  stats.avgLength = Math.round(totalWords / lines.length);
  
  return stats;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🎭 Loading Kaggle Seinfeld Dataset...\n');
    
    const csvPath = path.join(__dirname, 'scripts.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ Error: scripts.csv not found!');
      console.log('Expected location: scripts/scripts.csv');
      process.exit(1);
    }
    
    // Parse CSV
    console.log('📖 Parsing CSV file...');
    const rawData = parseCSV(csvPath);
    console.log(`  Found ${rawData.length} total lines\n`);
    
    // Process ALL characters
    console.log('🎯 Processing all characters (main + supporting)...');
    const allLines = rawData
      .map(row => {
        const charInfo = normalizeCharacter(row.Character);
        if (!charInfo) return null;
        
        return {
          character: charInfo.name,
          isMain: charInfo.isMain,
          dialogue: row.Dialogue,
          episodeNo: row.EpisodeNo,
          episodeId: row.SEID,
          season: row.Season,
        };
      })
      .filter(line => line !== null && line.dialogue && line.dialogue.length > 10);
    
    console.log(`  Kept ${allLines.length} lines from all characters\n`);
    
    // Show statistics
    const stats = getStats(allLines);
    console.log('📊 Statistics:');
    console.log(`  Total lines: ${stats.total.toLocaleString()}`);
    console.log(`  Average length: ${stats.avgLength} words`);
    console.log('\n  By character:');
    Object.entries(stats.byCharacter)
      .sort((a, b) => b[1] - a[1])
      .forEach(([char, count]) => {
        console.log(`    ${char}: ${count.toLocaleString()} lines`);
      });
    console.log('\n  By season:');
    Object.entries(stats.bySeason)
      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
      .forEach(([season, count]) => {
        console.log(`    Season ${season}: ${count.toLocaleString()} lines`);
      });
    console.log('');
    
    // Confirm before uploading
    console.log('⚠️  About to upload to Firestore. This will take 5-10 minutes.');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Upload to Firestore
    const uploaded = await uploadToFirestore(allLines);
    
    console.log('\n✨ Done! Seinfeld scripts loaded successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`  - ${uploaded.toLocaleString()} lines uploaded`);
    console.log(`  - ${Object.keys(stats.byCharacter).length} characters`);
    console.log(`  - ${Object.keys(stats.bySeason).length} seasons`);
    console.log('\n🎯 Next step: Generate embeddings');
    console.log('   Run: node scripts/generateEmbeddings.js');
    console.log('   Cost: ~$0.02 (one-time)');
    console.log('   Time: ~10-15 minutes');
    
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

