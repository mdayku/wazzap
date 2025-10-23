import { GoogleSignin } from '@react-native-google-signin/google-signin';
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
 * This will prompt the user to grant calendar permissions
 */
export async function requestCalendarAccess(): Promise<boolean> {
  try {
    // Check if user is signed in
    const isSignedIn = await GoogleSignin.isSignedIn();
    if (!isSignedIn) {
      Alert.alert('Not Signed In', 'Please sign in with Google to use calendar features.');
      return false;
    }

    // Get current user
    const userInfo = await GoogleSignin.signInSilently();
    
    // Check if we have calendar scope
    const scopes = userInfo.scopes || [];
    const hasCalendarScope = scopes.includes('https://www.googleapis.com/auth/calendar.events');
    
    if (!hasCalendarScope) {
      // Request additional calendar scope
      await GoogleSignin.addScopes({
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      });
    }
    
    return true;
  } catch (error: any) {
    console.error('Error requesting calendar access:', error);
    Alert.alert('Calendar Access Error', error.message || 'Failed to request calendar access');
    return false;
  }
}

/**
 * Create a Google Calendar event
 */
export async function createCalendarEvent(event: CalendarEvent): Promise<string | null> {
  try {
    // Ensure we have calendar access
    const hasAccess = await requestCalendarAccess();
    if (!hasAccess) {
      return null;
    }

    // Get access token
    const tokens = await GoogleSignin.getTokens();
    const accessToken = tokens.accessToken;

    // Call Google Calendar API
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create calendar event');
    }

    const result = await response.json();
    return result.htmlLink; // Returns the Google Calendar link to the event
  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    Alert.alert('Calendar Error', error.message || 'Failed to create calendar event');
    return null;
  }
}

/**
 * Parse a natural language scheduling request into a CalendarEvent
 * This is a helper function - the actual parsing will be done by the AI
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
 */
export async function getCalendarEvents(
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  try {
    const hasAccess = await requestCalendarAccess();
    if (!hasAccess) {
      return [];
    }

    const tokens = await GoogleSignin.getTokens();
    const accessToken = tokens.accessToken;

    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }

    const result = await response.json();
    return result.items || [];
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

