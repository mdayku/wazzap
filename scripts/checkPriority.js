const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function check() {
  const threads = await db.collection('threads').orderBy('updatedAt', 'desc').limit(5).get();
  
  for (const thread of threads.docs) {
    const lastMsg = thread.data().lastMessage?.text || '';
    if (lastMsg.includes('debrief') || lastMsg.includes('URGENT')) {
      console.log('\n✅ Found Urgent thread:', thread.id);
      console.log('Last message:', lastMsg.substring(0, 50));
      
      const msgs = await db.collection('threads').doc(thread.id).collection('messages')
        .orderBy('createdAt', 'desc').limit(10).get();
      
      console.log('\nTotal messages:', msgs.size);
      console.log('\nPriority status:');
      
      let highCount = 0;
      msgs.docs.forEach(d => {
        const data = d.data();
        if (data.priority === 'high') {
          highCount++;
          console.log('🚨 HIGH:', data.text?.substring(0, 50));
        }
      });
      
      console.log('\nHigh priority messages:', highCount);
      break;
    }
  }
  
  process.exit(0);
}

check();

