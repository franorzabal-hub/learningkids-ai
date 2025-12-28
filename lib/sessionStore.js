export function createSessionStore() {
  const sessions = new Map();

  function addSession(key, session) {
    const entry = { ...session, key };
    sessions.set(key, entry);
    return entry;
  }

  function promoteSession(sessionId) {
    if (!sessionId) {
      return { session: null, promoted: false, previousKey: null };
    }

    const existing = sessions.get(sessionId);
    if (existing) {
      return { session: existing, promoted: false, previousKey: null };
    }

    for (const [key, value] of sessions.entries()) {
      if (value.temp) {
        sessions.delete(key);
        value.temp = false;
        value.key = sessionId;
        sessions.set(sessionId, value);
        return { session: value, promoted: true, previousKey: key };
      }
    }

    return { session: null, promoted: false, previousKey: null };
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

  return {
    sessions,
    addSession,
    promoteSession,
    removeSession,
    listKeys,
  };
}
