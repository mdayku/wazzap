import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Timestamp } from 'firebase/firestore';

dayjs.extend(relativeTime);

export function formatTimestamp(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return '';
  
  try {
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    
    // Less than 1 hour
    if (diff < 3600000) return dayjs(date).fromNow();
    
    // Same day
    if (dayjs(date).isSame(now, 'day')) {
      return dayjs(date).format('h:mm A');
    }
    
    // Same year
    if (dayjs(date).isSame(now, 'year')) {
      return dayjs(date).format('MMM D, h:mm A');
    }
    
    return dayjs(date).format('MMM D, YYYY');
  } catch (error) {
    return '';
  }
}

export function formatLastSeen(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return 'offline';
  
  try {
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Online if within 2 minutes
    if (diff < 120000) return 'online';
    
    return `last seen ${dayjs(date).fromNow()}`;
  } catch (error) {
    return 'offline';
  }
}

export function isUserOnline(timestamp: Timestamp | null | undefined): boolean {
  if (!timestamp) return false;
  
  try {
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Online if within 10 minutes
    return diff < 600000;
  } catch (error) {
    return false;
  }
}

