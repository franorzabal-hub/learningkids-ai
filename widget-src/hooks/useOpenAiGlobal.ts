import { useSyncExternalStore } from 'react';

// Type for window.openai globals (subset needed by this widget)
declare global {
  interface Window {
    openai?: {
      theme?: 'light' | 'dark';
      displayMode?: 'inline' | 'fullscreen' | 'pip';
      locale?: string;
      maxHeight?: number;
      toolOutput?: unknown;
      toolInput?: unknown;
      toolResponseMetadata?: unknown;
      widgetState?: unknown;
      setWidgetState?: (state: unknown) => void | Promise<void>;
      callTool?: (name: string, parameters?: Record<string, unknown>) => Promise<{
        content?: Array<{ type: string; text: string }>;
        structuredContent?: unknown;
      }>;
      requestClose?: () => void;
    };
  }
}

const SET_GLOBALS_EVENT_TYPES = ['openai:set_globals', 'openai:set-globals'];

type OpenAiGlobalKey = keyof NonNullable<Window['openai']>;

export function useOpenAiGlobal<K extends OpenAiGlobalKey>(
  key: K
): NonNullable<Window['openai']>[K] | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined') {
        return () => {};
      }

      const handler = (event: Event) => {
        const customEvent = event as CustomEvent<{ key?: string; globals?: Record<string, unknown> }>;
        const detail = customEvent.detail;
        if (!detail) {
          return;
        }
        if (detail.key && detail.key === key) {
          onChange();
          return;
        }
        if (detail.globals && Object.prototype.hasOwnProperty.call(detail.globals, key)) {
          onChange();
        }
      };

      for (const eventType of SET_GLOBALS_EVENT_TYPES) {
        window.addEventListener(eventType, handler, { passive: true });
      }
      return () => {
        for (const eventType of SET_GLOBALS_EVENT_TYPES) {
          window.removeEventListener(eventType, handler);
        }
      };
    },
    () => window.openai?.[key] ?? null,
    () => null
  );
}
