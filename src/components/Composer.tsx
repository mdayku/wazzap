import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Text, Alert, Pressable } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { sendMessageOptimistic } from '../state/offlineQueue';
import { uploadImage } from '../services/storage';

interface ComposerProps {
  threadId: string;
  uid: string;
  onTyping?: (isTyping: boolean) => void;
}

export default function Composer({ threadId, uid, onTyping }: ComposerProps) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load draft message when component mounts
  useEffect(() => {
    loadDraft();
  }, [threadId]);

  // Save draft whenever text changes
  useEffect(() => {
    saveDraft(text);
  }, [text, threadId]);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  const getDraftKey = () => `draft_${threadId}_${uid}`;

  const loadDraft = async () => {
    try {
      const draft = await AsyncStorage.getItem(getDraftKey());
      if (draft) {
        setText(draft);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  };

  const saveDraft = async (draftText: string) => {
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
  };

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(getDraftKey());
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
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
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Send image directly without preview modal
        await handleSendImage(asset.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handleSendImage = async (imageUri: string) => {
    setUploading(true);
    try {
      // Compress image before uploading
      console.log('📸 [IMAGE] Compressing image...');
      const compressed = await compressImage(imageUri);
      console.log(`📸 [IMAGE] Compressed: ${compressed.width}x${compressed.height}`);
      
      const timestamp = Date.now();
      const path = `messages/${uid}/${timestamp}.jpg`;
      
      const url = await uploadImage(compressed.uri, path);
      
      // Haptic feedback on send
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const tempId = `${Date.now()}_${Math.random()}`;
      await sendMessageOptimistic(
        { 
          threadId, 
          text: text.trim() || '',
          media: { type: 'image', url, width: compressed.width, height: compressed.height },
          tempId 
        }, 
        uid
      );
      
      setText('');
      // Clear draft after successful send
      await clearDraft();
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      console.log('🎤 [AUDIO] Requesting permissions...');
      const { granted } = await Audio.requestPermissionsAsync();
      
      if (!granted) {
        Alert.alert('Permission Required', 'Please grant microphone permission to record voice messages.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('🎤 [AUDIO] Starting recording...');
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

      console.log('🎤 [AUDIO] Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      console.log('🎤 [AUDIO] Stopping recording...');
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
      console.log('🎤 [AUDIO] Recording saved to:', uri);

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
      console.log('🎤 [AUDIO] Canceling recording...');
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
      console.log('🎤 [AUDIO] Recording canceled');
    } catch (error) {
      console.error('Error canceling recording:', error);
    }
  };

  const sendAudioMessage = async (audioUri: string, duration: number) => {
    try {
      setUploading(true);
      console.log('🎤 [AUDIO] Uploading audio file...');

      // Upload to Firebase Storage with correct path format
      const timestamp = Date.now();
      const audioUrl = await uploadImage(audioUri, `messages/${uid}/audio_${timestamp}.m4a`);
      
      console.log('🎤 [AUDIO] Audio uploaded:', audioUrl);

      // Send message with audio metadata
      const tempId = `${Date.now()}_${Math.random()}`;
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

      console.log('🎤 [AUDIO] Audio message sent!');
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
    <View style={styles.container}>
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
      )}    </View>
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
});

