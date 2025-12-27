import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWidgetProps, useToolInput } from '../../../widget-src/hooks/useWidgetProps';

describe('useWidgetProps', () => {
  beforeEach(() => {
    // Reset window.openai before each test
    (window as Window & { openai?: Record<string, unknown> }).openai = undefined;
  });

  describe('when toolOutput is undefined', () => {
    it('returns default state when provided', () => {
      const defaultState = { courses: [] };
      const { result } = renderHook(() => useWidgetProps(defaultState));

      expect(result.current).toEqual({ courses: [] });
    });

    it('returns undefined when no default provided', () => {
      const { result } = renderHook(() => useWidgetProps());

      expect(result.current).toBeUndefined();
    });
  });

  describe('when toolOutput is defined', () => {
    beforeEach(() => {
      (window as Window & { openai?: Record<string, unknown> }).openai = {
        toolOutput: {
          courses: [
            { id: 'python-kids', title: 'Python for Kids' },
          ],
        },
      };
    });

    it('returns toolOutput value', () => {
      const { result } = renderHook(() => useWidgetProps({ courses: [] }));

      expect(result.current).toEqual({
        courses: [{ id: 'python-kids', title: 'Python for Kids' }],
      });
    });

    it('ignores default when toolOutput exists', () => {
      const { result } = renderHook(() =>
        useWidgetProps({ courses: [], ignored: true })
      );

      expect(result.current).toEqual({
        courses: [{ id: 'python-kids', title: 'Python for Kids' }],
      });
      expect((result.current as Record<string, unknown>).ignored).toBeUndefined();
    });
  });

  describe('with typed data', () => {
    interface ToolOutput {
      courses: Array<{ id: string; title: string }>;
      lesson?: { id: string; content: string };
    }

    it('properly types the returned data', () => {
      (window as Window & { openai?: Record<string, unknown> }).openai = {
        toolOutput: {
          courses: [{ id: 'test', title: 'Test Course' }],
          lesson: { id: 'lesson-1', content: 'Hello' },
        },
      };

      const { result } = renderHook(() =>
        useWidgetProps<ToolOutput>({ courses: [] })
      );

      expect(result.current.courses).toHaveLength(1);
      expect(result.current.lesson?.id).toBe('lesson-1');
    });
  });
});

describe('useToolInput', () => {
  beforeEach(() => {
    (window as Window & { openai?: Record<string, unknown> }).openai = undefined;
  });

  describe('when toolInput is undefined', () => {
    it('returns null', () => {
      const { result } = renderHook(() => useToolInput());

      expect(result.current).toBeNull();
    });
  });

  describe('when toolInput is defined', () => {
    it('returns toolInput value', () => {
      (window as Window & { openai?: Record<string, unknown> }).openai = {
        toolInput: { courseId: 'python-kids', lessonNumber: 1 },
      };

      const { result } = renderHook(() => useToolInput<{ courseId: string; lessonNumber: number }>());

      expect(result.current).toEqual({
        courseId: 'python-kids',
        lessonNumber: 1,
      });
    });
  });
});
