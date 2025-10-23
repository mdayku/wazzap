import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';

const CREDENTIALS_KEY = '@messageai:credentials_list';

interface SavedCredential {
  email: string;
  password: string;
  displayName?: string;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [savedCredentials, setSavedCredentials] = useState<SavedCredential[]>([]);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  
  const { login, signup } = useAuth();

  // Load saved credentials on mount
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const saved = await AsyncStorage.getItem(CREDENTIALS_KEY);
      if (saved) {
        const credentials: SavedCredential[] = JSON.parse(saved);
        setSavedCredentials(credentials);
        
        // Auto-fill with most recent (first in list)
        if (credentials.length > 0) {
          const mostRecent = credentials[0];
          setEmail(mostRecent.email);
          setPassword(mostRecent.password);
          setRememberMe(true);
          console.log('📝 Credentials loaded - ready to login');
        }
      }
    } catch (error) {
      console.log('No saved credentials found');
    }
  };

  const saveCredentials = async (email: string, password: string, displayName?: string) => {
    try {
      // Remove existing entry for this email
      const filtered = savedCredentials.filter(c => c.email !== email);
      
      // Add to front of list (most recent)
      const updated = [{ email, password, displayName }, ...filtered];
      
      // Keep only last 5 users
      const limited = updated.slice(0, 5);
      
      await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(limited));
      setSavedCredentials(limited);
      console.log('✅ Credentials saved');
    } catch (error) {
      console.error('Error saving credentials:', error);
    }
  };

    const _clearAllCredentials = async () => {
    try {
      await AsyncStorage.removeItem(CREDENTIALS_KEY);
      setSavedCredentials([]);
      console.log('🗑️ All credentials cleared');
    } catch (error) {
      console.error('Error clearing credentials:', error);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (isSignup && !displayName) {
      Alert.alert('Error', 'Please enter your display name');
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password, displayName);
        if (rememberMe) {
          await saveCredentials(email, password, displayName);
        }
      } else {
        await login(email, password);
        if (rememberMe) {
          await saveCredentials(email, password);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectCredential = (credential: SavedCredential) => {
    setEmail(credential.email);
    setPassword(credential.password);
    setShowCredentialsModal(false);
    setRememberMe(true);
  };

  const renderCredentialItem = ({ item }: { item: SavedCredential }) => (
    <TouchableOpacity
      style={styles.credentialItem}
      onPress={() => selectCredential(item)}
    >
      <View style={styles.credentialAvatar}>
        <Text style={styles.credentialAvatarText}>
          {item.displayName?.charAt(0).toUpperCase() || item.email.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.credentialInfo}>
        <Text style={styles.credentialName}>{item.displayName || 'User'}</Text>
        <Text style={styles.credentialEmail}>{item.email}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{isSignup ? 'Create Account' : 'Welcome Back'}</Text>
        <Text style={styles.subtitle}>
          {isSignup ? 'Sign up to get started' : 'Sign in to continue'}
        </Text>

        {/* Saved Users Button */}
        {savedCredentials.length > 0 && !isSignup && (
          <TouchableOpacity
            style={styles.savedUsersButton}
            onPress={() => setShowCredentialsModal(true)}
          >
            <Text style={styles.savedUsersText}>
              👤 {savedCredentials.length} Saved User{savedCredentials.length > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}

        {isSignup && (
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setRememberMe(!rememberMe)}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Remember me</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignup ? 'Sign Up' : 'Log In'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setIsSignup(!isSignup)}
        >
          <Text style={styles.switchButtonText}>
            {isSignup ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>

      </View>

      {/* Saved Credentials Modal */}
      <Modal
        visible={showCredentialsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCredentialsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select User</Text>
            
            <FlatList
              data={savedCredentials}
              renderItem={renderCredentialItem}
              keyExtractor={(item, index) => `${item.email}-${index}`}
              style={styles.credentialsList}
            />

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCredentialsModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  savedUsersButton: {
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  savedUsersText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#F2F2F7',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#000000',
  },
  button: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  switchButton: {
    padding: 12,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  credentialsList: {
    maxHeight: 300,
  },
  credentialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F2F2F7',
  },
  credentialAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  credentialAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  credentialInfo: {
    flex: 1,
  },
  credentialName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  credentialEmail: {
    fontSize: 14,
    color: '#666',
  },
  modalCloseButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});
