import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, LogBox } from 'react-native';
import Toast from 'react-native-toast-message';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { useStore } from './src/state/store';
import { useAuth } from './src/hooks/useAuth';
import { usePresence } from './src/hooks/usePresence';
import { useInAppNotifications } from './src/hooks/useInAppNotifications';
import { initializeOfflineQueue } from './src/state/offlineQueue';
import LoginScreen from './src/screens/LoginScreen';
import ThreadsScreen from './src/screens/ThreadsScreen';
import NewChatScreen from './src/screens/NewChatScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SearchScreen from './src/screens/SearchScreen';
import DecisionsScreen from './src/screens/DecisionsScreen';
import LoadTestScreen from './src/screens/LoadTestScreen';

// Suppress specific warnings/errors
LogBox.ignoreLogs([
  'Text strings must be rendered within a <Text> component',
  'Non-serializable values were found in the navigation state',
]);

const Stack = createNativeStackNavigator();

function AppContent() {
  const { user } = useAuth();
  const { isLoading } = useStore();
  
  // Reconnect service disabled - causes conflicts with offline queue
  // useEffect(() => {
  //   const unsubscribe = initializeReconnectService();
  //   return () => unsubscribe();
  // }, []);
  
  // Initialize offline queue system
  useEffect(() => {
    initializeOfflineQueue();
  }, []);
  
  // Update presence only when logged in
  usePresence(user?.uid || null);
  
  // Listen for new messages and show toast notifications
  useInAppNotifications(user?.uid || null);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          {!user ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
            <Stack.Screen name="Threads" component={ThreadsScreen} />
            <Stack.Screen 
              name="NewChat" 
              component={NewChatScreen}
              options={{
                headerShown: true,
                title: 'New Chat',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen 
              name="Chat" 
              component={ChatScreen}
              options={{
                headerShown: true,
                headerBackTitle: 'Back',
              }}
            />
              <Stack.Screen 
                name="Profile" 
                component={ProfileScreen}
              />
              <Stack.Screen 
                name="Search" 
                component={SearchScreen}
              />
              <Stack.Screen 
                name="Decisions" 
                component={DecisionsScreen}
              />
              <Stack.Screen 
                name="LoadTest" 
                component={LoadTestScreen}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

