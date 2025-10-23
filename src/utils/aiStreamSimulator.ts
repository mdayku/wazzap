/**
 * AI Stream Simulator
 * Creates a fake "streaming" effect for AI responses to improve perceived performance
 */

export interface StreamStep {
  message: string;
  duration: number; // milliseconds to show this step
}

export const SUMMARIZE_STEPS: StreamStep[] = [
  { message: '🔍 Analyzing conversation...', duration: 750 },
  { message: '📊 Processing messages...', duration: 750 },
  { message: '🤖 Running AI inference...', duration: 750 },
  { message: '✨ Generating summary...', duration: 750 },
  { message: '📝 Finalizing response...', duration: 750 },
];

export const EXTRACT_STEPS: StreamStep[] = [
  { message: '🔍 Scanning messages...', duration: 750 },
  { message: '🎯 Identifying action items...', duration: 750 },
  { message: '✅ Extracting decisions...', duration: 750 },
  { message: '👥 Mapping assignees...', duration: 750 },
  { message: '📋 Organizing results...', duration: 750 },
];

export const SEARCH_STEPS: StreamStep[] = [
  { message: '🔍 Preparing query...', duration: 500 },
  { message: '🧠 Generating embeddings...', duration: 800 },
  { message: '🔎 Searching database...', duration: 700 },
  { message: '📊 Ranking results...', duration: 600 },
];

/**
 * Simulates streaming by updating a callback with progressive messages
 * @param steps - Array of streaming steps
 * @param onUpdate - Callback to update the UI with current message
 * @param onComplete - Callback when simulation completes
 * @returns Cleanup function to cancel the simulation
 */
export function simulateAIStream(
  steps: StreamStep[],
  onUpdate: (message: string) => void,
  onComplete: () => void
): () => void {
  const timeouts: NodeJS.Timeout[] = [];
  let currentDelay = 0;

  steps.forEach((step, index) => {
    const timeout = setTimeout(() => {
      onUpdate(step.message);
      
      // Call onComplete after the last step
      if (index === steps.length - 1) {
        setTimeout(onComplete, step.duration);
      }
    }, currentDelay);
    
    timeouts.push(timeout);
    currentDelay += step.duration;
  });

  // Return cleanup function
  return () => {
    timeouts.forEach(timeout => clearTimeout(timeout));
  };
}

/**
 * Get random variation of a step to make it feel more dynamic
 */
export function getRandomStep(steps: StreamStep[]): StreamStep {
  return steps[Math.floor(Math.random() * steps.length)];
}

/**
 * Add random jitter to duration for more natural feel
 */
export function addJitter(duration: number, jitterPercent: number = 15): number {
  const jitter = duration * (jitterPercent / 100);
  return duration + (Math.random() * jitter * 2 - jitter);
}

