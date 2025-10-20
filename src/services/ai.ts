import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface SummaryResult {
  summaryId: string;
  text?: string;
}

export interface ExtractResult {
  actionItems: Array<{
    assignee?: string;
    task: string;
    due?: string;
  }>;
  decisions: Array<{
    summary: string;
    owner?: string;
    decidedAt?: string;
  }>;
}

export async function summarizeThread(threadId: string, limit: number = 50): Promise<SummaryResult> {
  try {
    const summarize = httpsCallable(functions, 'summarize');
    const result = await summarize({ threadId, limit });
    return result.data as SummaryResult;
  } catch (error) {
    console.error('Error calling summarize function:', error);
    throw error;
  }
}

export async function extractAI(threadId: string, limit: number = 50): Promise<ExtractResult> {
  try {
    const extract = httpsCallable(functions, 'extract');
    const result = await extract({ threadId, limit });
    return result.data as ExtractResult;
  } catch (error) {
    console.error('Error calling extract function:', error);
    throw error;
  }
}

