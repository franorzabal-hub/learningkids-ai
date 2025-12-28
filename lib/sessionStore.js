/**
 * Session store for managing SSE connections
 * Added periodic cleanup functionality - Claude (Opus 4.5) - 2025-12-27
 */
export function createSessionStore() {
  const sessions = new Map();

  function addSession(key, session) {
    const now = Date.now();
    const createdAt = session.createdAt ?? now;
    const lastSeen = session.lastSeen ?? createdAt;
    const entry = { ...session, key, createdAt, lastSeen };
    sessions.set(key, entry);
    return entry;
  }

  /**
   * Clean up stale sessions that exceed the max age
   * @param {number} maxAgeMs - Maximum session age in milliseconds (default: 1 hour)
   * @returns {number} Number of sessions cleaned up
   */
  function cleanupStale(maxAgeMs = 3600000) {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, session] of sessions.entries()) {
      const lastSeen = session.lastSeen ?? session.createdAt;
      if (lastSeen && now - lastSeen > maxAgeMs) {
        sessions.delete(key);
        cleanedCount++;
        console.log(`[LearnKids] Cleaned up stale session: ${key}`);
      }
    }

    return cleanedCount;
  }

  function promoteSession(sessionId) {
    if (!sessionId) {
      return { session: null, promoted: false, previousKey: null };
    }

    const existing = sessions.get(sessionId);
    if (existing) {
      return { session: existing, promoted: false, previousKey: null };
    }

    let newestTemp = null;
    let newestKey = null;
    let newestSeen = -Infinity;

    for (const [key, value] of sessions.entries()) {
      if (!value.temp) {
        continue;
      }
      const lastSeen = value.lastSeen ?? value.createdAt ?? 0;
      if (lastSeen > newestSeen) {
        newestSeen = lastSeen;
        newestTemp = value;
        newestKey = key;
      }
    }

    if (newestTemp && newestKey) {
      sessions.delete(newestKey);
      newestTemp.temp = false;
      newestTemp.key = sessionId;
      newestTemp.lastSeen = Date.now();
      sessions.set(sessionId, newestTemp);
      return { session: newestTemp, promoted: true, previousKey: newestKey };
    }

    return { session: null, promoted: false, previousKey: null };
  }

  function touchSession(session) {
    if (!session || !session.key) {
      return false;
    }

    if (sessions.get(session.key) === session) {
      session.lastSeen = Date.now();
      return true;
    }

    return false;
  }

  function removeSession(session) {
    if (!session || !session.key) {
      return false;
    }

    if (sessions.get(session.key) === session) {
      sessions.delete(session.key);
      return true;
    }

    return false;
  }

  function listKeys() {
    return Array.from(sessions.keys());
  }

  /**
   * Start periodic cleanup of stale sessions
   * @param {number} intervalMs - Cleanup interval in milliseconds (default: 15 minutes)
   * @param {number} maxAgeMs - Maximum session age in milliseconds (default: 1 hour)
   * @returns {NodeJS.Timeout} Interval ID for stopping cleanup
   */
  function startPeriodicCleanup(intervalMs = 900000, maxAgeMs = 3600000) {
    return setInterval(() => {
      const count = cleanupStale(maxAgeMs);
      if (count > 0) {
        console.log(`[LearnKids] Periodic cleanup: removed ${count} stale sessions`);
      }
    }, intervalMs);
  }

  return {
    sessions,
    addSession,
    promoteSession,
    touchSession,
    removeSession,
    listKeys,
    cleanupStale,
    startPeriodicCleanup,
  };
}
