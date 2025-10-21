import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, Modal, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Timestamp } from 'firebase/firestore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTheme } from '../contexts/ThemeContext';
import { formatTimestamp } from '../utils/time';

interface Message {
  id: string;
  senderId: string;
  text: string;
  media?: {
    type: 'image' | 'audio' | null;
    url: string | null;
    width?: number;
    height?: number;
    duration?: number;
  } | null;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  priority?: 'high' | 'normal';
  createdAt: Timestamp;
  deletedFor?: { [userId: string]: boolean };
  reactions?: { [emoji: string]: string[] }; // emoji -> array of user IDs
}

interface MessageBubbleProps {
  item: Message;
  me: string;
  showSender?: boolean;
  senderName?: string;
  threadId?: string;
}

export default function MessageBubble({ item, me, showSender, senderName, threadId }: MessageBubbleProps) {
  const { colors } = useTheme();
  const isMe = item.senderId === me;
  const isHighPriority = item.priority === 'high';
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Debug logging for status
  if (isMe && item.status === 'read') {
    console.log('✅ [RECEIPT] Message marked as read:', item.id, item.status);
  }

  const handleLongPress = () => {
    if (!threadId) return;
    
    const messageAge = Date.now() - (item.createdAt?.toMillis?.() || 0);
    const canDeleteForEveryone = messageAge < 10 * 60 * 1000; // 10 minutes
    
    const options: any[] = [
      {
        text: 'Add Reaction',
        onPress: () => setShowEmojiPicker(true),
      },
      {
        text: isHighPriority ? 'Remove Urgent Flag' : 'Mark as Urgent',
        onPress: async () => {
          try {
            const messageRef = doc(db, `threads/${threadId}/messages`, item.id);
            await updateDoc(messageRef, {
              priority: isHighPriority ? 'normal' : 'high',
            });
            console.log(`✅ Message ${isHighPriority ? 'unmarked' : 'marked'} as urgent:`, item.id);
          } catch (error) {
            console.error('Error updating message priority:', error);
            Alert.alert('Error', 'Failed to update message priority');
          }
        },
      },
    ];

    if (isMe) {
      if (canDeleteForEveryone) {
        options.push({
          text: 'Delete for Everyone',
          style: 'destructive',
          onPress: () => handleDeleteMessage(true),
        });
      }
      options.push({
        text: 'Delete for Me',
        style: 'destructive',
        onPress: () => handleDeleteMessage(false),
      });
    }

    options.push({
      text: 'Cancel',
      style: 'cancel',
    });
    
    Alert.alert(
      'Message Options',
      canDeleteForEveryone && isMe ? 'Message can be deleted for everyone (sent within 10 minutes)' : '',
      options,
      { cancelable: true }
    );
  };

  const handlePlayAudio = async () => {
    if (!item.media?.url) return;

    try {
      if (isPlaying && sound) {
        // Stop playing
        await sound.stopAsync();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        
        // Load and play audio
        const { sound: audioSound } = await Audio.Sound.createAsync(
          { uri: item.media.url },
          { shouldPlay: true }
        );
        
        setSound(audioSound);
        setIsPlaying(true);
        setIsLoading(false);

        // Set up playback status update
        audioSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        });

        console.log('🔊 [AUDIO] Playing audio message');
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio message');
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteMessage = async (deleteForEveryone: boolean = false) => {
    if (!threadId) return;

    try {
      const messageRef = doc(db, `threads/${threadId}/messages`, item.id);
      
      if (deleteForEveryone) {
        // Delete the message document entirely
        await import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(messageRef));
        console.log('🗑️ [DELETE] Message deleted for everyone:', item.id);
      } else {
        // Mark as deleted for this user only
        await updateDoc(messageRef, {
          [`deletedFor.${me}`]: true,
        });
        console.log('🗑️ [DELETE] Message deleted for me:', item.id);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const handleShareAudio = async (url: string) => {
    try {
      console.log('📤 [SHARE] Starting share:', url);
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Not Supported', 'Sharing is not available on this device');
        return;
      }

      // Create a unique filename
      const filename = `voice_message_${Date.now()}.m4a`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      // Download the file first
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);
      
      if (downloadResult.status === 200) {
        console.log('📤 [SHARE] File downloaded to:', downloadResult.uri);
        
        // Share the file (opens native share sheet)
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'audio/m4a',
          dialogTitle: 'Share Voice Message',
        });
        
        console.log('📤 [SHARE] File shared successfully');
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Error sharing audio:', error);
      Alert.alert('Share Failed', 'Could not share the audio file. Please try again.');
    }
  };

  const handleShareImage = async (url: string) => {
    try {
      console.log('📤 [SHARE] Starting image share:', url);
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Not Supported', 'Sharing is not available on this device');
        return;
      }

      // Create a unique filename
      const filename = `image_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      // Download the file first
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);
      
      if (downloadResult.status === 200) {
        console.log('📤 [SHARE] Image downloaded to:', downloadResult.uri);
        
        // Share the file (opens native share sheet)
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Share Image',
        });
        
        console.log('📤 [SHARE] Image shared successfully');
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert('Share Failed', 'Could not share the image. Please try again.');
    }
  };

  const handleAddReaction = async (emoji: string) => {
    if (!threadId) return;
    
    try {
      const messageRef = doc(db, `threads/${threadId}/messages`, item.id);
      const currentReactions = item.reactions || {};
      const emojiReactions = currentReactions[emoji] || [];
      
      // Toggle reaction - add if not present, remove if present
      const newReactions = emojiReactions.includes(me)
        ? emojiReactions.filter(uid => uid !== me)
        : [...emojiReactions, me];
      
      // Update or remove the emoji key
      if (newReactions.length === 0) {
        // Remove the emoji key entirely if no one reacted
        const updatedReactions = { ...currentReactions };
        delete updatedReactions[emoji];
        await updateDoc(messageRef, { reactions: updatedReactions });
      } else {
        await updateDoc(messageRef, {
          [`reactions.${emoji}`]: newReactions,
        });
      }
      
      console.log(`👍 [REACTION] ${me} ${newReactions.includes(me) ? 'added' : 'removed'} ${emoji} to message ${item.id}`);
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
      Alert.alert('Error', 'Failed to add reaction');
    }
  };

  return (
    <View style={[styles.container, isMe ? styles.myMessage : styles.theirMessage]}>
      {showSender && !isMe && (
        <Text style={styles.senderName}>{senderName || item.senderId}</Text>
      )}
      
      <TouchableOpacity
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={0.9}
      >
        <View style={[
          styles.bubble,
          isMe ? { backgroundColor: colors.messageBubbleSent } : { backgroundColor: colors.messageBubbleReceived },
          isHighPriority && styles.highPriority
        ]}>
        {item.media?.type === 'image' && item.media?.url && (
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: item.media.url }}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={styles.imageActionButton}
                onPress={() => handleShareImage(item.media!.url)}
              >
                <Ionicons
                  name="share-outline"
                  size={20}
                  color={isMe ? colors.messageBubbleSentText : colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.imageActionButton}
                onPress={() => handleDeleteMessage()}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={isMe ? colors.messageBubbleSentText : colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {item.media?.type === 'audio' && item.media?.url && (
          <View style={styles.audioWrapper}>
            <TouchableOpacity
              style={styles.audioContainer}
              onPress={handlePlayAudio}
              disabled={isLoading}
            >
            {isLoading ? (
              <ActivityIndicator 
                size="small" 
                color={isMe ? colors.messageBubbleSentText : '#007AFF'} 
              />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={36}
                color={isMe ? colors.messageBubbleSentText : '#007AFF'}
              />
            )}
              <View style={styles.audioInfo}>
                <Text style={[
                  styles.audioText,
                  isMe ? { color: colors.messageBubbleSentText } : { color: colors.messageBubbleReceivedText }
                ]}>
                  Voice Message
                </Text>
                {item.media.duration && (
                  <Text style={[
                    styles.audioDuration,
                    isMe ? { color: colors.messageBubbleSentText } : { color: colors.messageBubbleReceivedText }
                  ]}>
                    {formatDuration(item.media.duration)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.audioActions}>
              <TouchableOpacity
                style={styles.audioActionButton}
                onPress={() => handleShareAudio(item.media?.url || '')}
              >
                <Ionicons 
                  name="share-outline" 
                  size={20} 
                  color={isMe ? colors.messageBubbleSentText : colors.messageBubbleReceivedText} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.audioActionButton}
                onPress={() => handleDeleteMessage()}
              >
                <Ionicons 
                  name="trash-outline" 
                  size={20} 
                  color={isMe ? colors.messageBubbleSentText : colors.messageBubbleReceivedText} 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {item.text ? (
          <Text style={[styles.text, isMe ? { color: colors.messageBubbleSentText } : { color: colors.messageBubbleReceivedText }]}>
            {item.text}
          </Text>
        ) : null}
        
        <View style={styles.footer}>
          <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp]}>
            {formatTimestamp(item.createdAt)}
          </Text>
          
          {isMe && (
            <Text style={[
              styles.status,
              item.status === 'read' && styles.statusRead
            ]}>
              {item.status === 'read' ? '✓✓' : item.status === 'delivered' ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
      </TouchableOpacity>
      
      {isHighPriority && (
        <View style={styles.priorityBadge}>
          <Text style={styles.priorityText}>!</Text>
        </View>
      )}
      
      {/* Reactions Display */}
      {item.reactions && Object.keys(item.reactions).length > 0 && (
        <View style={styles.reactionsContainer}>
          {Object.entries(item.reactions).map(([emoji, userIds]) => (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.reactionBubble,
                userIds.includes(me) && styles.reactionBubbleActive
              ]}
              onPress={() => handleAddReaction(emoji)}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              <Text style={styles.reactionCount}>{userIds.length}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEmojiPicker(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.emojiPickerContainer}>
              <Text style={styles.emojiPickerTitle}>Add Reaction</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.emojiScroll}
              >
                {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '👏', '💯'].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.emojiButton}
                    onPress={() => handleAddReaction(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    marginLeft: 12,
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
    position: 'relative',
  },
  myBubble: {
    backgroundColor: '#007AFF',
  },
  theirBubble: {
    backgroundColor: '#E5E5EA',
  },
  highPriority: {
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
  },
  myText: {
    color: '#FFFFFF',
  },
  theirText: {
    color: '#000000',
  },
  imageWrapper: {
    flexDirection: 'column',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  imageActionButton: {
    padding: 2,
  },
  audioWrapper: {
    flexDirection: 'column',
    minWidth: 180,
    maxWidth: 250,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  audioInfo: {
    marginLeft: 8,
    flex: 1,
  },
  audioText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  audioDuration: {
    fontSize: 12,
    opacity: 0.7,
  },
  audioActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  audioActionButton: {
    padding: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  timestamp: {
    fontSize: 11,
    marginRight: 4,
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirTimestamp: {
    color: '#666',
  },
  status: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusRead: {
    color: '#34C759',
  },
  priorityBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reactionBubbleActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiPickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    minWidth: 300,
    maxWidth: '90%',
  },
  emojiPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    color: '#000000',
  },
  emojiScroll: {
    flexDirection: 'row',
  },
  emojiButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  emojiText: {
    fontSize: 32,
  },
});

