import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { createCalendarEvent, parseSchedulingRequest } from '../services/googleCalendar';
import * as Haptics from 'expo-haptics';

interface CalendarEventCardProps {
  eventId: string;
  summary: string;
  description?: string;
  location?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  attendees: string[];
  confidence: number;
  onAccept?: () => void;
  onReject?: () => void;
}

export default function CalendarEventCard({
  eventId,
  summary,
  description,
  location,
  startTime,
  endTime,
  attendees,
  confidence,
  onAccept,
  onReject,
}: CalendarEventCardProps) {
  const { colors } = useTheme();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleCreateEvent = async () => {
    try {
      setCreating(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const event = parseSchedulingRequest(
        summary,
        new Date(startTime),
        new Date(endTime),
        attendees,
        description,
        location
      );

      const eventLink = await createCalendarEvent(event);

      if (eventLink) {
        setCreated(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Event Created! 📅',
          'The calendar event has been added to your Google Calendar.',
          [{ text: 'OK' }]
        );
        onAccept?.();
      }
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to create calendar event');
    } finally {
      setCreating(false);
    }
  };

  const handleReject = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReject?.();
  };

  if (created) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Event Added to Calendar</Text>
        </View>
        <Text style={[styles.summary, { color: colors.text }]}>{summary}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={24} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>📅 Schedule This?</Text>
      </View>

      {/* Event Details */}
      <View style={styles.details}>
        <Text style={[styles.summary, { color: colors.text }]}>{summary}</Text>
        
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {formatDateTime(startTime)}
          </Text>
        </View>

        {location && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>{location}</Text>
          </View>
        )}

        {attendees.length > 0 && (
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {attendees.length} attendee{attendees.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {description && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
        )}

        {/* Confidence Badge */}
        {confidence < 0.9 && (
          <View style={[styles.confidenceBadge, { backgroundColor: colors.background }]}>
            <Text style={[styles.confidenceText, { color: colors.textSecondary }]}>
              AI Confidence: {Math.round(confidence * 100)}%
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.rejectButton, { borderColor: colors.border }]}
          onPress={handleReject}
          disabled={creating}
        >
          <Text style={[styles.rejectButtonText, { color: colors.textSecondary }]}>Not Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: colors.primary }]}
          onPress={handleCreateEvent}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>Add to Calendar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  details: {
    gap: 8,
  },
  summary: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
  },
  description: {
    fontSize: 14,
    marginTop: 4,
    fontStyle: 'italic',
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  confidenceText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

