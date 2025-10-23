import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Text, Alert, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { sendMessageOptimistic } from '../state/offlineQueue';
import { uploadImage } from '../services/storage';
import ImagePreviewModal, { type ImagePreviewItem } from './ImagePreviewModal';

interface ComposerProps {
  threadId: string;
  uid: string;
  onTyping?: (isTyping: boolean) => void;
  onSlashCommand?: (command: string) => void;
}

const SLASH_COMMANDS = [
  { command: '/summarize', description: 'Generate thread summary', icon: 'document-text-outline' },
  { command: '/actions', description: 'Extract action items', icon: 'checkbox-outline' },
  { command: '/search', description: 'Semantic search', icon: 'search-outline' },
  { command: '/decisions', description: 'View decisions', icon: 'checkmark-circle-outline' },
];

export default function Composer({ threadId, uid, onTyping, onSlashCommand }: ComposerProps) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(SLASH_COMMANDS);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ImagePreviewItem[]>([]);
  const [compressionQuality, setCompressionQuality] = useState<'high' | 'medium' | 'low'>('medium');

  const getDraftKey = useCallback(() => `draft_${threadId}_${uid}`, [threadId, uid]);

  const loadDraft = useCallback(async () => {
    try {
      const draft = await AsyncStorage.getItem(getDraftKey());
      if (draft) {
        setText(draft);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  }, [getDraftKey]);

  const saveDraft = useCallback(async (draftText: string) => {
    try {
      if (draftText.trim()) {
        await AsyncStorage.setItem(getDraftKey(), draftText);
      } else {
        // Clear draft if text is empty
        await AsyncStorage.removeItem(getDraftKey());
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [getDraftKey]);

  // Load draft message when component mounts
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // Save draft whenever text changes
  useEffect(() => {
    saveDraft(text);
  }, [text, saveDraft]);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  const clearDraft = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(getDraftKey());
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [getDraftKey]);

  const handleSlashCommandSelect = (command: string) => {
    setText('');
    setShowSlashMenu(false);
    if (onSlashCommand) {
      onSlashCommand(command);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (clipboardText) {
        setText(prev => prev + clipboardText);
        Alert.alert('Pasted', 'Text pasted from clipboard');
      } else {
        Alert.alert('Clipboard Empty', 'No text found in clipboard');
      }
    } catch (error) {
      console.error('Error pasting from clipboard:', error);
      Alert.alert('Error', 'Failed to paste from clipboard');
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    
    // Check for slash commands
    if (newText.startsWith('/') && !newText.includes(' ')) {
      const query = newText.toLowerCase();
      const filtered = SLASH_COMMANDS.filter(cmd => 
        cmd.command.startsWith(query)
      );
      setFilteredCommands(filtered);
      setShowSlashMenu(filtered.length > 0);
    } else {
      setShowSlashMenu(false);
    }
    
    const isTyping = newText.length > 0;
    
    // Notify typing
    if (onTyping) {
      onTyping(isTyping);
    }
    
    // Clear typing after 3 seconds of inactivity
    if (typingTimeout) clearTimeout(typingTimeout);
    const timeout = setTimeout(() => {
      onTyping?.(false);
    }, 3000);
    setTypingTimeout(timeout);
  };

  const handleSend = async () => {
    if (!text.trim() && !uploading) return;
    
    // Haptic feedback on send
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const messageText = text.trim();
    setText('');
    onTyping?.(false);
    
    try {
      const tempId = `${Date.now()}_${Math.random()}`;
      await sendMessageOptimistic({ threadId, text: messageText, tempId }, uid);
      // Clear draft after successful send
      await clearDraft();
    } catch (error) {
      console.error('Error sending message:', error);
      // Could show error toast here
    }
  };

  const compressImage = async (uri: string): Promise<{ uri: string; width: number; height: number }> => {
    try {
      // Resize image to max 1200px width while maintaining aspect ratio
      // And compress to 70% quality to reduce file size
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Maintains aspect ratio
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      return {
        uri: manipResult.uri,
        width: manipResult.width,
        height: manipResult.height,
      };
    } catch (error) {
      console.error('Error compressing image:', error);
      // Return original if compression fails
      return { uri, width: 800, height: 600 };
    }
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true, // Changed from allowsMultiple
        selectionLimit: 10,
        quality: 1, // We'll compress later based on user selection
      });

      if (!result.canceled && result.assets.length > 0) {
        // Prepare images for preview
        const images: ImagePreviewItem[] = result.assets.map(asset => ({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
        }));
        
        setSelectedImages(images);
        setShowImagePreview(true);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to select images. Please try again.');
    }
  };

  const handleCameraLaunch = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permission to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 1, // We'll compress later based on user selection
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Show preview for camera photos too
        const images: ImagePreviewItem[] = [{
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
        }];
        
        setSelectedImages(images);
        setShowImagePreview(true);
      }
    } catch (error) {
      console.error('Error launching camera:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const handleLocationShare = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant location permission to share your location.');
        return;
      }

      // Show loading indicator in chat
      setUploading(true);

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Reverse geocode to get address
      let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode && geocode[0]) {
          const place = geocode[0];
          address = [
            place.name,
            place.street,
            place.city,
            place.region,
            place.country
          ].filter(Boolean).join(', ');
        }
      } catch (geocodeError) {
        console.log('Geocoding failed, using coordinates');
      }

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Send location message
      const tempId = `${Date.now()}_${Math.random()}`;
      await sendMessageOptimistic(
        {
          threadId,
          tempId,
          text: `📍 ${address}`,
          media: {
            type: 'location',
            url: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
            latitude,
            longitude,
            address,
          },
        },
        uid
      );
    } catch (error) {
      console.error('Error sharing location:', error);
      Alert.alert('Error', 'Failed to get location. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSendImage = async (imageUri: string) => {
    setUploading(true);
    try {
      // Compress image before uploading
      const compressed = await compressImage(imageUri);
      
      // Haptic feedback on send
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const tempId = `${Date.now()}_${Math.random()}`;
      
      // Check network status first to avoid hanging
      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected && netInfo.isInternetReachable !== false;
      
      if (!isOnline) {
        // Offline - queue immediately with local URI
        // eslint-disable-next-line no-console
        console.log('📴 [COMPOSER] Offline, queueing image with local URI');
        await sendMessageOptimistic(
          { 
            threadId, 
            text: text.trim() || '',
            media: null, // Will be set after upload
            tempId 
          }, 
          uid,
          compressed.uri, // Local URI
          'image', // Media type
          { width: compressed.width, height: compressed.height } // Metadata
        );
      } else {
        // Online - try to upload
        const timestamp = Date.now();
        const path = `messages/${uid}/${timestamp}.jpg`;
        
        try {
          const url = await uploadImage(compressed.uri, path);
          
          // Send with uploaded URL
          await sendMessageOptimistic(
            { 
              threadId, 
              text: text.trim() || '',
              media: { type: 'image', url, width: compressed.width, height: compressed.height },
              tempId 
            }, 
            uid
          );
        } catch (uploadError: unknown) {
          // Upload failed - queue with local URI for later upload
          // eslint-disable-next-line no-console
          console.log('📴 [COMPOSER] Image upload failed, queueing with local URI');
          await sendMessageOptimistic(
            { 
              threadId, 
              text: text.trim() || '',
              media: null, // Will be set after upload
              tempId 
            }, 
            uid,
            compressed.uri, // Local URI
            'image', // Media type
            { width: compressed.width, height: compressed.height } // Metadata
          );
        }
      }
      
      setText('');
      // Clear draft after successful send
      await clearDraft();
    } catch (error) {
      console.error('Error sending image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSendImages = async (images: ImagePreviewItem[], caption?: string) => {
    setShowImagePreview(false);
    setUploading(true);

    try {
      // Send each image as a separate message
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const tempId = `${Date.now()}_${Math.random()}`;
        
        // Check network status
        const netInfo = await NetInfo.fetch();
        const isOnline = netInfo.isConnected && netInfo.isInternetReachable !== false;
        
        // Only add caption to first image
        const messageText = (i === 0 && caption) ? caption : '';
        
        if (!isOnline) {
          // Offline - queue with local URI
          await sendMessageOptimistic(
            { 
              threadId, 
              text: messageText,
              media: null, // Will be set after upload
              tempId 
            }, 
            uid,
            img.uri, // Local URI
            'image',
            { width: img.width, height: img.height }
          );
        } else {
          // Online - upload and send
          try {
            const timestamp = Date.now();
            const path = `messages/${uid}/${timestamp}_${i}.jpg`;
            const url = await uploadImage(img.uri, path);
            
            await sendMessageOptimistic(
              { 
                threadId, 
                text: messageText,
                media: { type: 'image', url, width: img.width, height: img.height },
                tempId 
              }, 
              uid
            );
          } catch (uploadError) {
            // Upload failed - queue with local URI
            await sendMessageOptimistic(
              { 
                threadId, 
                text: messageText,
                media: null,
                tempId 
              }, 
              uid,
              img.uri,
              'image',
              { width: img.width, height: img.height }
            );
          }
        }
      }
      
      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setSelectedImages([]);
    } catch (error) {
      console.error('Error uploading images:', error);
      Alert.alert('Error', 'Failed to upload images. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      
      if (!granted) {
        Alert.alert('Permission Required', 'Please grant microphone permission to record voice messages.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration counter
      recordingInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();

      if (uri && recordingDuration >= 1) {
        // Haptic feedback on send
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Send the audio message
        await sendAudioMessage(uri, recordingDuration);
      } else {
        Alert.alert('Too Short', 'Voice message must be at least 1 second long.');
      }

      setRecording(null);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to save recording. Please try again.');
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      setRecording(null);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Error canceling recording:', error);
    }
  };

  const sendAudioMessage = async (audioUri: string, duration: number) => {
    try {
      setUploading(true);

      const tempId = `${Date.now()}_${Math.random()}`;
      const timestamp = Date.now();
      
      // Check network status first to avoid hanging
      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected && netInfo.isInternetReachable !== false;
      
      if (!isOnline) {
        // Offline - queue immediately with local URI
        // eslint-disable-next-line no-console
        console.log('📴 [COMPOSER] Offline, queueing audio with local URI');
        await sendMessageOptimistic(
          {
            threadId,
            text: '',
            media: null, // Will be set after upload
            tempId,
          },
          uid,
          audioUri, // Local URI
          'audio', // Media type
          { duration } // Metadata
        );
      } else {
        // Online - try to upload
        try {
          const audioUrl = await uploadImage(audioUri, `messages/${uid}/audio_${timestamp}.m4a`);

          // Send with uploaded URL
          await sendMessageOptimistic(
            {
              threadId,
              text: '',
              media: {
                type: 'audio',
                url: audioUrl,
                duration: duration,
              },
              tempId,
            },
            uid
          );
        } catch (uploadError: unknown) {
          // Upload failed - queue with local URI for later upload
          // eslint-disable-next-line no-console
          console.log('📴 [COMPOSER] Audio upload failed, queueing with local URI');
          await sendMessageOptimistic(
            {
              threadId,
              text: '',
              media: null, // Will be set after upload
              tempId,
            },
            uid,
            audioUri, // Local URI
            'audio', // Media type
            { duration } // Metadata
          );
        }
      }
    } catch (error) {
      console.error('Error sending audio message:', error);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Slash Command Menu */}
      {showSlashMenu && (
        <View style={styles.slashMenu}>
          {filteredCommands.map((cmd) => (
            <TouchableOpacity
              key={cmd.command}
              style={styles.slashMenuItem}
              onPress={() => handleSlashCommandSelect(cmd.command)}
            >
              <Ionicons name={cmd.icon as any} size={20} color="#007AFF" />
              <View style={styles.slashMenuText}>
                <Text style={styles.slashCommand}>{cmd.command}</Text>
                <Text style={styles.slashDescription}>{cmd.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={handleCameraLaunch}
          disabled={uploading}
        >
          <Ionicons name="camera" size={24} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={handleImagePick}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Ionicons name="image" size={24} color="#007AFF" />
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={handleLocationShare}
          disabled={uploading}
        >
          <Ionicons name="location" size={24} color="#007AFF" />
        </TouchableOpacity>
      
      {isRecording ? (
        <View style={styles.recordingContainer}>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={cancelRecording}
          >
            <Ionicons name="close-circle" size={28} color="#FF3B30" />
          </TouchableOpacity>
          
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              Recording... {formatDuration(recordingDuration)}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.stopButton} 
            onPress={stopRecording}
          >
            <Ionicons name="checkmark-circle" size={28} color="#34C759" />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Pressable onLongPress={handlePaste} style={{ flex: 1 }}>
            <TextInput
              testID="message-input"
              style={styles.input}
              value={text}
              onChangeText={handleTextChange}
              placeholder="Message"
              placeholderTextColor="#999"
              multiline
              maxLength={1000}
              editable={!uploading}
            />
          </Pressable>
          
          {text.trim() ? (
            <TouchableOpacity 
              style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]} 
              onPress={handleSend}
              disabled={!text.trim()}
              testID="send-button"
            >
              <Ionicons 
                name="send" 
                size={20} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              testID="mic-button"
              style={styles.micButton} 
              onPress={startRecording}
              disabled={uploading}
            >
              <Ionicons 
                name="mic" 
                size={24} 
                color={uploading ? '#999' : '#007AFF'} 
              />
            </TouchableOpacity>
          )}
        </>
      )}
      </View>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        visible={showImagePreview}
        images={selectedImages}
        onClose={() => {
          setShowImagePreview(false);
          setSelectedImages([]);
        }}
        onSend={handleSendImages}
        compressionQuality={compressionQuality}
        onCompressionChange={setCompressionQuality}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 8,
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#F2F2F7',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  cancelButton: {
    padding: 4,
  },
  stopButton: {
    padding: 4,
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  slashMenu: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingVertical: 8,
    maxHeight: 200,
  },
  slashMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  slashMenuText: {
    marginLeft: 12,
    flex: 1,
  },
  slashCommand: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  slashDescription: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
});

