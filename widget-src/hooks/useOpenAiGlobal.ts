import { useSyncExternalStore } from 'react';

// Type for window.openai globals
declare global {
  interface Window {
    openai?: {
      theme?: 'light' | 'dark';
      displayMode?: 'inline' | 'fullscreen' | 'pip';
      locale?: string;
      maxHeight?: number;
      toolOutput?: unknown;
      toolInput?: unknown;
      widgetState?: unknown;
      setWidgetState?: (state: unknown) => void;
      callTool?: (params: { name: string; parameters?: Record<string, unknown> }) => Promise<{
        content: Array<{ type: string; text: string }>;
      }>;
      requestClose?: () => void;
    };
  }
}

const SET_GLOBALS_EVENT_TYPE = 'openai:set-globals';

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
        const customEvent = event as CustomEvent<{ key: string }>;
        if (customEvent.detail?.key === key) {
          onChange();
        }
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handler);
      return () => window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handler);
    },
    () => window.openai?.[key] ?? null,
    () => null
  );
}
