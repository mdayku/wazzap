import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { collection, onSnapshot, orderBy, query, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import Composer from '../components/Composer';
import MessageBubble from '../components/MessageBubble';
import TypingDots from '../components/TypingDots';
import { formatLastSeen } from '../utils/time';
import { summarizeThread } from '../services/ai';

export default function ChatScreen({ route, navigation }: any) {
  const { threadId, threadName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [presenceInfo, setPresenceInfo] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [userCache, setUserCache] = useState<any>({});
  const listRef = useRef<FlatList>(null);

  // Fetch messages
  useEffect(() => {
    if (!threadId || !user) return;

    const q = query(
      collection(db, `threads/${threadId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(rows);
      setLoading(false);
      
      // Scroll to bottom
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Mark messages from others as delivered (if they're not already read)
      const messagesToDeliver = snap.docs.filter(doc => {
        const data = doc.data();
        return data.senderId !== user.uid && data.status === 'sent';
      });
      
      if (messagesToDeliver.length > 0) {
        console.log(`📬 [STATUS] Marking ${messagesToDeliver.length} messages as delivered`);
        messagesToDeliver.forEach(async (msgDoc) => {
          try {
            await updateDoc(doc(db, `threads/${threadId}/messages`, msgDoc.id), {
              status: 'delivered'
            });
          } catch (error) {
            console.error('Error updating message to delivered:', error);
          }
        });
      }
      
      // Mark messages from others as read
      const messagesToMarkRead = snap.docs.filter(doc => {
        const data = doc.data();
        return data.senderId !== user.uid && 
               (data.status === 'delivered' || data.status === 'sent');
      });
      
      if (messagesToMarkRead.length > 0) {
        console.log(`👁️ [STATUS] Marking ${messagesToMarkRead.length} messages as read`);
        
        // Update all in parallel
        await Promise.all(
          messagesToMarkRead.map(msgDoc =>
            updateDoc(doc(db, `threads/${threadId}/messages`, msgDoc.id), {
              status: 'read'
            }).catch(err => console.error('Error marking message as read:', err))
          )
        );
      }
      
      // Update read receipt tracking
      updateReadReceipt();
    });

    return () => unsubscribe();
  }, [threadId, user]);

  // Fetch thread members for presence
  useEffect(() => {
    if (!threadId || !user) return;

    const fetchThread = async () => {
      try {
        const threadDoc = await getDoc(doc(db, 'threads', threadId));
        if (threadDoc.exists()) {
          const threadData = threadDoc.data();
          const otherMember = threadData.members.find((m: string) => m !== user.uid);
          
          if (otherMember) {
            // Subscribe to other user's presence
            const userDoc = doc(db, 'users', otherMember);
            const unsubscribe = onSnapshot(userDoc, (snap) => {
              if (snap.exists()) {
                const userData = snap.data();
                setUserCache((prev: any) => ({ ...prev, [otherMember]: userData }));
                setPresenceInfo(formatLastSeen(userData.lastSeen));
              }
            });
            return unsubscribe;
          }
        }
      } catch (error) {
        console.error('Error fetching presence:', error);
      }
    };

    fetchThread();
  }, [threadId, user]);

  // Listen for typing indicators
  useEffect(() => {
    if (!threadId || !user) return;

    const q = query(collection(db, `threads/${threadId}/members`));
    const unsubscribe = onSnapshot(q, (snap) => {
      snap.docs.forEach(d => {
        if (d.id !== user.uid && d.data().typing) {
          setTyping(true);
          return;
        }
      });
      setTyping(false);
    });

    return () => unsubscribe();
  }, [threadId, user]);

  const updateReadReceipt = async () => {
    if (!user || !threadId) return;
    
    try {
      // Update member doc for read receipts
      const memberDoc = doc(db, `threads/${threadId}/members`, user.uid);
      await updateDoc(memberDoc, {
        readAt: new Date()
      }).catch(() => {
        // Member doc might not exist yet
      });
      
      // Update thread doc to track last read for unread count calculation
      const threadDoc = doc(db, 'threads', threadId);
      await updateDoc(threadDoc, {
        [`lastRead.${user.uid}`]: serverTimestamp()
      });
      
      console.log('✅ [READ] Marked thread as read for user:', user.uid);
    } catch (error) {
      console.error('Error updating read receipt:', error);
    }
  };

  const handleTyping = async (isTyping: boolean) => {
    if (!user || !threadId) return;
    
    try {
      const memberDoc = doc(db, `threads/${threadId}/members`, user.uid);
      await updateDoc(memberDoc, {
        typing: isTyping
      }).catch(() => {
        // Member doc might not exist yet
      });
    } catch (error) {
      console.error('Error updating typing:', error);
    }
  };

  const handleSummarize = async () => {
    setShowSummary(true);
    setLoadingSummary(true);
    
    try {
      const result = await summarizeThread(threadId, 50);
      
      // Fetch the summary from Firestore
      if (result.summaryId) {
        const summaryDoc = await getDoc(doc(db, `threads/${threadId}/summaries`, result.summaryId));
        if (summaryDoc.exists()) {
          setSummary(summaryDoc.data().text || 'Summary generated');
        }
      } else {
        setSummary(result.text || 'Summary generated');
      }
    } catch (error) {
      console.error('Error summarizing:', error);
      setSummary('Failed to generate summary. Please try again.');
    } finally {
      setLoadingSummary(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{threadName}</Text>
          <Text style={styles.presence}>{presenceInfo}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => navigation.navigate('Decisions' as never, { threadId } as never)}
          >
            <Ionicons name="checkmark-circle-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => navigation.navigate('Search' as never, { threadId } as never)}
          >
            <Ionicons name="search-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.summarizeButton} onPress={handleSummarize}>
            <Ionicons name="sparkles" size={18} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(i) => i.id}
        renderItem={({ item, index }) => {
          const showSender = index === 0 || messages[index - 1].senderId !== item.senderId;
          const senderName = userCache[item.senderId]?.displayName;
          return (
            <MessageBubble
              item={item}
              me={user?.uid || ''}
              showSender={showSender}
              senderName={senderName}
            />
          );
        }}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        style={styles.chatContent}
      />

      {/* Typing indicator */}
      {typing && (
        <View style={styles.typingContainer}>
          <TypingDots />
          <Text style={styles.typingText}>typing...</Text>
        </View>
      )}

      {/* Composer */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Composer threadId={threadId} uid={user?.uid || ''} onTyping={handleTyping} />
      </KeyboardAvoidingView>

      {/* Summary Modal */}
      <Modal
        visible={showSummary}
        animationType="slide"
        onRequestClose={() => setShowSummary(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Thread Summary</Text>
            <TouchableOpacity onPress={() => setShowSummary(false)}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {loadingSummary ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.modalLoader} />
            ) : (
              <Text style={styles.summaryText}>{summary}</Text>
            )}
          </ScrollView>
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
  chatContent: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  presence: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summarizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingVertical: 8,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalLoader: {
    marginTop: 48,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
});

