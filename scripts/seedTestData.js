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
  sarah: 'JsjSiGt2PUfA6cxqS7LQwYQQ4nz2', // Replace with actual Sarah's user ID
  alex: 'UkTgTexckHT5Vt8NKHzNrkorLIA2',  // Replace with Alex (Engineering Lead) ID
  mike: 'yBqd5d9qEZh9U06KO6uGWDUIm7C3',  // Replace with Mike (Designer) ID
};

// Helper to create timestamps at specific intervals
function createTimestamp(hoursAgo) {
  return admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
  );
}

// Thread 1: Mobile App Redesign (Tests: Summarize, Extract Actions, Decisions)
const THREAD_1_MESSAGES = [
  { sender: 'alex', text: 'Sarah, we need to talk about the mobile app redesign for Q2', time: 48 },
  { sender: 'sarah', text: 'Yes! I\'ve been thinking about this. We\'re targeting March 1st for the beta release', time: 47.5 },
  { sender: 'alex', text: 'That\'s 7 weeks out. What\'s the scope for this redesign?', time: 47 },
  { sender: 'sarah', text: 'Priority features: new onboarding flow, revamped home screen, and push notifications', time: 46.8 },
  { sender: 'alex', text: 'Push notifications will be complex. I\'d estimate 4 weeks minimum for that', time: 46.5 },
  { sender: 'sarah', text: 'Makes sense. Can we kick off the onboarding work this week?', time: 46.3 },
  { sender: 'alex', text: 'Absolutely. I\'ll get Tom started on it. He should finish by next Wednesday', time: 46 },
  { sender: 'sarah', text: 'Perfect! I also need your feedback on the wireframes I shared on Monday', time: 45.8 },
  { sender: 'alex', text: 'I\'ll review them tonight and get back to you by tomorrow afternoon', time: 45.5 },
  { sender: 'sarah', text: 'Thanks. Quick decision needed - are we going with React Native or Flutter?', time: 45.3 },
  { sender: 'alex', text: 'After the team discussion, we\'re going with React Native. Better ecosystem for us', time: 45 },
  { sender: 'sarah', text: 'Great choice. I\'ll inform the stakeholders in tomorrow\'s standup', time: 44.8 },
  { sender: 'alex', text: 'By the way, Mike has the new color scheme ready. Can we review it Wednesday at 3pm?', time: 44.5 },
  { sender: 'sarah', text: 'Wednesday 3pm works perfectly. Send me a meeting link?', time: 44.3 },
  { sender: 'alex', text: 'Will do. I\'ll also bring in the analytics team to discuss tracking requirements', time: 44 },
  { sender: 'sarah', text: 'Good idea. Let\'s also schedule our sprint planning for Tuesday at 10am', time: 43.8 },
  { sender: 'alex', text: 'Sounds good. I\'ll reserve the main conference room and prepare the backlog', time: 43.5 },
  { sender: 'sarah', text: 'Excellent. The stakeholders are really excited about this redesign', time: 43 },
  { sender: 'alex', text: 'Same here. The new notification system is going to boost engagement significantly', time: 42.8 },
  { sender: 'sarah', text: 'Totally agree. Alright, I have a call with marketing. Catch you later!', time: 42.5 },
];

// Thread 2: Critical Security Incident (Tests: Priority Detection, High-Priority Badges)
const THREAD_2_MESSAGES = [
  { sender: 'alex', text: 'URGENT: Security alert - potential data breach detected', time: 2 },
  { sender: 'sarah', text: 'WHAT?! Are you serious? What happened?', time: 1.95 },
  { sender: 'alex', text: 'CRITICAL - Unusual API access patterns. Multiple failed auth attempts from same IP', time: 1.9 },
  { sender: 'sarah', text: 'How many accounts are at risk?', time: 1.85 },
  { sender: 'alex', text: 'Potentially 200+ accounts. The attacker was trying brute force on admin endpoints', time: 1.8 },
  { sender: 'sarah', text: 'Block that IP immediately! Get security team on a war room call NOW', time: 1.75 },
  { sender: 'alex', text: 'IP blocked. Tom and Maria are already investigating. Checking access logs now', time: 1.7 },
  { sender: 'sarah', text: 'URGENT: Do we need to notify affected users? Legal team needs to know', time: 1.65 },
  { sender: 'alex', text: 'Let me confirm if any data was actually accessed first. Checking now', time: 1.6 },
  { sender: 'sarah', text: 'Okay. I\'m calling our security consultant. Update me ASAP', time: 1.55 },
  { sender: 'alex', text: 'Good news - no data was compromised! All attempts were blocked by rate limiting', time: 1.3 },
  { sender: 'sarah', text: 'Thank god. But we need to strengthen our security immediately', time: 1.25 },
  { sender: 'alex', text: 'Agreed. I\'m implementing 2FA for all admin accounts today', time: 1.2 },
  { sender: 'sarah', text: 'Perfect. I\'ll write up the incident report for the board. We dodged a bullet', time: 1.15 },
  { sender: 'alex', text: 'All security measures updated. Adding additional monitoring alerts too', time: 1 },
  { sender: 'sarah', text: 'Excellent response time. Let\'s do a security review meeting tomorrow at 2pm', time: 0.95 },
];

// Thread 3: UX Research Findings (Tests: Semantic Search, Decisions)
const THREAD_3_MESSAGES = [
  { sender: 'mike', text: 'Sarah! Just finished analyzing the user research data. Have some interesting insights', time: 24 },
  { sender: 'sarah', text: 'Perfect timing! I\'m all ears. What did you discover?', time: 23.9 },
  { sender: 'mike', text: 'Sent you the report. The key finding: users want a simplified navigation menu', time: 23.8 },
  { sender: 'sarah', text: 'Interesting! Our current menu does have too many options. What\'s the recommendation?', time: 23.7 },
  { sender: 'mike', text: 'Consolidate from 8 menu items down to 5. Use a clean icon-based approach', time: 23.6 },
  { sender: 'sarah', text: 'I like it. But we need to ensure accessibility - can we add text labels too?', time: 23.5 },
  { sender: 'mike', text: 'Absolutely. I\'ll design it with icons + labels. Also, users want better search functionality', time: 23.4 },
  { sender: 'sarah', text: 'Search is crucial. Can we add autocomplete and recent searches?', time: 23.3 },
  { sender: 'mike', text: 'Yes! I\'ve already mocked that up. Also thinking we should add keyboard shortcuts', time: 23.2 },
  { sender: 'sarah', text: 'Love it! Power users will appreciate that. What about mobile?', time: 23.1 },
  { sender: 'mike', text: 'Mobile users want a bottom navigation bar instead of hamburger menu', time: 23 },
  { sender: 'sarah', text: 'That makes sense. Let\'s implement that. Can you have mockups ready by Thursday?', time: 22.9 },
  { sender: 'mike', text: 'Definitely. I\'ll prepare both light and dark theme versions', time: 22.8 },
  { sender: 'sarah', text: 'Perfect. One more thing - should we keep the current color scheme or refresh it?', time: 22.7 },
  { sender: 'mike', text: 'Users actually love our current colors. I\'d say keep them but maybe adjust contrast ratios', time: 22.6 },
  { sender: 'sarah', text: 'Good call. Let\'s stick with our brand colors. They\'re working well', time: 22.5 },
  { sender: 'mike', text: 'Agreed. I\'ll finalize the designs and share the full prototype by end of week', time: 22.4 },
  { sender: 'sarah', text: 'Fantastic work on this research, Mike. This will really improve our UX!', time: 22.3 },
];

// Thread 4: Team Coordination (Tests: Proactive Scheduler)
const THREAD_4_MESSAGES = [
  { sender: 'alex', text: 'Sarah, we should schedule our quarterly planning session soon', time: 12 },
  { sender: 'sarah', text: 'Yes! When are you thinking?', time: 11.9 },
  { sender: 'alex', text: 'How about next Monday morning? Maybe 10am?', time: 11.8 },
  { sender: 'sarah', text: 'Monday 10am works for me! Can you check if Mike can join?', time: 11.7 },
  { sender: 'alex', text: 'Will do. Also, we need to book time for the client presentation. Next Thursday at 2pm?', time: 11.6 },
  { sender: 'sarah', text: 'Thursday 2pm is perfect. I\'ll create the meeting and share the deck', time: 11.5 },
  { sender: 'alex', text: 'Great. And should we do a team celebration dinner this Friday? Everyone\'s been working hard', time: 11.4 },
  { sender: 'sarah', text: 'Love that idea! Friday evening at 7pm? There\'s a great Italian place downtown', time: 11.3 },
  { sender: 'alex', text: 'Perfect! I\'ll make a reservation. See you Monday at 10am!', time: 11.2 },
];

async function seedData() {
  console.log('🌱 Starting data seed...\n');
  
  try {
    // Create Thread 1: Mobile App Redesign
    console.log('📝 Creating Thread 1: Mobile App Redesign...');
    const thread1Ref = db.collection('threads').doc();
    await thread1Ref.set({
      type: 'direct',
      members: [USERS.sarah, USERS.alex],
      createdAt: createTimestamp(48),
      updatedAt: createTimestamp(42.5),
      lastMessage: {
        text: 'Totally agree. Alright, I have a call with marketing. Catch you later!',
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
    
    // Create Thread 2: Critical Security Incident
    console.log('🚨 Creating Thread 2: Critical Security Incident...');
    const thread2Ref = db.collection('threads').doc();
    await thread2Ref.set({
      type: 'direct',
      members: [USERS.sarah, USERS.alex],
      createdAt: createTimestamp(2),
      updatedAt: createTimestamp(0.95),
      lastMessage: {
        text: 'Excellent response time. Let\'s do a security review meeting tomorrow at 2pm',
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
    
    // Create Thread 3: UX Research Findings
    console.log('🎨 Creating Thread 3: UX Research Findings...');
    const thread3Ref = db.collection('threads').doc();
    await thread3Ref.set({
      type: 'direct',
      members: [USERS.sarah, USERS.mike],
      createdAt: createTimestamp(24),
      updatedAt: createTimestamp(22.3),
      lastMessage: {
        text: 'Fantastic work on this research, Mike. This will really improve our UX!',
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
    
    // Create Thread 4: Team Coordination
    console.log('📅 Creating Thread 4: Team Coordination...');
    const thread4Ref = db.collection('threads').doc();
    await thread4Ref.set({
      type: 'direct',
      members: [USERS.sarah, USERS.alex],
      createdAt: createTimestamp(12),
      updatedAt: createTimestamp(11.2),
      lastMessage: {
        text: 'Perfect! I\'ll make a reservation. See you Monday at 10am!',
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
    console.log('- Thread 1: Mobile App Redesign (20 messages) - Tests Summarize, Actions, Decisions');
    console.log('- Thread 2: Security Incident (16 messages) - Tests Priority Detection');
    console.log('- Thread 3: UX Research (18 messages) - Tests Semantic Search, Decisions');
    console.log('- Thread 4: Team Coordination (9 messages) - Tests Proactive Scheduler');
    console.log('\n✨ Total: 4 threads, 63 fresh realistic messages');
    
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

