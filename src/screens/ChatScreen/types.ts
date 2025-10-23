export interface ChatScreenProps {
  route: { params: { threadId: string; threadName: string } };
  navigation: any; // Using any for React Navigation compatibility
}

export interface ActionItem {
  task: string;
  completed?: boolean;
  assignee?: string;
  due?: string;
}

export interface Decision {
  summary: string;
  timestamp?: number;
  owner?: string;
  decidedAt?: string;
}

export interface UserCacheEntry {
  displayName: string;
  photoURL?: string;
}

