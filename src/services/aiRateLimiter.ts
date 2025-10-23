import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_LIMIT_KEY = 'ai_rate_limit';
const MAX_CALLS = 20;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export interface RateLimitInfo {
  remaining: number;
  resetAt: number;
  isLimited: boolean;
}

interface CallRecord {
  timestamp: number;
  feature: string;
}

export async function checkRateLimit(): Promise<RateLimitInfo> {
  try {
    const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const calls: CallRecord[] = stored ? JSON.parse(stored) : [];
    
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    
    // Filter out calls outside the current window
    const recentCalls = calls.filter(call => call.timestamp > windowStart);
    
    const remaining = Math.max(0, MAX_CALLS - recentCalls.length);
    const isLimited = recentCalls.length >= MAX_CALLS;
    
    // Find oldest call to determine when limit resets
    const oldestCall = recentCalls.length > 0 
      ? Math.min(...recentCalls.map(c => c.timestamp))
      : now;
    const resetAt = oldestCall + WINDOW_MS;
    
    return {
      remaining,
      resetAt,
      isLimited,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Fail open - allow the call
    return {
      remaining: MAX_CALLS,
      resetAt: Date.now() + WINDOW_MS,
      isLimited: false,
    };
  }
}

export async function recordAICall(feature: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const calls: CallRecord[] = stored ? JSON.parse(stored) : [];
    
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    
    // Filter out old calls and add new one
    const recentCalls = calls.filter(call => call.timestamp > windowStart);
    recentCalls.push({ timestamp: now, feature });
    
    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recentCalls));
  } catch (error) {
    console.error('Error recording AI call:', error);
  }
}

export async function getAIAnalytics(): Promise<{
  totalCalls: number;
  callsByFeature: Record<string, number>;
  recentCalls: CallRecord[];
}> {
  try {
    const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const calls: CallRecord[] = stored ? JSON.parse(stored) : [];
    
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const recentCalls = calls.filter(call => call.timestamp > windowStart);
    
    const callsByFeature: Record<string, number> = {};
    recentCalls.forEach(call => {
      callsByFeature[call.feature] = (callsByFeature[call.feature] || 0) + 1;
    });
    
    return {
      totalCalls: recentCalls.length,
      callsByFeature,
      recentCalls,
    };
  } catch (error) {
    console.error('Error getting AI analytics:', error);
    return {
      totalCalls: 0,
      callsByFeature: {},
      recentCalls: [],
    };
  }
}

