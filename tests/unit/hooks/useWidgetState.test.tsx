import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWidgetState } from '../../../widget-src/hooks/useWidgetState';

describe('useWidgetState', () => {
  beforeEach(() => {
    // Reset window.openai before each test
    (window as Window & { openai?: Record<string, unknown> }).openai = undefined;
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('uses default state when window.openai is undefined', () => {
      const defaultState = { count: 0 };
      const { result } = renderHook(() => useWidgetState(defaultState));

      expect(result.current[0]).toEqual({ count: 0 });
    });

    it('uses default state function when provided', () => {
      const defaultStateFn = () => ({ count: 42 });
      const { result } = renderHook(() => useWidgetState(defaultStateFn));

      expect(result.current[0]).toEqual({ count: 42 });
    });

    it('uses widgetState from window.openai when available', () => {
      (window as Window & { openai?: Record<string, unknown> }).openai = {
        widgetState: { count: 100 },
      };

      const { result } = renderHook(() => useWidgetState({ count: 0 }));

      expect(result.current[0]).toEqual({ count: 100 });
    });

    it('prefers window.openai.widgetState over default', () => {
      (window as Window & { openai?: Record<string, unknown> }).openai = {
        widgetState: { count: 50 },
      };

      const { result } = renderHook(() => useWidgetState({ count: 0 }));

      expect(result.current[0]).toEqual({ count: 50 });
    });
  });

  describe('state updates', () => {
    it('updates state with direct value', () => {
      const { result } = renderHook(() => useWidgetState({ count: 0 }));

      act(() => {
        result.current[1]({ count: 5 });
      });

      expect(result.current[0]).toEqual({ count: 5 });
    });

    it('updates state with function updater', () => {
      const { result } = renderHook(() => useWidgetState({ count: 0 }));

      act(() => {
        result.current[1]((prev) => ({ count: prev.count + 1 }));
      });

      expect(result.current[0]).toEqual({ count: 1 });
    });

    it('calls window.openai.setWidgetState on update', () => {
      const mockSetWidgetState = vi.fn();
      (window as Window & { openai?: Record<string, unknown> }).openai = {
        setWidgetState: mockSetWidgetState,
      };

      const { result } = renderHook(() => useWidgetState({ count: 0 }));

      act(() => {
        result.current[1]({ count: 10 });
      });

      expect(mockSetWidgetState).toHaveBeenCalledWith({ count: 10 });
    });

    it('does not throw when window.openai.setWidgetState is undefined', () => {
      (window as Window & { openai?: Record<string, unknown> }).openai = {};

      const { result } = renderHook(() => useWidgetState({ count: 0 }));

      // Should not throw
      expect(() => {
        act(() => {
          result.current[1]({ count: 5 });
        });
      }).not.toThrow();

      expect(result.current[0]).toEqual({ count: 5 });
    });
  });

  describe('complex state objects', () => {
    interface ProgressState {
      completedLessons: string[];
      earnedStars: number;
      currentCourse: string | null;
    }

    it('handles complex nested state', () => {
      const initialState: ProgressState = {
        completedLessons: [],
        earnedStars: 0,
        currentCourse: null,
      };

      const { result } = renderHook(() => useWidgetState(initialState));

      act(() => {
        result.current[1]({
          completedLessons: ['lesson-1'],
          earnedStars: 1,
          currentCourse: 'python-kids',
        });
      });

      expect(result.current[0]).toEqual({
        completedLessons: ['lesson-1'],
        earnedStars: 1,
        currentCourse: 'python-kids',
      });
    });

    it('preserves array updates correctly', () => {
      const { result } = renderHook(() =>
        useWidgetState({ items: ['a', 'b'] })
      );

      act(() => {
        result.current[1]((prev) => ({
          items: [...prev.items, 'c'],
        }));
      });

      expect(result.current[0].items).toEqual(['a', 'b', 'c']);
    });
  });
});
