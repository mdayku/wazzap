import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
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
    type: 'image' | null;
    url: string | null;
    width?: number;
    height?: number;
  } | null;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  priority?: 'high' | 'normal';
  createdAt: Timestamp;
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

  // Debug logging for status
  if (isMe && item.status === 'read') {
    console.log('✅ [RECEIPT] Message marked as read:', item.id, item.status);
  }

  const handleLongPress = () => {
    if (!threadId) return;
    
    Alert.alert(
      'Message Options',
      'What would you like to do?',
      [
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
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
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
        {item.media?.url && (
          <Image
            source={{ uri: item.media.url }}
            style={styles.image}
            resizeMode="cover"
          />
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
  image: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
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
});

