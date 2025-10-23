import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal, ScrollView } from 'react-native';
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
  const [showFullModal, setShowFullModal] = useState(false);

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
    <>
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
          onPress={() => setShowFullModal(true)}
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

      {/* Full Suggestion Modal */}
      <Modal
        visible={showFullModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFullModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: getPriorityColor() + '20' }]}>
                <Ionicons name={getIcon()} size={24} color={getPriorityColor()} />
              </View>
              <Text style={styles.modalTitle}>✨ {suggestion.title}</Text>
              <TouchableOpacity onPress={() => setShowFullModal(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.modalLabel}>Description:</Text>
              <Text style={styles.modalDescription}>{suggestion.description}</Text>

              {suggestion.action && (
                <>
                  <Text style={styles.modalLabel}>Suggested Action:</Text>
                  <Text style={styles.modalAction}>{suggestion.action}</Text>
                </>
              )}

              {suggestion.reasoning && (
                <>
                  <Text style={styles.modalLabel}>Why this suggestion:</Text>
                  <Text style={styles.modalReasoning}>{suggestion.reasoning}</Text>
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPositive]}
                onPress={() => {
                  onFeedback('positive');
                  setShowFullModal(false);
                }}
              >
                <Ionicons name="thumbs-up" size={20} color="#FFFFFF" />
                <Text style={styles.modalButtonText}>Helpful</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonNegative]}
                onPress={() => {
                  onFeedback('negative');
                  setShowFullModal(false);
                }}
              >
                <Ionicons name="thumbs-down" size={20} color="#FFFFFF" />
                <Text style={styles.modalButtonText}>Not Helpful</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
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
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalScrollContent: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  modalDescription: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  modalAction: {
    fontSize: 15,
    color: '#007AFF',
    lineHeight: 22,
    fontWeight: '500',
  },
  modalReasoning: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalButtonPositive: {
    backgroundColor: '#34C759',
  },
  modalButtonNegative: {
    backgroundColor: '#FF3B30',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

