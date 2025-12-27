import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Ensure window has full DOM APIs in jsdom
if (typeof window !== 'undefined') {
  // Ensure addEventListener and removeEventListener exist
  if (!window.addEventListener) {
    window.addEventListener = vi.fn();
  }
  if (!window.removeEventListener) {
    window.removeEventListener = vi.fn();
  }
}

// Mock window.openai for React hook tests
const mockOpenAi = {
  widgetState: null as Record<string, unknown> | null,
  setWidgetState: vi.fn(),
  callTool: vi.fn(),
  theme: 'light',
};

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  mockOpenAi.widgetState = null;
  if (typeof window !== 'undefined') {
    (window as Window & { openai?: typeof mockOpenAi }).openai = undefined;
  }
});

// Helper to set up window.openai mock
export function setupOpenAiMock(overrides?: Partial<typeof mockOpenAi>) {
  const mock = { ...mockOpenAi, ...overrides };
  (globalThis as unknown as { window: { openai: typeof mockOpenAi } }).window = {
    openai: mock,
  };
  return mock;
}

// Helper to create mock courses data
export function createMockCoursesData() {
  return {
    courses: [
      {
        id: 'python-kids',
        title: 'Python for Kids',
        emoji: '🐍',
        color: '#3776ab',
        description: 'Learn Python programming basics',
        ageRange: '8-12',
        difficulty: 'Beginner',
        totalLessons: 5,
        estimatedDuration: '2 hours',
      },
      {
        id: 'scratch-basics',
        title: 'Scratch Basics',
        emoji: '🐱',
        color: '#ff9800',
        description: 'Visual programming with Scratch',
        ageRange: '7-10',
        difficulty: 'Beginner',
        totalLessons: 4,
        estimatedDuration: '1.5 hours',
      },
    ],
  };
}

// Helper to create mock lesson data
export function createMockLesson(overrides = {}) {
  return {
    id: 'lesson-1',
    order: 1,
    title: 'Hello World',
    duration: '15 min',
    objective: 'Learn to print text',
    content: {
      character: '🐍',
      characterName: 'Py',
      greeting: 'Hi there!',
      explanation: 'Let\'s learn to print!',
    },
    exercise: {
      instruction: 'Write a print statement',
      template: '# Write your code here',
      hint: 'Use print()',
      validation: {
        type: 'regex',
        pattern: 'print\\s*\\(["\'].*["\']\\)',
        errorMessage: 'Make sure to use print() with quotes',
      },
    },
    reward: {
      stars: 1,
      badge: 'First Steps',
      message: 'Great job!',
    },
    nextLesson: 'lesson-2',
    ...overrides,
  };
}
