import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { useThreads } from '../hooks/useThread';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { formatTimestamp } from '../utils/time';
import { registerForPush } from '../services/notifications';

interface UserCache {
  [uid: string]: { displayName: string; photoURL?: string };
}

export default function ThreadsScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { threads, loading } = useThreads(user?.uid || null);
  const [userCache, setUserCache] = useState<UserCache>({});

  useEffect(() => {
    if (user) {
      // Register for push notifications
      registerForPush(user.uid).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    // Fetch user data for thread members
    const fetchUsers = async () => {
      const uids = new Set<string>();
      threads.forEach(thread => {
        thread.members.forEach(uid => {
          if (uid !== user?.uid && !userCache[uid]) {
            uids.add(uid);
          }
        });
      });

      const newUsers: UserCache = { ...userCache };
      await Promise.all(
        Array.from(uids).map(async (uid) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              newUsers[uid] = userDoc.data() as any;
            }
          } catch (error) {
            console.error('Error fetching user:', error);
          }
        })
      );

      setUserCache(newUsers);
    };

    if (threads.length > 0) {
      fetchUsers();
    }
  }, [threads]);

  const getThreadName = (thread: any) => {
    if (thread.name) return thread.name;
    
    const otherMember = thread.members.find((m: string) => m !== user?.uid);
    if (otherMember && userCache[otherMember]) {
      return userCache[otherMember].displayName;
    }
    
    return 'Chat';
  };

  const renderThread = ({ item }: any) => {
    const unreadCount = item.unreadCount || 0;
    const hasUnread = unreadCount > 0;
    
    console.log('🔵 [BADGE] Thread:', getThreadName(item), 'unreadCount:', unreadCount);
    
    return (
      <TouchableOpacity
        style={styles.threadItem}
        onPress={() => navigation.navigate('Chat' as never, { threadId: item.id, threadName: getThreadName(item) } as never)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {getThreadName(item).charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.threadContent}>
          <View style={styles.threadHeader}>
            <Text style={styles.threadName}>{getThreadName(item)}</Text>
            <View style={styles.headerRight}>
              {item.lastMessage?.timestamp && (
                <Text style={styles.timestamp}>
                  {formatTimestamp(item.lastMessage.timestamp)}
                </Text>
              )}
              {hasUnread && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
          
          {item.lastMessage?.text && (
            <Text style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]} numberOfLines={1}>
              {item.lastMessage.text}
            </Text>
          )}
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Profile' as never)} 
          style={styles.profileButton}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user?.displayName?.charAt(0).toUpperCase() || '?'}
            </Text>
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
          renderItem={renderThread}
          keyExtractor={(item) => item.id}
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
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
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

