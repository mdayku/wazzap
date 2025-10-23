import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { collection, query, orderBy, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import { formatTimestamp } from '../utils/time';
import { extractAI } from '../services/ai';
import { simulateAIStream, EXTRACT_STEPS } from '../utils/aiStreamSimulator';

interface Decision {
  id: string;
  summary: string;
  owner: string | null;
  messageId: string;
  decidedAt: Timestamp;
  threadId: string;
}

export default function DecisionsScreen({ route, navigation }: any) {
  const { threadId } = route.params;
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userCache, setUserCache] = useState<Record<string, string>>({});
  const [streamingMessage, setStreamingMessage] = useState('');

  useEffect(() => {
    if (!threadId) return;

    const q = query(
      collection(db, `threads/${threadId}/decisions`),
      orderBy('decidedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const decisionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        threadId,
        ...doc.data(),
      })) as Decision[];

      setDecisions(decisionsData);
      setLoading(false);

      // Fetch display names for all owners
      const uniqueOwners = [...new Set(decisionsData.map(d => d.owner).filter(Boolean))] as string[];
      
      if (uniqueOwners.length > 0) {
        const newCache: Record<string, string> = {};
        await Promise.all(
          uniqueOwners.map(async (userId) => {
            try {
              const userDoc = await getDoc(doc(db, 'users', userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                newCache[userId] = userData?.displayName || userData?.email || userId;
              } else {
                newCache[userId] = userId;
              }
            } catch (error) {
              console.error(`Error fetching user ${userId}:`, error);
              newCache[userId] = userId;
            }
          })
        );
        setUserCache(prev => ({ ...prev, ...newCache }));
      }
    });

    return () => unsubscribe();
  }, [threadId]);

  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    
    // Start streaming simulation
    const cancelStream = simulateAIStream(
      EXTRACT_STEPS,
      (message) => setStreamingMessage(message),
      () => setStreamingMessage('')
    );
    
    try {
      await extractAI(threadId, 50);
      
      // Cancel streaming when we get the real result
      cancelStream();
      setStreamingMessage('');
    } catch (error) {
      console.error('Error refreshing decisions:', error);
      
      // Cancel streaming on error
      cancelStream();
      setStreamingMessage('');
      
      Alert.alert('Error', 'Failed to refresh decisions. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleShare = async () => {
    if (decisions.length === 0) {
      Alert.alert('No Decisions', 'There are no decisions to share yet.');
      return;
    }

    try {
      let shareText = `✅ Decisions (${decisions.length}):\n\n`;
      
      decisions.forEach((decision, index) => {
        shareText += `${index + 1}. ${decision.summary}\n`;
        if (decision.owner) {
          const ownerName = userCache[decision.owner] || decision.owner;
          shareText += `   👤 ${ownerName}\n`;
        }
        shareText += `   📅 ${formatTimestamp(decision.decidedAt)}\n\n`;
      });

      await Share.share({
        message: shareText,
      });
    } catch (error) {
      console.error('Error sharing decisions:', error);
    }
  };

  const renderDecision = ({ item }: { item: Decision }) => (
    <TouchableOpacity
      style={styles.decisionItem}
      onPress={() => {
        navigation.navigate('Chat', {
          threadId: item.threadId,
          messageId: item.messageId,
        });
      }}
    >
      <View style={styles.decisionIcon}>
        <Ionicons name="checkmark-circle" size={24} color="#34C759" />
      </View>
      
      <View style={styles.decisionContent}>
        <Text style={styles.decisionText}>{item.summary}</Text>
        
        <View style={styles.decisionMeta}>
          {item.owner && (
            <Text style={styles.owner}>
              {userCache[item.owner] || item.owner}
            </Text>
          )}
          <Text style={styles.timestamp}>
            {formatTimestamp(item.decidedAt)}
          </Text>
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Decisions</Text>
        <View style={styles.headerButtons}>
          {decisions.length > 0 && (
            <>
              <TouchableOpacity 
                onPress={handleRefresh} 
                style={styles.headerButton}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Ionicons name="refresh-outline" size={24} color="#007AFF" />
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleShare} 
                style={styles.headerButton}
              >
                <Ionicons name="share-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {decisions.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No decisions tracked yet</Text>
          <Text style={styles.emptySubtext}>
            Decisions will be automatically extracted from messages
          </Text>
        </View>
      ) : (
        <FlatList
          data={decisions}
          renderItem={renderDecision}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Streaming Message Overlay */}
      {refreshing && streamingMessage && (
        <View style={styles.streamingOverlay}>
          <View style={styles.streamingCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.streamingText}>{streamingMessage}</Text>
          </View>
        </View>
      )}
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
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  list: {
    padding: 16,
  },
  decisionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  decisionIcon: {
    marginRight: 12,
  },
  decisionContent: {
    flex: 1,
  },
  decisionText: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 6,
    fontWeight: '500',
  },
  decisionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  owner: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginRight: 12,
  },
  timestamp: {
    fontSize: 13,
    color: '#999',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  streamingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  streamingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
    textAlign: 'center',
  },
});

