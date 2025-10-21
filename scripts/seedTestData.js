/**
 * Seed realistic test data for AI feature testing
 * Persona: Sarah Chen - Startup Product Manager
 * 
 * Run with: node scripts/seedTestData.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Test user IDs (replace with your actual test user IDs)
const USERS = {
  sarah: 'USER_ID_1', // Replace with actual Sarah's user ID
  alex: 'USER_ID_2',  // Replace with Alex (Engineering Lead) ID
  mike: 'USER_ID_3',  // Replace with Mike (Designer) ID
};

// Helper to create timestamps at specific intervals
function createTimestamp(hoursAgo) {
  return admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
  );
}

// Thread 1: Product Launch Discussion (Tests: Summarize, Extract Actions, Decisions)
const THREAD_1_MESSAGES = [
  { sender: 'alex', text: 'Hey Sarah, wanted to sync on the Q1 product launch timeline', time: 48 },
  { sender: 'sarah', text: 'Perfect timing! I just finished the roadmap draft. Looking at Feb 15th launch date', time: 47.5 },
  { sender: 'alex', text: 'That gives us 6 weeks. What are the critical features for v1?', time: 47 },
  { sender: 'sarah', text: 'Must-haves: user authentication, dashboard, and the new AI chat feature', time: 46.8 },
  { sender: 'alex', text: 'AI chat is the biggest lift. We\'ll need at least 3 weeks for that', time: 46.5 },
  { sender: 'sarah', text: 'Agreed. Can we start on authentication this week?', time: 46.3 },
  { sender: 'alex', text: 'Yes, I\'ll assign that to Maria. She can knock it out by Friday', time: 46 },
  { sender: 'sarah', text: 'Great! Also need you to review the API specs I sent yesterday', time: 45.8 },
  { sender: 'alex', text: 'Will do. Should have feedback by EOD tomorrow', time: 45.5 },
  { sender: 'sarah', text: 'Perfect. One more thing - we decided to go with PostgreSQL over MongoDB, right?', time: 45.3 },
  { sender: 'alex', text: 'Yes, final decision was PostgreSQL. Better for our relational data model', time: 45 },
  { sender: 'sarah', text: 'Excellent. I\'ll update the tech stack doc', time: 44.8 },
  { sender: 'alex', text: 'Also, Mike wants to show us the new dashboard mockups tomorrow at 2pm', time: 44.5 },
  { sender: 'sarah', text: 'Works for me. Can you send a calendar invite?', time: 44.3 },
  { sender: 'alex', text: 'Done. I\'ll also loop in the QA team so they can start planning test cases', time: 44 },
  { sender: 'sarah', text: 'Smart. Let\'s plan a sprint kickoff for Monday morning, 9am?', time: 43.8 },
  { sender: 'alex', text: 'Perfect. I\'ll book the conference room and send out the agenda', time: 43.5 },
  { sender: 'sarah', text: 'Thanks Alex. This is shaping up nicely. Our investors are going to love the demo', time: 43 },
  { sender: 'alex', text: 'Agreed. The AI features are really going to differentiate us', time: 42.8 },
  { sender: 'sarah', text: 'Exactly. Okay, I need to prep for the board meeting. Talk later!', time: 42.5 },
];

// Thread 2: Urgent Production Issue (Tests: Priority Detection, High-Priority Badges)
const THREAD_2_MESSAGES = [
  { sender: 'alex', text: 'URGENT: Production API is throwing 500 errors', time: 2 },
  { sender: 'sarah', text: 'What?? How bad is it?', time: 1.95 },
  { sender: 'alex', text: 'CRITICAL - all user logins are failing. Started 10 minutes ago', time: 1.9 },
  { sender: 'sarah', text: 'This is bad. How many users affected?', time: 1.85 },
  { sender: 'alex', text: 'Looks like everyone who tried to login in the last 10 min. Probably 50-100 users', time: 1.8 },
  { sender: 'sarah', text: 'OK get the team on this NOW. I\'m hopping on Slack', time: 1.75 },
  { sender: 'alex', text: 'Already called Maria and Tom. They\'re investigating the database connection', time: 1.7 },
  { sender: 'sarah', text: 'URGENT: We need to post a status update on Twitter. Users are complaining', time: 1.65 },
  { sender: 'alex', text: 'Good call. Can you handle that while we debug?', time: 1.6 },
  { sender: 'sarah', text: 'On it. Keep me posted every 5 minutes', time: 1.55 },
  { sender: 'alex', text: 'Found it! Database connection pool was exhausted. Rolling back the deploy now', time: 1.3 },
  { sender: 'sarah', text: 'How long until we\'re back up?', time: 1.25 },
  { sender: 'alex', text: 'Should be live in 2 minutes. Then we need to monitor closely', time: 1.2 },
  { sender: 'sarah', text: 'I\'ll draft the post-mortem doc. We need to prevent this from happening again', time: 1.15 },
  { sender: 'alex', text: 'We\'re back! API is responding normally. Monitoring dashboards look good', time: 1 },
  { sender: 'sarah', text: 'Phew. Nice work team. Let\'s do a debrief call at 4pm', time: 0.95 },
];

// Thread 3: Design Review Discussion (Tests: Semantic Search, Decisions)
const THREAD_3_MESSAGES = [
  { sender: 'mike', text: 'Hey Sarah! Ready to review the new dashboard designs?', time: 24 },
  { sender: 'sarah', text: 'Yes! I\'ve been excited to see these. Share your screen?', time: 23.9 },
  { sender: 'mike', text: 'Just sent the Figma link. Check out the homepage first', time: 23.8 },
  { sender: 'sarah', text: 'Wow, this is gorgeous! Love the color palette. Very modern', time: 23.7 },
  { sender: 'mike', text: 'Thanks! I went with a blue/purple gradient theme. Thoughts on the navigation?', time: 23.6 },
  { sender: 'sarah', text: 'The left sidebar is clean. But can we make the icons bigger? Accessibility concern', time: 23.5 },
  { sender: 'mike', text: 'Good point. I\'ll bump them up to 24px. What about the data visualizations?', time: 23.4 },
  { sender: 'sarah', text: 'The charts look amazing. Could we add a dark mode toggle though?', time: 23.3 },
  { sender: 'mike', text: 'Absolutely. I actually have dark mode mockups ready. Want to see?', time: 23.2 },
  { sender: 'sarah', text: 'Yes please! Our power users will love that', time: 23.1 },
  { sender: 'mike', text: 'Check page 3 of the Figma. I think the dark theme really pops', time: 23 },
  { sender: 'sarah', text: 'This is perfect. Let\'s go with this design. Can you export the assets for Alex?', time: 22.9 },
  { sender: 'mike', text: 'Will do. I\'ll have them ready by tomorrow. Should I also update the mobile mockups?', time: 22.8 },
  { sender: 'sarah', text: 'Yes, mobile is critical. Keep the same design language', time: 22.7 },
  { sender: 'mike', text: 'Got it. One question - should the dashboard be the default landing page after login?', time: 22.6 },
  { sender: 'sarah', text: 'Good question. Let\'s discuss with Alex, but I think yes. It\'s the most useful screen', time: 22.5 },
  { sender: 'mike', text: 'Agreed. I\'ll finalize everything and send over the complete design system doc', time: 22.4 },
  { sender: 'sarah', text: 'Perfect. This is going to make our product stand out. Great work Mike!', time: 22.3 },
];

// Thread 4: Meeting Scheduling (Tests: Proactive Scheduler)
const THREAD_4_MESSAGES = [
  { sender: 'alex', text: 'We need to schedule a sprint retrospective', time: 12 },
  { sender: 'sarah', text: 'Agreed. When works for you?', time: 11.9 },
  { sender: 'alex', text: 'I\'m free tomorrow afternoon, maybe around 3pm?', time: 11.8 },
  { sender: 'sarah', text: 'Tomorrow at 3pm works! Let me check if Mike is available', time: 11.7 },
  { sender: 'alex', text: 'Also need to schedule the investor demo. Thinking next Friday at 10am?', time: 11.6 },
  { sender: 'sarah', text: 'Next Friday 10am is perfect. I\'ll send calendar invites', time: 11.5 },
  { sender: 'alex', text: 'And we should do a team lunch this week. Thursday at noon?', time: 11.4 },
  { sender: 'sarah', text: 'Thursday noon sounds great! I know a new sushi place near the office', time: 11.3 },
  { sender: 'alex', text: 'Perfect. See you tomorrow at 3pm then!', time: 11.2 },
];

async function seedData() {
  console.log('🌱 Starting data seed...\n');
  
  try {
    // Create Thread 1: Product Launch Discussion
    console.log('📝 Creating Thread 1: Product Launch Discussion...');
    const thread1Ref = db.collection('threads').doc();
    await thread1Ref.set({
      type: 'direct',
      members: [USERS.sarah, USERS.alex],
      createdAt: createTimestamp(48),
      updatedAt: createTimestamp(42.5),
      lastMessage: {
        text: 'Exactly. Okay, I need to prep for the board meeting. Talk later!',
        senderId: USERS.sarah,
        timestamp: createTimestamp(42.5),
      },
      lastRead: {
        [USERS.sarah]: createTimestamp(42.5),
        [USERS.alex]: createTimestamp(42.8),
      },
    });
    
    // Add messages to Thread 1
    for (const msg of THREAD_1_MESSAGES) {
      await thread1Ref.collection('messages').add({
        senderId: USERS[msg.sender],
        text: msg.text,
        createdAt: createTimestamp(msg.time),
        status: 'read',
        priority: 'normal',
      });
    }
    console.log('✅ Thread 1 created with', THREAD_1_MESSAGES.length, 'messages\n');
    
    // Create Thread 2: Urgent Production Issue
    console.log('🚨 Creating Thread 2: Urgent Production Issue...');
    const thread2Ref = db.collection('threads').doc();
    await thread2Ref.set({
      type: 'direct',
      members: [USERS.sarah, USERS.alex],
      createdAt: createTimestamp(2),
      updatedAt: createTimestamp(0.95),
      lastMessage: {
        text: 'Phew. Nice work team. Let\'s do a debrief call at 4pm',
        senderId: USERS.sarah,
        timestamp: createTimestamp(0.95),
      },
      lastRead: {
        [USERS.sarah]: createTimestamp(0.95),
        [USERS.alex]: createTimestamp(1),
      },
    });
    
    // Add messages to Thread 2 (with high priority for urgent messages)
    for (const msg of THREAD_2_MESSAGES) {
      const isUrgent = msg.text.includes('URGENT') || msg.text.includes('CRITICAL');
      await thread2Ref.collection('messages').add({
        senderId: USERS[msg.sender],
        text: msg.text,
        createdAt: createTimestamp(msg.time),
        status: 'read',
        priority: isUrgent ? 'high' : 'normal',
      });
    }
    console.log('✅ Thread 2 created with', THREAD_2_MESSAGES.length, 'messages (including urgent ones)\n');
    
    // Create Thread 3: Design Review Discussion
    console.log('🎨 Creating Thread 3: Design Review Discussion...');
    const thread3Ref = db.collection('threads').doc();
    await thread3Ref.set({
      type: 'direct',
      members: [USERS.sarah, USERS.mike],
      createdAt: createTimestamp(24),
      updatedAt: createTimestamp(22.3),
      lastMessage: {
        text: 'Perfect. This is going to make our product stand out. Great work Mike!',
        senderId: USERS.sarah,
        timestamp: createTimestamp(22.3),
      },
      lastRead: {
        [USERS.sarah]: createTimestamp(22.3),
        [USERS.mike]: createTimestamp(22.4),
      },
    });
    
    // Add messages to Thread 3
    for (const msg of THREAD_3_MESSAGES) {
      await thread3Ref.collection('messages').add({
        senderId: USERS[msg.sender],
        text: msg.text,
        createdAt: createTimestamp(msg.time),
        status: 'read',
        priority: 'normal',
      });
    }
    console.log('✅ Thread 3 created with', THREAD_3_MESSAGES.length, 'messages\n');
    
    // Create Thread 4: Meeting Scheduling
    console.log('📅 Creating Thread 4: Meeting Scheduling...');
    const thread4Ref = db.collection('threads').doc();
    await thread4Ref.set({
      type: 'direct',
      members: [USERS.sarah, USERS.alex],
      createdAt: createTimestamp(12),
      updatedAt: createTimestamp(11.2),
      lastMessage: {
        text: 'Perfect. See you tomorrow at 3pm then!',
        senderId: USERS.alex,
        timestamp: createTimestamp(11.2),
      },
      lastRead: {
        [USERS.sarah]: createTimestamp(11.3),
        [USERS.alex]: createTimestamp(11.2),
      },
    });
    
    // Add messages to Thread 4
    for (const msg of THREAD_4_MESSAGES) {
      await thread4Ref.collection('messages').add({
        senderId: USERS[msg.sender],
        text: msg.text,
        createdAt: createTimestamp(msg.time),
        status: 'read',
        priority: 'normal',
      });
    }
    console.log('✅ Thread 4 created with', THREAD_4_MESSAGES.length, 'messages\n');
    
    console.log('🎉 Data seed complete!\n');
    console.log('Summary:');
    console.log('- Thread 1: Product Launch (20 messages) - Tests Summarize, Actions, Decisions');
    console.log('- Thread 2: Urgent Issue (16 messages) - Tests Priority Detection');
    console.log('- Thread 3: Design Review (18 messages) - Tests Semantic Search, Decisions');
    console.log('- Thread 4: Scheduling (9 messages) - Tests Proactive Scheduler');
    console.log('\n✨ Total: 4 threads, 63 realistic messages');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    process.exit(0);
  }
}

// Run the seed function
console.log('🚀 MessageAI Test Data Seeder');
console.log('Persona: Sarah Chen - Startup Product Manager\n');
console.log('⚠️  IMPORTANT: Update USERS object with your actual test user IDs!\n');

seedData();

