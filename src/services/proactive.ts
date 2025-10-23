import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface ProactiveSuggestion {
  suggestionId?: string;
  hasSuggestion: boolean;
  type: 'schedule' | 'question_followup' | 'action_reminder' | 'draft_message' | 'info_gap' | 'decision_prompt';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  reasoning: string;
  status?: 'active' | 'dismissed' | 'accepted';
  feedback?: 'positive' | 'negative' | null;
}

/**
 * Analyze thread context and get proactive suggestions
 */
export async function analyzeThreadContext(threadId: string): Promise<ProactiveSuggestion> {
  try {
    const analyzeContext = httpsCallable(functions, 'analyzeContext');
    const result = await analyzeContext({ threadId });
    return result.data as ProactiveSuggestion;
  } catch (error) {
    console.error('Error analyzing thread context:', error);
    throw error;
  }
}

/**
 * Submit feedback on a suggestion (thumbs up/down)
 */
export async function submitFeedback(
  threadId: string,
  suggestionId: string,
  feedback: 'positive' | 'negative',
  userId: string
): Promise<void> {
  try {
    const suggestionFeedback = httpsCallable(functions, 'suggestionFeedback');
    await suggestionFeedback({ threadId, suggestionId, feedback, userId });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
}

/**
 * Dismiss a suggestion
 */
export async function dismissSuggestion(threadId: string, suggestionId: string): Promise<void> {
  try {
    const dismiss = httpsCallable(functions, 'dismissSuggestion');
    await dismiss({ threadId, suggestionId });
  } catch (error) {
    console.error('Error dismissing suggestion:', error);
    throw error;
  }
}

