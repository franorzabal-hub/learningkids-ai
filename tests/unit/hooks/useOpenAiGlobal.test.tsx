import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOpenAiGlobal } from '../../../widget-src/hooks/useOpenAiGlobal';

describe('useOpenAiGlobal', () => {
  beforeEach(() => {
    // Reset window.openai before each test
    (window as Window & { openai?: Record<string, unknown> }).openai = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when window.openai is undefined', () => {
    it('returns null for theme', () => {
      const { result } = renderHook(() => useOpenAiGlobal('theme'));
      expect(result.current).toBeNull();
    });

    it('returns null for displayMode', () => {
      const { result } = renderHook(() => useOpenAiGlobal('displayMode'));
      expect(result.current).toBeNull();
    });

    it('returns null for toolOutput', () => {
      const { result } = renderHook(() => useOpenAiGlobal('toolOutput'));
      expect(result.current).toBeNull();
    });
  });

  describe('when window.openai is defined', () => {
    beforeEach(() => {
      (window as Window & { openai?: Record<string, unknown> }).openai = {
        theme: 'dark',
        displayMode: 'fullscreen',
        locale: 'en-US',
        maxHeight: 600,
        toolOutput: { courses: [] },
        widgetState: { progress: 0 },
      };
    });

    it('returns theme value', () => {
      const { result } = renderHook(() => useOpenAiGlobal('theme'));
      expect(result.current).toBe('dark');
    });

    it('returns displayMode value', () => {
      const { result } = renderHook(() => useOpenAiGlobal('displayMode'));
      expect(result.current).toBe('fullscreen');
    });

    it('returns locale value', () => {
      const { result } = renderHook(() => useOpenAiGlobal('locale'));
      expect(result.current).toBe('en-US');
    });

    it('returns maxHeight value', () => {
      const { result } = renderHook(() => useOpenAiGlobal('maxHeight'));
      expect(result.current).toBe(600);
    });

    it('returns toolOutput object', () => {
      const { result } = renderHook(() => useOpenAiGlobal('toolOutput'));
      expect(result.current).toEqual({ courses: [] });
    });

    it('returns widgetState object', () => {
      const { result } = renderHook(() => useOpenAiGlobal('widgetState'));
      expect(result.current).toEqual({ progress: 0 });
    });
  });

  describe('event handling', () => {
    it('updates when openai:set_globals event is dispatched', async () => {
      (window as Window & { openai?: Record<string, unknown> }).openai = {
        theme: 'light',
      };

      const { result } = renderHook(() => useOpenAiGlobal('theme'));
      expect(result.current).toBe('light');

      // Update the value and dispatch event
      act(() => {
        (window as Window & { openai?: Record<string, unknown> }).openai = {
          theme: 'dark',
        };
        window.dispatchEvent(
          new CustomEvent('openai:set_globals', { detail: { globals: { theme: 'dark' } } })
        );
      });

      await waitFor(() => {
        expect(result.current).toBe('dark');
      });
    });

    it('updates when legacy openai:set-globals event is dispatched', async () => {
      (window as Window & { openai?: Record<string, unknown> }).openai = {
        theme: 'light',
      };

      const { result } = renderHook(() => useOpenAiGlobal('theme'));
      expect(result.current).toBe('light');

      act(() => {
        (window as Window & { openai?: Record<string, unknown> }).openai = {
          theme: 'dark',
        };
        window.dispatchEvent(
          new CustomEvent('openai:set-globals', { detail: { key: 'theme' } })
        );
      });

      await waitFor(() => {
        expect(result.current).toBe('dark');
      });
    });

    it('does not update when event is for different key', async () => {
      (window as Window & { openai?: Record<string, unknown> }).openai = {
        theme: 'light',
        locale: 'en-US',
      };

      const { result } = renderHook(() => useOpenAiGlobal('theme'));
      expect(result.current).toBe('light');

      // Dispatch event for different key
      act(() => {
        window.dispatchEvent(
          new CustomEvent('openai:set_globals', { detail: { globals: { locale: 'en-US' } } })
        );
      });

      // Theme should still be light
      expect(result.current).toBe('light');
    });
  });
});
