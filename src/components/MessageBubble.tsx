import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, Modal, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
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
  onForward?: (message: Message) => void;
  threadMembers?: string[];
  threadLastRead?: { [userId: string]: any };
}

export default function MessageBubble({ item, me, showSender, senderName, threadId, onForward, threadMembers = [], threadLastRead = {} }: MessageBubbleProps) {
  const { colors } = useTheme();
  const isMe = item.senderId === me;
  const isHighPriority = item.priority === 'high';
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  
  // Calculate read status and count based on lastRead timestamps
  const calculateReadStatus = (): { status: 'sending' | 'sent' | 'delivered' | 'read', readCount: number, totalMembers: number } => {
    if (!isMe) return { status: 'sent', readCount: 0, totalMembers: 0 }; // Only show status for own messages
    
    // Get other members (exclude sender)
    const otherMembers = threadMembers.filter(memberId => memberId !== me);
    if (otherMembers.length === 0) return { status: 'sent', readCount: 0, totalMembers: 0 };
    
    const messageTime = item.createdAt?.toMillis?.() || 0;
    if (!messageTime) return { status: 'sent', readCount: 0, totalMembers: otherMembers.length };
    
    // Check how many members have read this message
    let readCount = 0;
    for (const memberId of otherMembers) {
      const memberLastRead = threadLastRead[memberId];
      if (memberLastRead) {
        const lastReadTime = memberLastRead.toMillis ? memberLastRead.toMillis() : 0;
        if (lastReadTime >= messageTime) {
          readCount++;
        }
      }
    }
    
    // Determine status
    let status: 'sending' | 'sent' | 'delivered' | 'read';
    if (readCount === otherMembers.length) {
      status = 'read';
    } else if (readCount > 0) {
      status = 'delivered';
    } else {
      status = 'sent';
    }
    
    return { status, readCount, totalMembers: otherMembers.length };
  };
  
  const { status: readStatus, readCount, totalMembers } = calculateReadStatus();
  const isGroupChat = threadMembers.length > 2;
  

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);


  const handleLongPress = () => {
    if (!threadId) return;
    setShowMessageOptions(true);
  };

  const handleMarkUrgent = async () => {
    if (!threadId) return;
    setShowMessageOptions(false);
    
    try {
      const messageRef = doc(db, `threads/${threadId}/messages`, item.id);
      await updateDoc(messageRef, {
        priority: isHighPriority ? 'normal' : 'high',
      });
    } catch (error) {
      console.error('Error updating message priority:', error);
      Alert.alert('Error', 'Failed to update message priority');
    }
  };

  const handleForwardPress = () => {
    setShowMessageOptions(false);
    onForward?.(item);
  };

  const handleAddReactionPress = () => {
    setShowMessageOptions(false);
    setShowEmojiPicker(true);
  };

  const handleDeletePress = (deleteForEveryone: boolean = false) => {
    setShowMessageOptions(false);
    handleDeleteMessage(deleteForEveryone);
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

  const handleCopyMessage = async () => {
    setShowMessageOptions(false);
    try {
      await Clipboard.setStringAsync(item.text || '');
      Alert.alert('Copied', 'Message copied to clipboard');
    } catch (error) {
      console.error('Error copying message:', error);
      Alert.alert('Error', 'Failed to copy message');
    }
  };

  const handleDeleteMessage = async (deleteForEveryone: boolean = false) => {
    if (!threadId) return;

    try {
      const messageRef = doc(db, `threads/${threadId}/messages`, item.id);
      
      if (deleteForEveryone) {
        // Delete the message document entirely
        await import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(messageRef));
      } else {
        // Mark as deleted for this user only
        await updateDoc(messageRef, {
          [`deletedFor.${me}`]: true,
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const handleShareAudio = async (url: string) => {
    try {
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
        // Share the file (opens native share sheet)
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'audio/m4a',
          dialogTitle: 'Share Voice Message',
        });
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
        // Share the file (opens native share sheet)
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Share Image',
        });
      } else{
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
      
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
      Alert.alert('Error', 'Failed to add reaction');
    }
  };

  return (
    <View style={[styles.container, isMe ? styles.myMessage : styles.theirMessage]}>
      {showSender && !isMe && (
        <Text style={styles.senderName}>{senderName || 'User'}</Text>
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
          {formatTimestamp(item.createdAt) && (
            <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp]}>
              {formatTimestamp(item.createdAt)}
            </Text>
          )}
          
          {isMe && (
            <View style={styles.statusContainer}>
              <Text style={[
                styles.status,
                readStatus === 'read' && styles.statusRead
              ]}>
                {readStatus === 'read' ? '✓✓' : readStatus === 'delivered' ? '✓✓' : '✓'}
              </Text>
              {isGroupChat && totalMembers > 0 && (
                <Text style={styles.readByCount}>
                  Seen by {readCount} of {totalMembers}
                </Text>
              )}
            </View>
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
              <Text style={styles.reactionCount}>{String(userIds.length)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {/* Message Options Modal */}
      <Modal
        visible={showMessageOptions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMessageOptions(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMessageOptions(false)}
        >
          <View style={[styles.messageOptionsContainer, { backgroundColor: colors.messageBubbleReceived }]}>
            <Text style={[styles.messageOptionsTitle, { color: colors.text }]}>Message Options</Text>
            
            <View style={styles.optionsGrid}>
              {/* Row 1 */}
              <TouchableOpacity 
                style={styles.optionButton}
                onPress={handleAddReactionPress}
              >
                <Ionicons name="happy-outline" size={24} color={colors.text} />
                <Text style={[styles.optionText, { color: colors.text }]}>React</Text>
              </TouchableOpacity>

              {item.text && (
                <TouchableOpacity 
                  style={styles.optionButton}
                  onPress={handleCopyMessage}
                >
                  <Ionicons name="copy-outline" size={24} color={colors.text} />
                  <Text style={[styles.optionText, { color: colors.text }]}>Copy</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.optionButton}
                onPress={handleForwardPress}
              >
                <Ionicons name="arrow-redo-outline" size={24} color={colors.text} />
                <Text style={[styles.optionText, { color: colors.text }]}>Forward</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionButton}
                onPress={handleMarkUrgent}
              >
                <Ionicons 
                  name={isHighPriority ? "alert-circle" : "alert-circle-outline"} 
                  size={24} 
                  color={isHighPriority ? "#FF3B30" : colors.text} 
                />
                <Text style={[styles.optionText, { color: colors.text }]}>
                  {isHighPriority ? `Remove${'\n'}Urgent` : `Mark${'\n'}Urgent`}
                </Text>
              </TouchableOpacity>

              {/* Row 2 - Delete options */}
              {isMe && Date.now() - (item.createdAt?.toMillis?.() || 0) < 10 * 60 * 1000 && (
                <TouchableOpacity 
                  style={styles.optionButton}
                  onPress={() => handleDeletePress(true)}
                >
                  <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                  <Text style={[styles.optionText, { color: "#FF3B30" }]}>Delete for{'\n'}Everyone</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.optionButton}
                onPress={() => handleDeletePress(false)}
              >
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                <Text style={[styles.optionText, { color: "#FF3B30" }]}>Delete for{'\n'}Me</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

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
  statusContainer: {
    alignItems: 'flex-end',
  },
  status: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusRead: {
    color: '#34C759', // Green for read receipts
    fontWeight: '600', // Make it slightly bolder to ensure visibility
  },
  readByCount: {
    fontSize: 10,
    marginTop: 2,
    color: 'rgba(255, 255, 255, 0.7)', // Semi-transparent white for blue bubble
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
  messageOptionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  messageOptionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#000000',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 12,
  },
  optionButton: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 8,
  },
  optionText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    color: '#000000',
  },
});

