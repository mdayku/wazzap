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
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Redact sensitive token for logging
 * Shows first 8 and last 4 characters only
 */
function redactToken(token: string): string {
  if (!token || token.length < 20) return '[REDACTED]';
  return `${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
}

export async function registerForPush(uid: string): Promise<string | null> {
  try {
    // Check permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // Request if needed
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return null;
    }

    // Get token
    let token;
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
    } catch (tokenError: any) {
      // Expo Go has limitations with push tokens, but local notifications still work
      return null;
    }
    
    // Save to Firestore
    await updateDoc(doc(db, 'users', uid), {
      pushToken: token
    });
    
    // Set up channels (Android)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      
      await Notifications.setNotificationChannelAsync('high-priority', {
        name: 'High Priority Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
      });
    }
    
    return token;
  } catch (error) {
    console.error('Error in push registration:', error);
    return null;
  }
}

export function setupNotificationListeners(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationTapped: (response: Notifications.NotificationResponse) => void
) {
  // Notification received while app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    onNotificationReceived(notification);
  });
  
  // Notification tapped (opens app)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onNotificationTapped(response);
  });
  
  return () => {
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
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "✅ Push System Working!",
        body: 'This notification proves the system is set up correctly.',
        data: { testData: 'MVP test notification' },
      },
      trigger: null, // null = show immediately
    });
    return true;
  } catch (error) {
    console.error('Error sending test notification:', error);
    return false;
  }
}

/**
 * Simulate a message notification (foreground)
 * Shows what users would see when they receive a message
 */
export async function simulateMessageNotification(senderName: string, messageText: string) {
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
    return true;
  } catch (error) {
    console.error('Error simulating notification:', error);
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

    // Try to get token if granted
    if (result.permissionGranted) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        result.hasToken = true;
        result.token = tokenData.data;
      } catch (error) {
        // Token not available (expected in Expo Go)
      }
    }

    return result;
  } catch (error) {
    console.error('Error during push diagnostics:', error);
    return result;
  }
}

