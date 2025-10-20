import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

interface SearchResult {
  messageId: string;
  threadId: string;
  text: string;
  similarity: number;
}

export default function SearchScreen({ route, navigation }: any) {
  const { threadId } = route.params || {};
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setSearchPerformed(true);

    try {
      const search = httpsCallable(functions, 'search');
      const result = await search({ query: query.trim(), threadId, limit: 20 });
      const data = result.data as any;
      
      setResults(data.results || []);
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => {
        navigation.navigate('Chat', {
          threadId: item.threadId,
          messageId: item.messageId,
        });
      }}
    >
      <View style={styles.resultContent}>
        <Text style={styles.resultText} numberOfLines={2}>
          {item.text}
        </Text>
        <View style={styles.resultMeta}>
          <Text style={styles.similarity}>
            {Math.round(item.similarity * 100)}% match
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search messages by meaning..."
          placeholderTextColor="#999"
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.searchButton, !query.trim() && styles.searchButtonDisabled]}
        onPress={handleSearch}
        disabled={!query.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.searchButtonText}>Search</Text>
        )}
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching...</Text>
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
            <Ionicons name="search-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              Try different keywords or phrases
            </Text>
          </View>
        )
      ) : (
        <View style={styles.centered}>
          <Ionicons name="sparkles-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>Semantic Search</Text>
          <Text style={styles.emptySubtext}>
            Search by meaning, not just keywords
          </Text>
          <Text style={styles.exampleText}>
            Try: "decisions about the API" or "action items for Alice"
          </Text>
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
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
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
    color: '#666',
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultText: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 4,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarity: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  exampleText: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

