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
} from 'react-native';
import { collection, onSnapshot, orderBy, query, doc, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import Composer from '../components/Composer';
import MessageBubble from '../components/MessageBubble';
import TypingDots from '../components/TypingDots';
import { formatLastSeen, isUserOnline } from '../utils/time';
import { summarizeThread, extractAI } from '../services/ai';

export default function ChatScreen({ route, navigation }: any) {
  const { threadId, threadName } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
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
          const members = threadData.members || [];
          console.log('👥 [USER_CACHE] Thread members:', members);
          setThreadMembers(members);
          
          // Check if it's a group chat (more than 2 members or has a group name)
          const isGroup = members.length > 2 || !!threadData.name;
          setIsGroupChat(isGroup);
          
          // FIRST: Fetch all members' data (for both 1:1 and group chats)
          // This ensures userCache is populated for action items extraction
          console.log('👥 [USER_CACHE] Starting to fetch', members.length, 'members...');
          const memberPromises = members.map(async (memberId: string) => {
            console.log('👥 [USER_CACHE] Fetching user:', memberId);
            try {
              const memberDoc = await getDoc(doc(db, 'users', memberId));
              console.log('👥 [USER_CACHE] Doc exists for', memberId, ':', memberDoc.exists());
              if (memberDoc.exists()) {
                const userData = memberDoc.data();
                console.log('👥 [USER_CACHE] User data for', memberId, ':', userData?.displayName);
                return { [memberId]: userData };
              }
            } catch (error) {
              console.error('👥 [USER_CACHE] Error fetching member', memberId, ':', error);
            }
            return null;
          });
          
          const memberResults = await Promise.all(memberPromises);
          console.log('👥 [USER_CACHE] Promise.all completed, results:', memberResults.length);
          const newCache: any = {};
          memberResults.forEach((result, index) => {
            console.log('👥 [USER_CACHE] Processing result', index, ':', result ? Object.keys(result)[0] : 'null');
            if (result) {
              Object.assign(newCache, result);
            }
          });
          console.log('👥 [USER_CACHE] About to set cache with keys:', Object.keys(newCache));
          setUserCache((prev: any) => {
            const updated = { ...prev, ...newCache };
            console.log('👥 [USER_CACHE] Cache after update - keys:', Object.keys(updated));
            console.log('👥 [USER_CACHE] Cache after update - data:', 
              Object.entries(updated).map(([id, data]: [string, any]) => 
                ({ id, displayName: data?.displayName })
              )
            );
            return updated;
          });
          
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
        console.log(`⌨️ [TYPING] Initializing member docs for ${threadMembers.length} participants`);
        
        // Create member doc for each participant
        await Promise.all(threadMembers.map(async (memberId) => {
          const memberDoc = doc(db, `threads/${threadId}/members`, memberId);
          await setDoc(memberDoc, {
            uid: memberId,
            typing: false,
            lastSeen: new Date()
          }, { merge: true });
          console.log(`⌨️ [TYPING] Initialized member doc for ${memberId}`);
        }));
      } catch (error) {
        console.error('Error initializing member docs:', error);
      }
    };

    initializeMembers();

    console.log(`⌨️ [TYPING] Setting up listener for thread ${threadId}, current user: ${user.uid}`);
    const q = query(collection(db, `threads/${threadId}/members`));
    const unsubscribe = onSnapshot(q, (snap) => {
      console.log(`⌨️ [TYPING] Snapshot received, ${snap.docs.length} member docs`);
      snap.docs.forEach(d => {
        const data = d.data();
        console.log(`⌨️ [TYPING] Member ${d.id}: typing=${data.typing}, isCurrentUser=${d.id === user.uid}`);
      });
      
      // Check if ANY other user is typing
      const someoneTyping = snap.docs.some(d => 
        d.id !== user.uid && d.data().typing === true
      );
      console.log(`⌨️ [TYPING] Someone typing: ${someoneTyping}`);
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
      
      console.log('✅ [READ] Marked thread as read for user:', user.uid);
    } catch (error) {
      console.error('Error updating read receipt:', error);
    }
  };

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
      console.log(`⌨️ [TYPING] Set typing=${isTyping} for user ${user.uid} in thread ${threadId}`);
    } catch (error) {
      console.error('Error updating typing:', error);
    }
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

  const generateSummary = async () => {
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
    } catch (error) {
      console.error('Error summarizing:', error);
      setSummary('Failed to generate summary. Please try again.');
      setSummaryTitle('Thread Summary');
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

  const handleExtractActions = async () => {
    // If we already have cached data, just show it
    if (actionItems.length > 0 || decisions.length > 0) {
      setShowActions(true);
      return;
    }
    
    // Otherwise, fetch new data
    await generateActions();
  };

  const generateActions = async () => {
    setShowActions(true);
    setLoadingActions(true);
    
    try {
      const result = await extractAI(threadId, 50);
      console.log('🤖 [ACTIONS] Extracted:', JSON.stringify(result, null, 2));
      console.log('🤖 [ACTIONS] UserCache keys:', Object.keys(userCache));
      console.log('🤖 [ACTIONS] UserCache full:', JSON.stringify(
        Object.fromEntries(
          Object.entries(userCache).map(([id, data]: [string, any]) => [id, { displayName: data?.displayName, email: data?.email }])
        ), 
        null, 
        2
      ));
      setActionItems(result.actionItems || []);
      setDecisions(result.decisions || []);
    } catch (error) {
      console.error('Error extracting actions:', error);
      setActionItems([]);
      setDecisions([]);
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
              threadId={threadId}
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
});

