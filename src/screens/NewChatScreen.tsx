import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, query, getDocs, addDoc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

export default function NewChatScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGroupNameModal, setShowGroupNameModal] = useState(false);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.displayName.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    try {
      const usersQuery = query(collection(db, 'users'));
      const snapshot = await getDocs(usersQuery);
      
      const fetchedUsers = snapshot.docs
        .map((doc) => ({ uid: doc.id, ...doc.data() } as User))
        .filter((u) => u.uid !== user?.uid); // Exclude current user
      
      setUsers(fetchedUsers);
      setFilteredUsers(fetchedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (uid: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(uid)) {
      newSelection.delete(uid);
    } else {
      newSelection.add(uid);
    }
    setSelectedUsers(newSelection);
  };

  const checkForDuplicateThread = async (memberIds: string[]) => {
    try {
      const threadsQuery = query(
        collection(db, 'threads'),
        where('members', 'array-contains', user!.uid)
      );
      
      const snapshot = await getDocs(threadsQuery);
      
      // Find exact match (same members, same count)
      const duplicateThread = snapshot.docs.find((doc) => {
        const data = doc.data();
        const threadMembers = data.members as string[];
        
        // Check if exact same members (order doesn't matter)
        if (threadMembers.length !== memberIds.length) return false;
        
        return memberIds.every(id => threadMembers.includes(id)) &&
               threadMembers.every(id => memberIds.includes(id));
      });

      return duplicateThread || null;
    } catch (error) {
      console.error('Error checking for duplicate thread:', error);
      return null;
    }
  };

  const createChat = async () => {
    if (selectedUsers.size === 0) {
      Alert.alert('Error', 'Please select at least one person');
      return;
    }

    setCreating(true);

    try {
      const memberIds = [user!.uid, ...Array.from(selectedUsers)];
      
      // Check for duplicate
      const existingThread = await checkForDuplicateThread(memberIds);
      
      if (existingThread) {
        // Navigate to existing thread
        const threadData = existingThread.data();
        let threadName = 'Chat';
        
        if (threadData.name) {
          threadName = threadData.name;
        } else if (memberIds.length === 2) {
          // 1:1 chat - use other user's name
          const otherUserId = memberIds.find(id => id !== user!.uid);
          const otherUser = users.find(u => u.uid === otherUserId);
          threadName = otherUser?.displayName || 'Chat';
        }
        
        navigation.navigate('Chat' as never, { 
          threadId: existingThread.id,
          threadName
        } as never);
        setCreating(false);
        return;
      }

      // No duplicate - check if group chat (2+ other people)
      if (selectedUsers.size >= 2) {
        // Show modal to get group name
        setCreating(false);
        setGroupName('');
        setShowGroupNameModal(true);
      } else {
        // 1:1 chat - create immediately
        await createNewThread(memberIds, undefined, 'direct');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', 'Failed to create chat');
      setCreating(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    setShowGroupNameModal(false);
    setCreating(true);

    try {
      const memberIds = [user!.uid, ...Array.from(selectedUsers)];
      await createNewThread(memberIds, groupName.trim(), 'group');
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group');
      setCreating(false);
    }
  };

  const createNewThread = async (memberIds: string[], groupName?: string, type: 'direct' | 'group' = 'direct') => {
    try {
      // Initialize lastRead for all members to current time (so they don't see old messages as unread)
      const lastRead: { [key: string]: any } = {};
      memberIds.forEach(memberId => {
        lastRead[memberId] = serverTimestamp();
      });

      const threadData: any = {
        type,
        members: memberIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: null,
        typing: {},
        lastRead, // Initialize lastRead for all members
      };

      if (groupName) {
        threadData.name = groupName;
      }

      const threadRef = await addDoc(collection(db, 'threads'), threadData);
      
      // Navigate to new thread
      let threadName = groupName || 'Chat';
      if (!groupName && memberIds.length === 2) {
        const otherUserId = memberIds.find(id => id !== user!.uid);
        const otherUser = users.find(u => u.uid === otherUserId);
        threadName = otherUser?.displayName || 'Chat';
      }
      
      navigation.navigate('Chat' as never, { 
        threadId: threadRef.id,
        threadName
      } as never);
    } catch (error) {
      console.error('Error creating new thread:', error);
      Alert.alert('Error', 'Failed to create thread');
    } finally {
      setCreating(false);
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.has(item.uid);
    
    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => toggleUserSelection(item.uid)}
        disabled={creating}
      >
        <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
          <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
            {item.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>

        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
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
      {/* Selected Count */}
      {selectedUsers.size > 0 && (
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionText}>
            {selectedUsers.size} selected
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* User List */}
      {filteredUsers.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No users found' : 'No other users yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Try a different search term'
              : 'Invite your team members to sign up!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Create Button */}
      {selectedUsers.size > 0 && (
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={createChat}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>
              {selectedUsers.size === 1 ? 'Start Chat' : `Create Group (${selectedUsers.size + 1})`}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {creating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {selectedUsers.size === 1 ? 'Creating chat...' : 'Creating group...'}
          </Text>
        </View>
      )}

      {/* Group Name Modal */}
      <Modal
        visible={showGroupNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGroupNameModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Group Name</Text>
            <Text style={styles.modalSubtext}>
              Enter a name for this group
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Family Chat"
              value={groupName}
              onChangeText={setGroupName}
              autoCapitalize="words"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowGroupNameModal(false);
                  setGroupName('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCreate]}
                onPress={handleCreateGroup}
              >
                <Text style={styles.modalButtonTextCreate}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  selectionHeader: {
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
    alignItems: 'center',
  },
  selectionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#F2F2F7',
  },
  list: {
    paddingVertical: 8,
    paddingBottom: 100,
  },
  userItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  userItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSelected: {
    backgroundColor: '#007AFF',
  },
  avatarText: {
    color: '#666',
    fontSize: 20,
    fontWeight: '600',
  },
  avatarTextSelected: {
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
  createButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#F2F2F7',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F2F2F7',
  },
  modalButtonCreate: {
    backgroundColor: '#007AFF',
  },
  modalButtonTextCancel: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
  },
  modalButtonTextCreate: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
