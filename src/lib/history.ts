export interface HistoryTurn {
  role: string;
  content: string;
}

/// Simple token estimation (4 chars ~ 1 token for English text)
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/// Drop the oldest turns so the history fits in `budgetTokens`. The most
/// recent turns are kept, and the result never starts with an assistant turn
/// (providers expect the first turn to be the user's).
export function trimHistory<T extends HistoryTurn>(history: T[], budgetTokens: number): T[] {
  let used = 0;
  let start = history.length;
  for (let i = history.length - 1; i >= 0; i--) {
    const cost = estimateTokens(history[i].content);
    if (used + cost > budgetTokens) break;
    used += cost;
    start = i;
  }
  while (start < history.length && history[start].role !== "user") start++;
  return history.slice(start);
}
