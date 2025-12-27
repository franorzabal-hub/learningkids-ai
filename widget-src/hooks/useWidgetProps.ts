import { useOpenAiGlobal } from './useOpenAiGlobal';

export function useWidgetProps<T>(defaultState?: T): T {
  const toolOutput = useOpenAiGlobal('toolOutput') as T | null;
  return toolOutput ?? (defaultState as T);
}

export function useToolInput<T>(): T | null {
  return useOpenAiGlobal('toolInput') as T | null;
}
