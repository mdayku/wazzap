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
  Image,
  Share,
  Alert,
} from 'react-native';
import { collection, onSnapshot, orderBy, query, doc, updateDoc, setDoc, getDoc, serverTimestamp, limit } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { useThreads } from '../hooks/useThread';
import Composer from '../components/Composer';
import MessageBubble from '../components/MessageBubble';
import TypingDots from '../components/TypingDots';
import ErrorBoundary from '../components/ErrorBoundary';
import HydrationBanner from '../components/HydrationBanner';
import { formatLastSeen, isUserOnline } from '../utils/time';
import { summarizeThread, extractAI } from '../services/ai';
import { sendMessageOptimistic } from '../state/offlineQueue';

export default function ChatScreen({ route, navigation }: any) {
  const { threadId, threadName } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const { threads } = useThreads(user?.uid || '');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [presenceInfo, setPresenceInfo] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryTitle, setSummaryTitle] = useState('Thread Summary');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [userCache, setUserCache] = useState<any>({});
  const [isOnline, setIsOnline] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [threadMembers, setThreadMembers] = useState<string[]>([]);
  const [isGroupChat, setIsGroupChat] = useState(false);
  const listRef = useRef<FlatList>(null);
  const [messageLimit, setMessageLimit] = useState(150); // Increased to support load tests
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState<any>(null);
  const markedAsReadRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true); // Track messages we've already marked
  const previousMessageIdsRef = useRef<Set<string>>(new Set()); // Track message IDs for haptic feedback

  // Fetch messages
  useEffect(() => {
    if (!threadId || !user) return;

    // Reset state when thread changes
    markedAsReadRef.current.clear();
    isInitialLoadRef.current = true;
    previousMessageIdsRef.current.clear();

    const q = query(
      collection(db, `threads/${threadId}/messages`),
      orderBy('createdAt', 'desc'),
      limit(messageLimit)
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      console.log(`🔄 [SNAPSHOT] Snapshot fired, ${snap.docs.length} messages`);
      
      const rows = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((msg: any) => !msg.deletedFor?.[user.uid]) // Filter out messages deleted by this user
        .reverse(); // Reverse to show oldest first
      
      // Debug: Log message statuses for sender's messages
      const myMessages = rows.filter((msg: any) => msg.senderId === user.uid);
      if (myMessages.length > 0) {
        console.log(`📨 [STATUS_DEBUG] My messages:`, myMessages.map((m: any) => ({ id: m.id.slice(0, 8), status: m.status })));
      }
      
      setMessages(rows);
      setLoading(false);
      setLoadingMore(false);
      
      // Check if there are more messages
      setHasMoreMessages(snap.docs.length === messageLimit);
      
      // Haptic feedback for new messages from others (not on initial load)
      if (!isInitialLoadRef.current) {
        const currentMessageIds = new Set(rows.map((m: any) => m.id));
        const newMessages = rows.filter(
          (msg: any) => 
            !previousMessageIdsRef.current.has(msg.id) && 
            msg.senderId !== user.uid
        );
        
        if (newMessages.length > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        previousMessageIdsRef.current = currentMessageIds;
      }
      
      // Scroll to bottom only on initial load
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        // Initialize previousMessageIds on first load
        previousMessageIdsRef.current = new Set(rows.map((m: any) => m.id));
        // Use longer timeout and no animation for reliable initial scroll
        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: false });
        }, 300);
      }
      
      // Update read receipt tracking FIRST (so lastRead timestamp is current)
      updateReadReceipt();
      
      // Mark messages from others as read (skip "delivered" and go straight to "read" since chat is open)
      // Skip load test messages to avoid overwhelming Firestore
      const messagesToMarkRead = snap.docs.filter(doc => {
        const data = doc.data();
        const isLoadTestMessage = data.text?.includes('Load test message') || data.text?.includes('[WARMUP]');
        const readBy = data.readBy || [];
        const alreadyRead = readBy.includes(user.uid);
        
        return data.senderId !== user.uid && 
               !alreadyRead &&
               !markedAsReadRef.current.has(doc.id) && // Don't re-mark
               !isLoadTestMessage; // Skip load test messages
      });
      
      if (messagesToMarkRead.length > 0) {
        
        // Track them first
        messagesToMarkRead.forEach(msgDoc => {
          markedAsReadRef.current.add(msgDoc.id);
        });
        
        // Update all in parallel - add current user to readBy array
        await Promise.all(
          messagesToMarkRead.map(msgDoc => {
            const data = msgDoc.data();
            const currentReadBy = data.readBy || [];
            
            return updateDoc(doc(db, `threads/${threadId}/messages`, msgDoc.id), {
              status: 'read',
              readBy: [...currentReadBy, user.uid]
            }).catch(err => {
              console.error('Error marking message as read:', err);
              markedAsReadRef.current.delete(msgDoc.id); // Remove on error
            });
          })
        );
        
        // If the most recent message was marked as read, update the thread's lastMessage.readBy
        const mostRecentMessage = rows[0]; // rows are ordered by createdAt desc
        if (mostRecentMessage && messagesToMarkRead.some(m => m.id === mostRecentMessage.id)) {
          const updatedReadBy = [...((mostRecentMessage as any).readBy || []), user.uid];
          await updateDoc(doc(db, `threads/${threadId}`), {
            'lastMessage.readBy': updatedReadBy
          }).catch(err => {
            console.error('Error updating thread lastMessage.readBy:', err);
          });
        }
      }
    });

    return () => unsubscribe();
  }, [threadId, user, messageLimit]);

  // Fetch user data for all threads (for forward modal)
  useEffect(() => {
    if (!threads || !Array.isArray(threads) || threads.length === 0 || !user) return;

    const fetchAllThreadMembers = async () => {
      const uids = new Set<string>();
      
      for (const thread of threads) {
        if (!thread || !thread.members || !Array.isArray(thread.members)) continue;
        
        for (const uid of thread.members) {
          if (uid && typeof uid === 'string' && uid !== user.uid && !userCache[uid]) {
            uids.add(uid);
          }
        }
      }

      if (uids.size === 0) return;

      const newUsers: any = {};
      await Promise.all(
        Array.from(uids).map(async (uid) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              newUsers[uid] = {
                displayName: userData.displayName || 'User',
                photoURL: userData.photoURL,
              };
            }
          } catch (error) {
            console.error('Error fetching user for forward modal:', error);
          }
        })
      );

      if (Object.keys(newUsers).length > 0) {
        setUserCache((prev: any) => ({ ...prev, ...newUsers }));
      }
    };

    fetchAllThreadMembers();
  }, [threads?.length, user?.uid]);

  // Fetch thread members for presence
  useEffect(() => {
    if (!threadId || !user) return;

    const fetchThread = async () => {
      try {
        const threadDoc = await getDoc(doc(db, 'threads', threadId));
        if (threadDoc.exists()) {
          const threadData = threadDoc.data();
          const members = threadData.members || [];
          setThreadMembers(members);
          
          // Check if it's a group chat (more than 2 members or has a group name)
          const isGroup = members.length > 2 || !!threadData.name;
          setIsGroupChat(isGroup);
          
          // FIRST: Fetch all members' data (for both 1:1 and group chats)
          // Fetch user data for all thread members
          const memberPromises = members.map(async (memberId: string) => {
            try {
              const memberDoc = await getDoc(doc(db, 'users', memberId));
              if (memberDoc.exists()) {
                const userData = memberDoc.data();
                return { [memberId]: userData };
              }
            } catch (error) {
              console.error('Error fetching member data:', error);
            }
            return null;
          });
          
          const memberResults = await Promise.all(memberPromises);
          const newCache: any = {};
          memberResults.forEach((result) => {
            if (result) {
              Object.assign(newCache, result);
            }
          });
          setUserCache((prev: any) => ({ ...prev, ...newCache }));
          
          // SECOND: Set up presence tracking for 1:1 chats
          const otherMember = members.find((m: string) => m !== user.uid);
          
          if (otherMember) {
            setOtherUserId(otherMember);
            // Subscribe to other user's presence (for 1:1 chats only)
            if (!isGroup) {
              const userDoc = doc(db, 'users', otherMember);
              const unsubscribe = onSnapshot(userDoc, (snap) => {
                if (snap.exists()) {
                  const userData = snap.data();
                  setUserCache((prev: any) => ({ ...prev, [otherMember]: userData }));
                  setPresenceInfo(formatLastSeen(userData.lastSeen));
                  setIsOnline(isUserOnline(userData.lastSeen));
                }
              });
              return unsubscribe;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching presence:', error);
      }
    };

    fetchThread();
  }, [threadId, user]);

  // Initialize member docs for ALL participants and listen for typing indicators
  useEffect(() => {
    if (!threadId || !user) return;

    // Initialize member docs for ALL thread participants
    const initializeMembers = async () => {
      try {
        // Fetch thread to get all members
        const threadDoc = await getDoc(doc(db, 'threads', threadId));
        if (!threadDoc.exists()) {
          console.error('⌨️ [TYPING] Thread not found');
          return;
        }
        
        const threadData = threadDoc.data();
        const threadMembers = threadData.members || [];
        
        // Create member doc for each participant
        await Promise.all(threadMembers.map(async (memberId: string) => {
          const memberDoc = doc(db, `threads/${threadId}/members`, memberId);
          await setDoc(memberDoc, {
            uid: memberId,
            typing: false,
            lastSeen: new Date()
          }, { merge: true });
        }));
      } catch (error) {
        console.error('Error initializing member docs:', error);
      }
    };

    initializeMembers();

    const q = query(collection(db, `threads/${threadId}/members`));
    const unsubscribe = onSnapshot(q, (snap) => {
      // Check if ANY other user is typing
      const someoneTyping = snap.docs.some(d => 
        d.id !== user.uid && d.data().typing === true
      );
      setTyping(someoneTyping);
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
    } catch (error) {
      console.error('Error updating read receipt:', error);
    }
  };

  // Call updateReadReceipt immediately when chat opens and when messages change
  useEffect(() => {
    if (user && threadId && messages.length > 0) {
      updateReadReceipt();
    }
  }, [threadId, user, messages.length]); // Trigger when message count changes

  const handleTyping = async (isTyping: boolean) => {
    if (!user || !threadId) return;
    
    try {
      const memberDoc = doc(db, `threads/${threadId}/members`, user.uid);
      // Use setDoc with merge to create doc if it doesn't exist
      await setDoc(memberDoc, {
        typing: isTyping,
        uid: user.uid,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating typing:', error);
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMoreMessages) return;
    setLoadingMore(true);
    setMessageLimit(prev => prev + 50);
  };

  const handleSummarize = async () => {
    // If we already have a summary, just show it
    if (summary) {
      setShowSummary(true);
      return;
    }
    
    // Otherwise, generate a new one
    await generateSummary();
  };

  const generateSummary = async (retryCount = 0) => {
    setShowSummary(true);
    setLoadingSummary(true);
    
    try {
      const result = await summarizeThread(threadId, 50);
      
      // Fetch the summary from Firestore
      let summaryText = '';
      if (result.summaryId) {
        const summaryDoc = await getDoc(doc(db, `threads/${threadId}/summaries`, result.summaryId));
        if (summaryDoc.exists()) {
          summaryText = summaryDoc.data().text || 'Summary generated';
        }
      } else {
        summaryText = result.text || 'Summary generated';
      }
      
      setSummary(summaryText);
      
      // Generate AI title for the summary
      generateSummaryTitle(summaryText);
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Summary Generated',
        text2: 'Thread has been summarized successfully',
        position: 'bottom',
        visibilityTime: 2000,
      });
    } catch (error: any) {
      console.error('Error summarizing:', error);
      
      // Retry logic (max 2 retries)
      if (retryCount < 2) {
        setTimeout(() => generateSummary(retryCount + 1), 1000);
        return;
      }
      
      // After retries failed, show error to user
      setSummary('');
      setSummaryTitle('Thread Summary');
      setShowSummary(false);
      
      const errorMessage = error?.message || 'Failed to generate summary';
      Toast.show({
        type: 'error',
        text1: 'Summarization Failed',
        text2: errorMessage.length > 50 ? 'Please try again later' : errorMessage,
        position: 'bottom',
        visibilityTime: 4000,
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  const generateSummaryTitle = (summaryText: string) => {
    // Extract first sentence or key phrase for title
    const firstLine = summaryText.split('\n').find(line => line.trim().length > 0) || '';
    
    // If it starts with a heading marker or bullet, extract it
    if (firstLine.startsWith('**') || firstLine.startsWith('# ')) {
      const title = firstLine.replace(/[*#-]/g, '').trim();
      setSummaryTitle(title.slice(0, 50) + (title.length > 50 ? '...' : ''));
    } else {
      // Extract key topics (look for common patterns)
      const keywords = summaryText.match(/(?:discussion|topic|meeting|decision|about|regarding)\s+([^.,\n]{10,40})/i);
      if (keywords && keywords[1]) {
        setSummaryTitle(keywords[1].trim());
      } else {
        // Fallback: use first few words
        const words = firstLine.split(' ').slice(0, 6).join(' ');
        setSummaryTitle(words + (firstLine.split(' ').length > 6 ? '...' : ''));
      }
    }
  };

  const handleResummarize = async () => {
    await generateSummary();
  };

  const handleShareSummary = async () => {
    try {
      await Share.share({
        message: `${summaryTitle}\n\n${summary}`,
        title: summaryTitle,
      });
    } catch (error) {
      console.error('Error sharing summary:', error);
    }
  };

  const handleForwardMessage = (message: any) => {
    setMessageToForward(message);
    setShowForwardModal(true);
  };

  const handleForwardToThread = async (targetThreadId: string) => {
    if (!messageToForward || !user) return;
    
    try {
      const tempId = `${Date.now()}_${Math.random()}`;
      
      // Forward the message to the target thread
      await sendMessageOptimistic(
        {
          threadId: targetThreadId,
          text: messageToForward.text || '',
          media: messageToForward.media,
          tempId,
        },
        user.uid
      );
      
      setShowForwardModal(false);
      setMessageToForward(null);
      
      Toast.show({
        type: 'success',
        text1: 'Message Forwarded',
        text2: 'Message sent successfully',
        position: 'top',
      });
      
    } catch (error) {
      console.error('❌ [FORWARD] Error forwarding message:', error);
      Toast.show({
        type: 'error',
        text1: 'Forward Failed',
        text2: 'Could not forward message',
        position: 'top',
      });
    }
  };

  const handleExtractActions = async () => {
    // If we already have cached data, just show it
    if (actionItems.length > 0 || decisions.length > 0) {
      setShowActions(true);
      return;
    }
    
    // Otherwise, fetch new data
    await generateActions();
  };

  const generateActions = async (retryCount = 0) => {
    setShowActions(true);
    setLoadingActions(true);
    
    try {
      const result = await extractAI(threadId, 50);
      setActionItems(result.actionItems || []);
      setDecisions(result.decisions || []);
      
      // Show success toast
      const totalItems = (result.actionItems?.length || 0) + (result.decisions?.length || 0);
      if (totalItems > 0) {
        Toast.show({
          type: 'success',
          text1: 'Actions Extracted',
          text2: `Found ${totalItems} item${totalItems !== 1 ? 's' : ''}`,
          position: 'bottom',
          visibilityTime: 2000,
        });
      }
    } catch (error: any) {
      console.error('Error extracting actions:', error);
      
      // Retry logic (max 2 retries)
      if (retryCount < 2) {
        setTimeout(() => generateActions(retryCount + 1), 1000);
        return;
      }
      
      // After retries failed, show error to user
      setActionItems([]);
      setDecisions([]);
      setShowActions(false);
      
      const errorMessage = error?.message || 'Failed to extract actions';
      Toast.show({
        type: 'error',
        text1: 'Extraction Failed',
        text2: errorMessage.length > 50 ? 'Please try again later' : errorMessage,
        position: 'bottom',
        visibilityTime: 4000,
      });
    } finally {
      setLoadingActions(false);
    }
  };

  const handleRefreshActions = async () => {
    await generateActions();
  };

  const handleShareActions = async () => {
    try {
      let message = `Action Items & Decisions: ${threadName}\n\n`;
      
      if (actionItems.length > 0) {
        message += `📋 Action Items:\n`;
        actionItems.forEach((item, i) => {
          message += `${i + 1}. ${item.task}\n`;
          if (item.assignee) {
            const displayName = userCache[item.assignee]?.displayName || item.assignee;
            message += `   👤 ${displayName}\n`;
          }
          if (item.due) message += `   📅 ${item.due}\n`;
        });
        message += '\n';
      }
      
      if (decisions.length > 0) {
        message += `✅ Decisions:\n`;
        decisions.forEach((item, i) => {
          message += `${i + 1}. ${item.summary}\n`;
          if (item.owner) {
            const displayName = userCache[item.owner]?.displayName || item.owner;
            message += `   👤 ${displayName}\n`;
          }
        });
      }
      
      await Share.share({
        message,
        title: `Action Items & Decisions: ${threadName}`,
      });
    } catch (error) {
      console.error('Error sharing actions:', error);
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <HydrationBanner userId={user?.uid || null} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{threadName}</Text>
          <Text style={[styles.presence, { color: colors.textSecondary }]}>{presenceInfo}</Text>
        </View>
        {/* Profile Photo or Members Button */}
        {isGroupChat ? (
          <TouchableOpacity 
            style={styles.membersIconButton}
            onPress={() => setShowMembersModal(true)}
          >
            <Ionicons name="people" size={24} color="#007AFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerProfilePhoto}>
            {otherUserId && userCache[otherUserId]?.photoURL ? (
              <Image 
                source={{ uri: userCache[otherUserId].photoURL }} 
                style={styles.profilePhotoImage}
              />
            ) : (
              <View style={styles.profilePhotoCircle}>
                <Text style={styles.profilePhotoText}>
                  {threadName?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={[styles.presenceDot, isOnline ? styles.presenceDotOnline : styles.presenceDotOffline]} />
          </View>
        )}
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
          <TouchableOpacity style={styles.summarizeButton} onPress={handleExtractActions}>
            <Ionicons name="list-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item, index }) => {
          const showSender = index === 0 || messages[index - 1].senderId !== item.senderId;
          const senderName = (userCache[item.senderId]?.displayName && typeof userCache[item.senderId].displayName === 'string') 
            ? userCache[item.senderId].displayName 
            : 'User';
          
          
          return (
            <ErrorBoundary name={`MessageBubble-${item.id}`} fallback={<View style={{ height: 50 }} />}>
              <MessageBubble
                item={item}
                me={user?.uid || ''}
                showSender={showSender}
                senderName={senderName}
                threadId={threadId}
                onForward={handleForwardMessage}
              />
            </ErrorBoundary>
          );
        }}
        ListHeaderComponent={hasMoreMessages ? (
          <TouchableOpacity 
            style={[styles.loadMoreButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="arrow-up-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load Earlier Messages</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
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
            <Text style={styles.modalTitle} numberOfLines={1}>{summaryTitle}</Text>
            <View style={styles.modalHeaderButtons}>
              {!loadingSummary && summary && (
                <>
                  <TouchableOpacity 
                    onPress={handleResummarize}
                    style={styles.shareButton}
                  >
                    <Ionicons name="refresh-outline" size={24} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleShareSummary}
                    style={styles.shareButton}
                  >
                    <Ionicons name="share-outline" size={24} color="#007AFF" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => setShowSummary(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>
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

      {/* Actions Modal */}
      <Modal
        visible={showActions}
        animationType="slide"
        onRequestClose={() => setShowActions(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { flex: 1, marginRight: 12 }]}>Action Items & Decisions</Text>
            <View style={styles.modalHeaderButtons}>
              {!loadingActions && (actionItems.length > 0 || decisions.length > 0) && (
                <>
                  <TouchableOpacity 
                    onPress={handleRefreshActions}
                    style={styles.shareButton}
                  >
                    <Ionicons name="refresh-outline" size={24} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleShareActions}
                    style={styles.shareButton}
                  >
                    <Ionicons name="share-outline" size={24} color="#007AFF" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => setShowActions(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {loadingActions ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.modalLoader} />
            ) : (
              <>
                {/* Action Items */}
                <Text style={styles.sectionTitle}>📋 Action Items ({actionItems.length})</Text>
                {actionItems.length === 0 ? (
                  <Text style={styles.emptyText}>No action items found in this conversation.</Text>
                ) : (
                  actionItems.map((item, index) => {
                    // Check if assignee is a user ID (long string) or a name
                    let assigneeDisplayName = null;
                    if (item.assignee) {
                      if (item.assignee.length > 20) {
                        // Likely a user ID, look up in cache
                        assigneeDisplayName = userCache[item.assignee]?.displayName || item.assignee;
                      } else {
                        // Likely already a name from AI extraction
                        assigneeDisplayName = item.assignee;
                      }
                    }
                    return (
                      <View key={index} style={styles.actionItem}>
                        <View style={styles.actionItemHeader}>
                          <Ionicons name="checkbox-outline" size={20} color="#007AFF" />
                          <Text style={styles.actionItemTask}>{item.task}</Text>
                        </View>
                        {assigneeDisplayName && (
                          <Text style={styles.actionItemMeta}>👤 {assigneeDisplayName}</Text>
                        )}
                        {item.due && (
                          <Text style={styles.actionItemMeta}>📅 {item.due}</Text>
                        )}
                      </View>
                    );
                  })
                )}

                {/* Decisions */}
                <Text style={[styles.sectionTitle, { marginTop: 32 }]}>✅ Decisions ({decisions.length})</Text>
                {decisions.length === 0 ? (
                  <Text style={styles.emptyText}>No decisions found in this conversation.</Text>
                ) : (
                  decisions.map((item, index) => {
                    // Check if owner is a user ID (long string) or a name
                    let ownerDisplayName = null;
                    if (item.owner) {
                      if (item.owner.length > 20) {
                        // Likely a user ID, look up in cache
                        ownerDisplayName = userCache[item.owner]?.displayName || item.owner;
                      } else {
                        // Likely already a name from AI extraction
                        ownerDisplayName = item.owner;
                      }
                    }
                    return (
                      <View key={index} style={styles.decisionItem}>
                        <Text style={styles.decisionSummary}>{item.summary}</Text>
                        {ownerDisplayName && (
                          <Text style={styles.decisionMeta}>👤 {ownerDisplayName}</Text>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMembersModal(false)}
      >
        <TouchableOpacity 
          style={styles.membersModalOverlay}
          activeOpacity={1}
          onPress={() => setShowMembersModal(false)}
        >
          <View style={styles.membersModalContent}>
            <View style={styles.membersModalHeader}>
              <Text style={styles.membersModalTitle}>Group Members ({threadMembers.length})</Text>
              <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.membersList}>
              {threadMembers.map((memberId) => {
                const memberData = userCache[memberId];
                const isCurrentUser = memberId === user?.uid;
                const displayName = isCurrentUser 
                  ? 'You' 
                  : (memberData?.displayName || 'Unknown User');
                const photoURL = memberData?.photoURL;
                
                return (
                  <View key={memberId} style={styles.memberItem}>
                    {photoURL ? (
                      <Image source={{ uri: photoURL }} style={styles.memberAvatar} />
                    ) : (
                      <View style={styles.memberAvatarPlaceholder}>
                        <Text style={styles.memberAvatarText}>
                          {displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.memberName}>{displayName}</Text>
                    {isCurrentUser && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>You</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Forward Modal */}
      <Modal
        visible={showForwardModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowForwardModal(false)}
      >
        <TouchableOpacity 
          style={styles.membersModalOverlay}
          activeOpacity={1}
          onPress={() => setShowForwardModal(false)}
        >
          <View style={styles.membersModalContent}>
            <View style={styles.membersModalHeader}>
              <Text style={styles.membersModalTitle}>Forward Message To</Text>
              <TouchableOpacity onPress={() => setShowForwardModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.membersList}>
              {threads.filter(t => t.id !== threadId).map((thread) => {
                // Get thread display name - either group name or other user's display name
                let threadDisplayName: string = 'Chat';
                if (thread?.name && typeof thread.name === 'string') {
                  threadDisplayName = thread.name;
                } else if (thread?.members && Array.isArray(thread.members)) {
                  const otherMember = thread.members.find((m: string) => m !== user?.uid);
                  if (otherMember && userCache[otherMember] && typeof userCache[otherMember].displayName === 'string') {
                    threadDisplayName = userCache[otherMember].displayName;
                  }
                }
                
                return (
                  <TouchableOpacity 
                    key={thread.id} 
                    style={styles.forwardThreadItem}
                    onPress={() => handleForwardToThread(thread.id)}
                  >
                    <View style={styles.forwardThreadInfo}>
                      <Text style={styles.forwardThreadName}>{threadDisplayName}</Text>
                      {thread.unreadCount && thread.unreadCount > 0 && (
                        <View style={styles.forwardThreadBadge}>
                          <Text style={styles.forwardThreadBadgeText}>{thread.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name="arrow-forward" size={20} color="#007AFF" />
                  </TouchableOpacity>
                );
              })}
              {threads.filter(t => t.id !== threadId).length === 0 && (
                <Text style={styles.noThreadsText}>No other chats available</Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
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
    paddingTop: 12,
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
  headerProfilePhoto: {
    marginLeft: 12,
    marginRight: 8,
  },
  profilePhotoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhotoImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E5EA',
  },
  profilePhotoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#F9F9F9',
  },
  presenceDotOnline: {
    backgroundColor: '#34C759',
  },
  presenceDotOffline: {
    backgroundColor: '#8E8E93',
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
    flex: 1,
    marginRight: 12,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareButton: {
    padding: 4,
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
  membersIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  membersModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  membersModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  membersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  membersModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  membersList: {
    padding: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E5EA',
    marginRight: 12,
  },
  memberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
  },
  youBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  youBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  actionItem: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionItemTask: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginLeft: 8,
    flex: 1,
  },
  actionItemMeta: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 28,
    marginTop: 4,
  },
  decisionItem: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  decisionSummary: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  decisionMeta: {
    fontSize: 14,
    color: '#666666',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  forwardThreadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  forwardThreadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  forwardThreadName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
  },
  forwardThreadBadge: {
    backgroundColor: '#007AFF',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  forwardThreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  noThreadsText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 15,
    marginTop: 20,
  },
});

