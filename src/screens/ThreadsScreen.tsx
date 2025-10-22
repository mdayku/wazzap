import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useThreads } from '../hooks/useThread';
import { useAuth } from '../hooks/useAuth';
import ErrorBoundary from '../components/ErrorBoundary';
import HydrationBanner from '../components/HydrationBanner';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { formatTimestamp, isUserOnline } from '../utils/time';
import { registerForPush } from '../services/notifications';
import { Timestamp } from 'firebase/firestore';

interface UserCache {
  [uid: string]: { displayName: string; photoURL?: string; presence?: Timestamp };
}

export default function ThreadsScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { threads, loading } = useThreads(user?.uid || null);
  const [userCache, setUserCache] = useState<UserCache>({});

  useEffect(() => {
    if (user) {
      // Register for push notifications
      registerForPush(user.uid).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    if (!user || threads.length === 0) return;

    // Collect all unique member UIDs
    const uids = new Set<string>();
    threads.forEach(thread => {
      thread.members.forEach(uid => {
        if (uid !== user.uid) {
          uids.add(uid);
        }
      });
    });

    if (uids.size === 0) return;

    // Set up real-time listeners for each user's presence
    const unsubscribers: (() => void)[] = [];

    Array.from(uids).forEach((uid) => {
      const userRef = doc(db, 'users', uid);
      const unsubscribe = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data();
          setUserCache(prev => ({
            ...prev,
            [uid]: {
              displayName: userData.displayName || 'User',
              photoURL: userData.photoURL,
              presence: userData.lastSeen, // Use lastSeen for presence
            }
          }));
        }
      });
      unsubscribers.push(unsubscribe);
    });

    // Cleanup all listeners on unmount
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [threads, user]);

  const getThreadName = (thread: any): string => {
    if (thread?.name && typeof thread.name === 'string') return thread.name;
    
    if (thread?.members && Array.isArray(thread.members)) {
      const otherMember = thread.members.find((m: string) => m !== user?.uid);
      if (otherMember && userCache[otherMember] && typeof userCache[otherMember].displayName === 'string') {
        return userCache[otherMember].displayName;
      }
    }
    
    return 'Chat';
  };

  // Render a single avatar with presence dot
  const renderAvatar = (uid: string, size: number = 50, showPresence: boolean = true) => {
    const userData = userCache[uid];
    const isOnline = userData?.presence ? isUserOnline(userData.presence) : false;
    const displayName = (userData?.displayName && typeof userData.displayName === 'string') ? userData.displayName : 'User';
    const photoURL = userData?.photoURL;

    return (
      <View style={[styles.avatarContainer, { width: size, height: size }]}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]} />
        ) : (
          <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {showPresence && (
          <View style={[styles.presenceDot, isOnline ? styles.presenceDotOnline : styles.presenceDotOffline]} />
        )}
      </View>
    );
  };

  // Render avatars for group chats (show up to 2 members)
  const renderGroupAvatars = (thread: any) => {
    if (!thread.members || !Array.isArray(thread.members)) {
      return null;
    }
    
    const otherMembers = thread.members.filter((m: string) => m !== user?.uid).slice(0, 2);
    
    if (otherMembers.length === 0) {
      return null;
    }
    
    if (otherMembers.length === 1) {
      return renderAvatar(otherMembers[0], 50, true);
    }
    
    // Show 2 overlapping avatars for group chats
    return (
      <View style={styles.groupAvatarContainer}>
        {renderAvatar(otherMembers[0], 36, false)}
        <View style={styles.groupAvatarOverlap}>
          {renderAvatar(otherMembers[1], 36, false)}
        </View>
      </View>
    );
  };

  const renderThread = ({ item }: any) => {
    const unreadCount = item.unreadCount || 0;
    const hasUnread = unreadCount > 0;
    const isGroupChat = item.type === 'group' || (item.members && Array.isArray(item.members) && item.members.length > 2);
    
    
    return (
      <TouchableOpacity
        style={[styles.threadItem, { borderBottomColor: colors.border }]}
        onPress={() => navigation.navigate('Chat' as never, { threadId: item.id, threadName: getThreadName(item) } as never)}
      >
        {isGroupChat ? renderGroupAvatars(item) : (
          <>
            {item.members && Array.isArray(item.members) && item.members.filter((m: string) => m !== user?.uid).map((uid: string) => (
              <View key={uid}>
                {renderAvatar(uid, 50, true)}
              </View>
            ))[0]}
          </>
        )}
        
        <View style={styles.threadContent}>
          <View style={styles.threadHeader}>
            <Text style={[styles.threadName, { color: colors.text }]}>{getThreadName(item)}</Text>
            <View style={styles.headerRight}>
              {item.lastMessage?.timestamp && formatTimestamp(item.lastMessage.timestamp) && (
                <Text style={styles.timestamp}>
                  {formatTimestamp(item.lastMessage.timestamp)}
                </Text>
              )}
              {hasUnread && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{String(unreadCount)}</Text>
                </View>
              )}
            </View>
          </View>
          
          {item.lastMessage?.text && typeof item.lastMessage.text === 'string' ? (
            <Text style={[styles.lastMessage, { color: colors.textSecondary }, hasUnread && styles.lastMessageUnread]} numberOfLines={1}>
              {item.lastMessage.text}
            </Text>
          ) : item.lastMessage?.media?.type === 'image' ? (
            <Text style={[styles.lastMessage, { color: colors.textSecondary }, hasUnread && styles.lastMessageUnread]}>
              📷 Image
            </Text>
          ) : item.lastMessage?.media?.type === 'audio' ? (
            <Text style={[styles.lastMessage, { color: colors.textSecondary }, hasUnread && styles.lastMessageUnread]}>
              🎤 Audio
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
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
      
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Profile' as never)} 
          style={styles.profileButton}
        >
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>
      
      {threads.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the + button to start chatting
          </Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          renderItem={({ item, index }) => (
            <ErrorBoundary name={`Thread-${item.id}`} fallback={<View style={{ height: 80 }} />}>
              {renderThread({ item, index })}
            </ErrorBoundary>
          )}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat' as never)}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  profileButton: {
    padding: 4,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  list: {
    paddingVertical: 8,
  },
  threadItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    backgroundColor: '#E5E5EA',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  groupAvatarContainer: {
    flexDirection: 'row',
    width: 60,
    height: 50,
    marginRight: 12,
    position: 'relative',
  },
  groupAvatarOverlap: {
    position: 'absolute',
    left: 24,
    top: 7,
  },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  presenceDotOnline: {
    backgroundColor: '#34C759',
  },
  presenceDotOffline: {
    backgroundColor: '#8E8E93',
  },
  threadContent: {
    flex: 1,
    justifyContent: 'center',
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  threadName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timestamp: {
    fontSize: 14,
    color: '#999',
  },
  badge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lastMessage: {
    fontSize: 15,
    color: '#666',
  },
  lastMessageUnread: {
    fontWeight: '600',
    color: '#000000',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
  },
});

