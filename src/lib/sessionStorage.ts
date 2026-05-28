import { SessionHistory, MeetingSession, LastMeetingSnapshot } from '@/types';

const SESSION_HISTORY_KEY = 'convoiq_session_history_v1';

/**
 * Get all session histories from localStorage
 */
export function getAllSessionHistories(): Map<string, SessionHistory> {
  if (typeof window === 'undefined') return new Map();

  try {
    const stored = localStorage.getItem(SESSION_HISTORY_KEY);
    if (!stored) return new Map();

    const data = JSON.parse(stored) as Record<string, SessionHistory>;
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

/**
 * Get session history for a specific client
 */
export function getClientHistory(clientId: string): SessionHistory | null {
  const histories = getAllSessionHistories();
  return histories.get(clientId) || null;
}

/**
 * Get the last meeting for a client
 */
export function getLastMeeting(clientId: string): MeetingSession | null {
  const history = getClientHistory(clientId);
  if (!history || history.meetings.length === 0) return null;

  const lastMeetingId = history.lastMeetingId;
  if (lastMeetingId) {
    return history.meetings.find((m) => m.id === lastMeetingId) || history.meetings[history.meetings.length - 1];
  }

  return history.meetings[history.meetings.length - 1];
}

/**
 * Generate a snapshot from the last meeting
 */
export function generateSnapshot(meeting: MeetingSession, clientName: string): LastMeetingSnapshot {
  return {
    clientId: meeting.clientId,
    clientName,
    date: meeting.date,
    overallSummary: meeting.summary,
    pendingTasks: meeting.pendingTasks,
    unresolvedDecisions: meeting.unresolvedDecisions,
    risks: meeting.risks,
    discussionTopics: meeting.discussionTopics,
    keyTakeaways: meeting.keyTakeaways,
  };
}

/**
 * Save a new meeting session and update history
 */
export function saveMeetingSession(session: MeetingSession): void {
  if (typeof window === 'undefined') return;

  try {
    const histories = getAllSessionHistories();
    let history = histories.get(session.clientId);

    if (!history) {
      history = {
        clientId: session.clientId,
        clientName: session.clientName,
        meetings: [],
      };
    }

    history.meetings.push(session);
    history.lastMeetingId = session.id;

    const data = Object.fromEntries(histories);
    data[session.clientId] = history;

    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save meeting session:', err);
  }
}

/**
 * Clear session history for a client
 */
export function clearClientHistory(clientId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const histories = getAllSessionHistories();
    histories.delete(clientId);

    const data = Object.fromEntries(histories);
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to clear client history:', err);
  }
}

/**
 * List all clients with history
 */
export function getAllClients(): Array<{ clientId: string; clientName: string }> {
  const histories = getAllSessionHistories();
  return Array.from(histories.values()).map((h) => ({
    clientId: h.clientId,
    clientName: h.clientName,
  }));
}
