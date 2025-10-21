import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Image, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  const [previewImage, setPreviewImage] = useState<{ uri: string; width: number; height: number } | null>(null);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  const handleTextChange = (newText: string) => {
    setText(newText);
    
    const isTyping = newText.length > 0;
    console.log(`⌨️ [COMPOSER] Text changed, isTyping=${isTyping}, text length=${newText.length}`);
    
    // Notify typing
    if (onTyping) {
      console.log(`⌨️ [COMPOSER] Calling onTyping(${isTyping})`);
      onTyping(isTyping);
    } else {
      console.log(`⌨️ [COMPOSER] ⚠️ onTyping callback is undefined!`);
    }
    
    // Clear typing after 3 seconds of inactivity
    if (typingTimeout) clearTimeout(typingTimeout);
    const timeout = setTimeout(() => {
      console.log(`⌨️ [COMPOSER] Timeout fired, calling onTyping(false)`);
      onTyping?.(false);
    }, 3000);
    setTypingTimeout(timeout);
  };

  const handleSend = async () => {
    if (!text.trim() && !uploading) return;
    
    const messageText = text.trim();
    setText('');
    onTyping?.(false);
    
    try {
      const tempId = `${Date.now()}_${Math.random()}`;
      await sendMessageOptimistic({ threadId, text: messageText, tempId }, uid);
    } catch (error) {
      console.error('Error sending message:', error);
      // Could show error toast here
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
        setPreviewImage({
          uri: asset.uri,
          width: asset.width || 800,
          height: asset.height || 600
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handleSendImage = async () => {
    if (!previewImage) return;
    
    setUploading(true);
    try {
      const timestamp = Date.now();
      const path = `messages/${uid}/${timestamp}.jpg`;
      
      const url = await uploadImage(previewImage.uri, path);
      
      const tempId = `${Date.now()}_${Math.random()}`;
      await sendMessageOptimistic(
        { 
          threadId, 
          text: text.trim() || '',
          media: { type: 'image', url, width: previewImage.width, height: previewImage.height },
          tempId 
        }, 
        uid
      );
      
      setText('');
      setPreviewImage(null);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelImage = () => {
    setPreviewImage(null);
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
      
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={handleTextChange}
        placeholder="Message"
        placeholderTextColor="#999"
        multiline
        maxLength={1000}
      />
      
      <TouchableOpacity 
        style={[styles.sendButton, (!text.trim() && !uploading) && styles.sendButtonDisabled]} 
        onPress={handleSend}
        disabled={!text.trim() && !uploading}
      >
        <Ionicons 
          name="send" 
          size={20} 
          color={text.trim() ? '#FFFFFF' : '#999'} 
        />
      </TouchableOpacity>

      {/* Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelImage}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>Send this image?</Text>
            
            {previewImage && (
              <Image 
                source={{ uri: previewImage.uri }} 
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
            
            <View style={styles.previewButtons}>
              <TouchableOpacity 
                style={[styles.previewButton, styles.cancelButton]} 
                onPress={handleCancelImage}
                disabled={uploading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.previewButton, styles.confirmButton]} 
                onPress={handleSendImage}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Send Image</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '90%',
    maxHeight: '80%',
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
    width: '100%',
    height: 400,
    borderRadius: 8,
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
});

