import { formatTimestamp, formatLastSeen } from '../time';

// Mock Timestamp class
const Timestamp = {
  fromDate: (date: Date) => ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }),
};

describe('Time Utilities', () => {
  describe('formatTimestamp', () => {
    it('should return empty string for null timestamp', () => {
      expect(formatTimestamp(null)).toBe('');
      expect(formatTimestamp(undefined)).toBe('');
    });

    it('should return "Just now" for very recent timestamps', () => {
      const now = new Date();
      const timestamp = Timestamp.fromDate(now);
      expect(formatTimestamp(timestamp)).toBe('Just now');
    });

    it('should return relative time for recent timestamps', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const timestamp = Timestamp.fromDate(fiveMinutesAgo);
      const result = formatTimestamp(timestamp);
      expect(result).toContain('minute');
    });

    it('should return time format for same day', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const timestamp = Timestamp.fromDate(twoHoursAgo);
      const result = formatTimestamp(timestamp);
      // Should contain time like "10:30 AM"
      expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
    });

    it('should return date and time for older timestamps', () => {
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const timestamp = Timestamp.fromDate(lastWeek);
      const result = formatTimestamp(timestamp);
      // Should contain month abbreviation
      expect(result).toMatch(/[A-Z][a-z]{2}\s\d+/);
    });
  });

  describe('formatLastSeen', () => {
    it('should return "offline" for null timestamp', () => {
      expect(formatLastSeen(null)).toBe('offline');
      expect(formatLastSeen(undefined)).toBe('offline');
    });

    it('should return "online" for very recent timestamps', () => {
      const now = new Date();
      const timestamp = Timestamp.fromDate(now);
      expect(formatLastSeen(timestamp)).toBe('online');
    });

    it('should return "last seen X ago" for older timestamps', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const timestamp = Timestamp.fromDate(fiveMinutesAgo);
      const result = formatLastSeen(timestamp);
      expect(result).toContain('last seen');
      expect(result).toContain('ago');
    });
  });
});

