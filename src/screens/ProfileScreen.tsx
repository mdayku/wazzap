import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  ScrollView,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadImage } from '../services/storage';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { testLocalNotification } from '../services/notifications';
import { useNavigation } from '@react-navigation/native';
import { useThreads } from '../hooks/useThread';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, colors } = useTheme();
  const navigation = useNavigation();
  const { threads } = useThreads(user?.uid || '');
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showThreadPicker, setShowThreadPicker] = useState(false);
  const [userCache, setUserCache] = useState<{ [key: string]: any }>({});
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  // Fetch user data for all thread members to display names
  useEffect(() => {
    if (!threads || threads.length === 0) return;
    
    const fetchUserData = async () => {
      const uniqueUserIds = new Set<string>();
      threads.forEach(thread => {
        if (thread.members && Array.isArray(thread.members)) {
          thread.members.forEach(memberId => {
            if (memberId !== user?.uid) {
              uniqueUserIds.add(memberId);
            }
          });
        }
      });
      
      const newUserCache: { [key: string]: any } = { ...userCache };
      for (const userId of uniqueUserIds) {
        if (!newUserCache[userId]) {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              newUserCache[userId] = userDoc.data();
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
          }
        }
      }
      setUserCache(newUserCache);
    };
    
    fetchUserData();
  }, [threads, user?.uid]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setDisplayName(data.displayName || '');
        setPhotoURL(data.photoURL || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSave = async () => {
    if (!user || !displayName.trim()) {
      Alert.alert('Error', 'Display name is required');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
      });
      Alert.alert('Success', 'Profile updated');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        setPreviewImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      // Resize profile photo to 400x400 and compress
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      return manipResult.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri; // Return original if compression fails
    }
  };

  const handleSavePhoto = async () => {
    if (!previewImage || !user) return;
    
    setUploading(true);
    try {
      // Compress image before uploading
      console.log('📸 [PROFILE] Compressing profile photo...');
      const compressed = await compressImage(previewImage);
      
      const path = `profiles/${user.uid}/avatar.jpg`;
      const url = await uploadImage(compressed, path);
      
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: url,
      });
      
      setPhotoURL(url);
      setPreviewImage(null);
      Alert.alert('✅ Success', 'Profile photo updated!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const getThreadDisplayName = (thread: any) => {
    if (thread.name) return thread.name; // Group chat
    
    // 1:1 chat - get other user's name
    const otherMember = thread.members?.find((m: string) => m !== user?.uid);
    if (otherMember && userCache[otherMember]) {
      return userCache[otherMember].displayName || 'User';
    }
    return 'Chat';
  };

  const handleSelectThread = (threadId: string) => {
    setShowThreadPicker(false);
    navigation.navigate('LoadTest' as never, { threadId, userId: user?.uid } as never);
  };

  const handleCancelPhoto = () => {
    setPreviewImage(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity onPress={handleImagePick} disabled={uploading}>
          <View style={styles.avatarContainer}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {displayName ? displayName.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            )}
          </View>
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </TouchableOpacity>

          <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
          />

          <Text style={[styles.label, { color: colors.text }]}>Email</Text>
          <Text style={[styles.emailText, { color: colors.textSecondary }]}>{user?.email}</Text>

          <View style={styles.settingRow}>
            <View>
              <Text style={[styles.label, { color: colors.text }]}>Dark Mode</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {theme === 'dark' ? 'Dark theme enabled' : 'Light theme enabled'}
              </Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: '#E5E5EA', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={async () => {
              const success = await testLocalNotification();
              if (success) {
                Alert.alert('✅ Success', 'Notification sent! Check your notification tray.');
              } else {
                Alert.alert('❌ Error', 'Failed to send notification');
              }
            }}
          >
            <Text style={styles.testButtonText}>📱 Test Push Notification (MVP)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={() => setShowThreadPicker(true)}
          >
            <Text style={styles.testButtonText}>⚡ Load Test (Performance)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              setLoggingOut(true);
              try {
                await logout();
              } catch (error) {
                console.error('Logout error:', error);
                Alert.alert('Logout Error', 'Failed to logout. Please try again.');
                setLoggingOut(false);
              }
            }}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator color="#FF3B30" />
            ) : (
              <Text style={styles.logoutText}>Logout</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Photo Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelPhoto}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>Set as profile photo?</Text>
            
            {previewImage && (
              <Image 
                source={{ uri: previewImage }} 
                style={styles.previewImage}
                resizeMode="cover"
              />
            )}
            
            <View style={styles.previewButtons}>
              <TouchableOpacity 
                style={[styles.previewButton, styles.cancelButton]} 
                onPress={handleCancelPhoto}
                disabled={uploading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.previewButton, styles.confirmButton]} 
                onPress={handleSavePhoto}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Save Photo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Thread Picker Modal for Load Test */}
      <Modal
        visible={showThreadPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowThreadPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.threadPickerContainer, { backgroundColor: colors.background }]}>
            <View style={styles.threadPickerHeader}>
              <Text style={[styles.threadPickerTitle, { color: colors.text }]}>
                Select a Thread for Load Test
              </Text>
              <TouchableOpacity onPress={() => setShowThreadPicker(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.threadList}>
              {threads.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    No threads available. Create a chat first!
                  </Text>
                </View>
              ) : (
                threads.map((thread) => (
                  <TouchableOpacity
                    key={thread.id}
                    style={[styles.threadItem, { borderBottomColor: colors.border }]}
                    onPress={() => handleSelectThread(thread.id)}
                  >
                    <View style={styles.threadItemContent}>
                      <Ionicons 
                        name={thread.members && thread.members.length > 2 ? "people" : "person"} 
                        size={24} 
                        color={colors.primary} 
                      />
                      <Text style={[styles.threadItemName, { color: colors.text }]}>
                        {getThreadDisplayName(thread)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  content: {
    flex: 1,
    paddingTop: 32,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 48,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    textAlign: 'center',
    color: '#007AFF',
    fontSize: 16,
    marginBottom: 32,
  },
  form: {
    paddingHorizontal: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 24,
    fontSize: 16,
    backgroundColor: '#F2F2F7',
  },
  emailText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 8,
  },
  settingDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  button: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  testButton: {
    marginTop: 24,
    height: 50,
    backgroundColor: '#34C759',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 24,
    padding: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000000',
  },
  previewImage: {
    width: 300,
    height: 300,
    borderRadius: 150,
    marginBottom: 20,
  },
  previewButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  previewButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  threadPickerContainer: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: 12,
    padding: 20,
  },
  threadPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  threadPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  threadList: {
    maxHeight: 400,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
  },
  threadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  threadItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  threadItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
});

