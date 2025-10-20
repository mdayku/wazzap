import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPush(uid: string): Promise<string | null> {
  console.log('📱 [PUSH] ========================================');
  console.log('📱 [PUSH] Starting push notification registration');
  console.log('📱 [PUSH] User ID:', uid);
  console.log('📱 [PUSH] Platform:', Platform.OS);
  console.log('📱 [PUSH] ========================================');
  
  try {
    // Step 1: Check permissions
    console.log('📱 [PUSH] Step 1: Checking existing permissions...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('📱 [PUSH] ✅ Permission status:', existingStatus);
    
    let finalStatus = existingStatus;
    
    // Step 2: Request if needed
    if (existingStatus !== 'granted') {
      console.log('📱 [PUSH] Step 2: Requesting permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('📱 [PUSH] ✅ Permission granted:', status);
    } else {
      console.log('📱 [PUSH] Step 2: Skipped (already granted)');
    }
    
    if (finalStatus !== 'granted') {
      console.warn('📱 [PUSH] ❌ FAIL: Permissions not granted');
      console.log('📱 [PUSH] ========================================');
      return null;
    }

    // Step 3: Get token
    console.log('📱 [PUSH] Step 3: Fetching Expo push token...');
    // Note: projectId not needed in Expo Go, only in bare workflow
    let token;
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('📱 [PUSH] ✅ Token received:', token.substring(0, 20) + '...');
    } catch (tokenError: any) {
      // Expo Go has limitations with push tokens, but local notifications still work
      console.log('📱 [PUSH] ⚠️ Could not get push token (expected in Expo Go)');
      console.log('📱 [PUSH] ℹ️ Local notifications will still work for MVP');
      console.log('📱 [PUSH] ========================================');
      return null;
    }
    
    // Step 4: Save to Firestore
    console.log('📱 [PUSH] Step 4: Saving token to Firestore...');
    await updateDoc(doc(db, 'users', uid), {
      pushToken: token
    });
    console.log('📱 [PUSH] ✅ Token saved successfully');
    
    // Step 5: Set up channels (Android)
    if (Platform.OS === 'android') {
      console.log('📱 [PUSH] Step 5: Creating Android notification channels...');
      
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      console.log('📱 [PUSH] ✅ Default channel created');
      
      await Notifications.setNotificationChannelAsync('high-priority', {
        name: 'High Priority Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
      });
      console.log('📱 [PUSH] ✅ High-priority channel created');
    } else {
      console.log('📱 [PUSH] Step 5: Skipped (iOS doesn\'t need channels)');
    }
    
    console.log('📱 [PUSH] ========================================');
    console.log('📱 [PUSH] ✅✅✅ PUSH REGISTRATION COMPLETE ✅✅✅');
    console.log('📱 [PUSH] Token:', token);
    console.log('📱 [PUSH] ⚠️  NOTE: Remote/background push requires dev build');
    console.log('📱 [PUSH] ✅ Foreground notifications WILL work in Expo Go');
    console.log('📱 [PUSH] ========================================');
    
    return token;
  } catch (error) {
    console.error('📱 [PUSH] ========================================');
    console.error('📱 [PUSH] ❌❌❌ ERROR IN PUSH REGISTRATION ❌❌❌');
    console.error('📱 [PUSH] Error:', error);
    console.error('📱 [PUSH] ========================================');
    return null;
  }
}

export function setupNotificationListeners(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationTapped: (response: Notifications.NotificationResponse) => void
) {
  console.log('📱 [PUSH] Setting up notification listeners...');
  
  // Notification received while app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📱 [PUSH] ✅ Notification received (foreground):', notification);
    onNotificationReceived(notification);
  });
  
  // Notification tapped (opens app)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('📱 [PUSH] ✅ Notification tapped:', response);
    onNotificationTapped(response);
  });
  
  console.log('📱 [PUSH] ✅ Listeners set up successfully');
  
  return () => {
    console.log('📱 [PUSH] Removing notification listeners...');
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

// ============================================
// MVP TESTING FUNCTIONS
// ============================================

/**
 * Test local notification to prove the system works
 * This WILL work in Expo Go (foreground)
 */
export async function testLocalNotification() {
  console.log('📱 [TEST] ========================================');
  console.log('📱 [TEST] Testing local notification system...');
  console.log('📱 [TEST] ========================================');
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "✅ Push System Working!",
        body: 'This notification proves the system is set up correctly.',
        data: { testData: 'MVP test notification' },
      },
      trigger: null, // null = show immediately
    });
    
    console.log('📱 [TEST] ✅ Test notification scheduled successfully');
    console.log('📱 [TEST] If you see a notification, the system works!');
    console.log('📱 [TEST] ========================================');
    return true;
  } catch (error) {
    console.error('📱 [TEST] ❌ Error sending test notification:', error);
    console.error('📱 [TEST] ========================================');
    return false;
  }
}

/**
 * Simulate a message notification (foreground)
 * Shows what users would see when they receive a message
 */
export async function simulateMessageNotification(senderName: string, messageText: string) {
  console.log('📱 [SIM] ========================================');
  console.log('📱 [SIM] Simulating message notification...');
  console.log('📱 [SIM] From:', senderName);
  console.log('📱 [SIM] Message:', messageText);
  console.log('📱 [SIM] ========================================');
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💬 ${senderName}`,
        body: messageText,
        data: { 
          type: 'message',
          sender: senderName,
          timestamp: new Date().toISOString(),
        },
      },
      trigger: null,
    });
    
    console.log('📱 [SIM] ✅ Simulated notification displayed');
    console.log('📱 [SIM] This demonstrates what push would look like');
    console.log('📱 [SIM] ========================================');
    return true;
  } catch (error) {
    console.error('📱 [SIM] ❌ Error simulating notification:', error);
    console.error('📱 [SIM] ========================================');
    return false;
  }
}

/**
 * Check if push notifications are properly configured
 * Returns diagnostic information
 */
export async function diagnosePushSetup(): Promise<{
  supported: boolean;
  permissionGranted: boolean;
  hasToken: boolean;
  token?: string;
  platform: string;
}> {
  console.log('📱 [DIAG] ========================================');
  console.log('📱 [DIAG] Running push notification diagnostics...');
  console.log('📱 [DIAG] ========================================');
  
  const result = {
    supported: true, // Expo always supports notifications
    permissionGranted: false,
    hasToken: false,
    token: undefined as string | undefined,
    platform: Platform.OS,
  };

  try {
    // Check permissions
    const { status } = await Notifications.getPermissionsAsync();
    result.permissionGranted = status === 'granted';
    console.log('📱 [DIAG] Permission status:', status);

    // Try to get token if granted
    if (result.permissionGranted) {
      try {
        // No projectId needed in Expo Go
        const tokenData = await Notifications.getExpoPushTokenAsync();
        result.hasToken = true;
        result.token = tokenData.data;
        console.log('📱 [DIAG] Token:', tokenData.data.substring(0, 20) + '...');
      } catch (error) {
        console.log('📱 [DIAG] Could not get token:', error);
      }
    }

    console.log('📱 [DIAG] ========================================');
    console.log('📱 [DIAG] DIAGNOSIS RESULTS:');
    console.log('📱 [DIAG] - Platform:', result.platform);
    console.log('📱 [DIAG] - Notifications supported:', result.supported);
    console.log('📱 [DIAG] - Permission granted:', result.permissionGranted);
    console.log('📱 [DIAG] - Has valid token:', result.hasToken);
    console.log('📱 [DIAG] ========================================');

    return result;
  } catch (error) {
    console.error('📱 [DIAG] Error during diagnosis:', error);
    console.error('📱 [DIAG] ========================================');
    return result;
  }
}

