import { describe, it, expect, vi } from 'vitest';
import { createSessionStore } from '../../../lib/sessionStore.js';

describe('createSessionStore', () => {
  it('promotes temp sessions and cleans up the promoted key', () => {
    const store = createSessionStore();
    const session = store.addSession('temp-1', { temp: true });

    const result = store.promoteSession('session-123');

    expect(result.promoted).toBe(true);
    expect(result.previousKey).toBe('temp-1');
    expect(result.session).toBe(session);
    expect(store.sessions.has('temp-1')).toBe(false);
    expect(store.sessions.has('session-123')).toBe(true);
    expect(session.key).toBe('session-123');

    const removed = store.removeSession(session);
    expect(removed).toBe(true);
    expect(store.sessions.size).toBe(0);
  });

  it('returns existing sessions without promotion', () => {
    const store = createSessionStore();
    const session = store.addSession('session-abc', { temp: false });

    const result = store.promoteSession('session-abc');

    expect(result.promoted).toBe(false);
    expect(result.session).toBe(session);
    expect(store.sessions.has('session-abc')).toBe(true);
  });

  it('promotes the most recent temp session', () => {
    vi.useFakeTimers();
    const store = createSessionStore();

    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const older = store.addSession('temp-1', { temp: true });

    vi.setSystemTime(new Date('2025-01-01T00:00:02Z'));
    const newer = store.addSession('temp-2', { temp: true });

    const result = store.promoteSession('session-new');

    expect(result.promoted).toBe(true);
    expect(result.previousKey).toBe('temp-2');
    expect(result.session).toBe(newer);
    expect(store.sessions.has('temp-1')).toBe(true);
    expect(store.sessions.has('temp-2')).toBe(false);
    expect(store.sessions.has('session-new')).toBe(true);
    expect(older.key).toBe('temp-1');
    expect(newer.key).toBe('session-new');

    vi.useRealTimers();
  });

  it('returns null when no sessions are available', () => {
    const store = createSessionStore();

    const result = store.promoteSession('missing-session');

    expect(result.session).toBeNull();
    expect(result.promoted).toBe(false);
  });

  it('uses lastSeen for stale cleanup', () => {
    vi.useFakeTimers();
    const start = new Date('2025-01-01T00:00:00Z');
    vi.setSystemTime(start);

    const store = createSessionStore();
    const session = store.addSession('session-1', { temp: false });

    vi.setSystemTime(new Date(start.getTime() + 1000));
    store.touchSession(session);

    vi.setSystemTime(new Date(start.getTime() + 5000));
    const cleaned = store.cleanupStale(3000);

    expect(cleaned).toBe(1);
    expect(store.sessions.size).toBe(0);

    vi.useRealTimers();
  });
});
