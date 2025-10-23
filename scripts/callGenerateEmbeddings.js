/**
 * Call the deployed generateSeinfeldEmbeddings Cloud Function
 * Run with: node scripts/callGenerateEmbeddings.js
 */

const admin = require('firebase-admin');

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

async function callGenerateEmbeddings() {
  try {
    console.log('🎭 Calling generateSeinfeldEmbeddings Cloud Function...\n');

    // Get an auth token
    const token = await admin.auth().createCustomToken('admin-script');
    
    // Call the function via HTTP
    const projectId = serviceAccount.project_id;
    const functionUrl = `https://us-central1-${projectId}.cloudfunctions.net/generateSeinfeldEmbeddings`;
    
    console.log(`📞 Calling: ${functionUrl}\n`);
    console.log('⏳ This may take a minute...\n');

    const https = require('https');
    const data = JSON.stringify({});

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(functionUrl, options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          console.log('✅ Response:', result);
          
          if (result.result) {
            console.log(`\n📊 Summary:`);
            console.log(`  Processed: ${result.result.processed}`);
            console.log(`  Total: ${result.result.total}`);
            console.log(`  Message: ${result.result.message}`);
          }
          
          console.log('\n🎯 Embeddings generated! Agents will now use semantic search!');
          process.exit(0);
        } catch (error) {
          console.error('Error parsing response:', responseData);
          process.exit(1);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error calling function:', error.message);
      process.exit(1);
    });

    req.write(data);
    req.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

callGenerateEmbeddings();

