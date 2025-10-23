import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProactiveSuggestion } from '../services/proactive';

interface ProactiveSuggestionPillProps {
  suggestion: ProactiveSuggestion;
  onPress: () => void;
  onDismiss: () => void;
  onFeedback: (feedback: 'positive' | 'negative') => void;
}

export default function ProactiveSuggestionPill({
  suggestion,
  onPress,
  onDismiss,
  onFeedback,
}: ProactiveSuggestionPillProps) {
  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animated entrance
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getIcon = () => {
    switch (suggestion.type) {
      case 'schedule':
        return 'calendar-outline';
      case 'question_followup':
        return 'help-circle-outline';
      case 'action_reminder':
        return 'checkbox-outline';
      case 'draft_message':
        return 'create-outline';
      case 'info_gap':
        return 'information-circle-outline';
      case 'decision_prompt':
        return 'git-branch-outline';
      default:
        return 'bulb-outline';
    }
  };

  const getPriorityColor = () => {
    switch (suggestion.priority) {
      case 'high':
        return '#FF3B30';
      case 'medium':
        return '#FF9500';
      case 'low':
        return '#007AFF';
      default:
        return '#007AFF';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.pill, { borderLeftColor: getPriorityColor() }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={getIcon()} size={20} color={getPriorityColor()} />
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            ✨ {suggestion.title}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {suggestion.description}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onFeedback('positive');
            }}
          >
            <Ionicons name="thumbs-up-outline" size={18} color="#34C759" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onFeedback('negative');
            }}
          >
            <Ionicons name="thumbs-down-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
          >
            <Ionicons name="close" size={18} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

