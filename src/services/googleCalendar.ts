// Google Calendar integration - requires Google Sign-In with native modules
// Currently disabled for Expo Go compatibility
// To enable: implement Google Sign-In with development build

import { Alert } from 'react-native';

export interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string; // ISO 8601 format
    timeZone?: string;
  };
  end: {
    dateTime: string; // ISO 8601 format
    timeZone?: string;
  };
  attendees?: Array<{ email: string }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
}

/**
 * Request Google Calendar access
 * NOTE: Currently disabled - requires Google Sign-In with native modules
 */
export async function requestCalendarAccess(): Promise<boolean> {
  Alert.alert(
    'Feature Unavailable',
    'Google Calendar integration requires Google Sign-In, which needs a development build. Currently using Expo Go.'
  );
  return false;
}

/**
 * Create a Google Calendar event
 * NOTE: Currently disabled - requires Google Sign-In with native modules
 */
export async function createCalendarEvent(_event: CalendarEvent): Promise<string | null> {
  Alert.alert(
    'Feature Unavailable',
    'Google Calendar integration requires Google Sign-In, which needs a development build.'
  );
  return null;
}

/**
 * Parse a natural language scheduling request into a CalendarEvent
 * This is a helper function - the actual parsing is done by the AI
 */
export function parseSchedulingRequest(
  summary: string,
  startTime: Date,
  endTime: Date,
  attendeeEmails: string[] = [],
  description?: string,
  location?: string
): CalendarEvent {
  return {
    summary,
    description,
    location,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    attendees: attendeeEmails.map(email => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 30 }, // 30 minutes before
      ],
    },
  };
}

/**
 * Get user's Google Calendar events for a date range
 * NOTE: Currently disabled - requires Google Sign-In with native modules
 */
export async function getCalendarEvents(
  _startDate: Date,
  _endDate: Date
): Promise<CalendarEvent[]> {
  return [];
}
