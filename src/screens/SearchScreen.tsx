import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';

interface SearchResult {
  messageId: string;
  threadId: string;
  text: string;
  similarity: number;
}

export default function SearchScreen({ route, navigation }: any) {
  const { threadId } = route.params || {};
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [semanticSearchEnabled, setSemanticSearchEnabled] = useState(true);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearchPerformed(true);

    try {
      if (semanticSearchEnabled) {
        // AI-powered semantic search
        const search = httpsCallable(functions, 'search');
        const result = await search({ query: searchQuery.trim(), threadId, limit: 20 });
        const data = result.data as any;
        
        setResults(data.results || []);
      } else {
        // Simple text search (Firestore query)
        const messagesRef = collection(db, `threads/${threadId}/messages`);
        const messagesQuery = query(
          messagesRef,
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snapshot = await getDocs(messagesQuery);
        
        const searchResults: SearchResult[] = [];
        const searchTerm = searchQuery.trim().toLowerCase();
        
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.text && data.text.toLowerCase().includes(searchTerm)) {
            searchResults.push({
              messageId: doc.id,
              threadId: threadId,
              text: data.text,
              similarity: 1.0, // Simple match, no similarity score
            });
          }
        });
        
        setResults(searchResults);
      }
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={[styles.resultItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
      onPress={() => {
        navigation.navigate('Chat', {
          threadId: item.threadId,
          messageId: item.messageId,
        });
      }}
    >
      <View style={styles.resultContent}>
        <Text style={[styles.resultText, { color: colors.text }]} numberOfLines={2}>
          {item.text}
        </Text>
        {semanticSearchEnabled && (
          <View style={styles.resultMeta}>
            <Text style={[styles.similarity, { color: colors.primary }]}>
              {Math.round(item.similarity * 100)}% match
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Search</Text>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={semanticSearchEnabled ? "Search by meaning..." : "Search by text..."}
          placeholderTextColor={colors.textSecondary}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Semantic Search Toggle */}
      <View style={[styles.toggleContainer, { borderBottomColor: colors.border }]}>
        <View style={styles.toggleLabel}>
          <Ionicons 
            name={semanticSearchEnabled ? "sparkles" : "text-outline"} 
            size={20} 
            color={semanticSearchEnabled ? colors.primary : colors.textSecondary} 
            style={{ marginRight: 8 }}
          />
          <View>
            <Text style={[styles.toggleTitle, { color: colors.text }]}>
              Smart Search {semanticSearchEnabled && '✨'}
            </Text>
            <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
              {semanticSearchEnabled 
                ? 'AI-powered semantic search' 
                : 'Simple text matching'}
            </Text>
          </View>
        </View>
        <Switch
          value={semanticSearchEnabled}
          onValueChange={setSemanticSearchEnabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      <TouchableOpacity
        style={[styles.searchButton, !searchQuery.trim() && styles.searchButtonDisabled]}
        onPress={handleSearch}
        disabled={!searchQuery.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.searchButtonText}>Search</Text>
        )}
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {semanticSearchEnabled ? 'Searching with AI...' : 'Searching...'}
          </Text>
        </View>
      ) : searchPerformed ? (
        results.length > 0 ? (
          <FlatList
            data={results}
            renderItem={renderResult}
            keyExtractor={(item, index) => `${item.messageId}-${index}`}
            contentContainerStyle={styles.resultsList}
          />
        ) : (
          <View style={styles.centered}>
            <Ionicons name="search-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No results found</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Try different keywords or phrases
            </Text>
          </View>
        )
      ) : (
        <View style={styles.centered}>
          <Ionicons name={semanticSearchEnabled ? "sparkles-outline" : "text-outline"} size={64} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {semanticSearchEnabled ? 'Semantic Search ✨' : 'Text Search'}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            {semanticSearchEnabled 
              ? 'Search by meaning, not just keywords'
              : 'Search for exact text matches'}
          </Text>
          <Text style={[styles.exampleText, { color: colors.primary }]}>
            {semanticSearchEnabled
              ? 'Try: "decisions about the API"'
              : 'Try: "production" or "deploy"'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  toggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  searchButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    height: 44,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#CCC',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  resultContent: {
    flex: 1,
  },
  resultText: {
    fontSize: 15,
    marginBottom: 4,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarity: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  exampleText: {
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

