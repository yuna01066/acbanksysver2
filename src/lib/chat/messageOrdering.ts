export interface TimestampedChatMessage {
  id: string;
  created_at: string;
}

/**
 * Supabase returns the latest page in descending order. Chat timelines display
 * that page oldest-to-newest, so reverse a copy without mutating query data.
 */
export function toChronologicalMessages<T extends TimestampedChatMessage>(messages: readonly T[]): T[] {
  return [...messages].reverse();
}

/**
 * Merge a fetched page with messages that may already have arrived over
 * Realtime while the fetch was in flight. Fetched rows win for duplicate ids
 * because they represent the latest complete database record.
 */
export function mergeChronologicalMessages<T extends TimestampedChatMessage>(
  existingMessages: readonly T[],
  fetchedMessages: readonly T[],
  maxMessages: number,
): T[] {
  const messagesById = new Map<string, T>();
  existingMessages.forEach((message) => messagesById.set(message.id, message));
  fetchedMessages.forEach((message) => messagesById.set(message.id, message));

  return Array.from(messagesById.values())
    .sort((left, right) => {
      const timeDifference = Date.parse(left.created_at) - Date.parse(right.created_at);
      return timeDifference || left.id.localeCompare(right.id);
    })
    .slice(-maxMessages);
}

/** Keep realtime inserts de-duplicated and in chronological display order. */
export function addMessageChronologically<T extends TimestampedChatMessage>(
  messages: readonly T[],
  newMessage: T,
  maxMessages: number,
): T[] {
  if (messages.some((message) => message.id === newMessage.id)) return [...messages];
  return mergeChronologicalMessages(messages, [newMessage], maxMessages);
}
