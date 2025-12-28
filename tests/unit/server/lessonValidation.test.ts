import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStudentValidation } from '../../../lib/lessonValidation.js';
import { createDataLoader } from '../../../lib/data.js';

const mockLesson = {
  id: 'lesson-1',
  exercise: {
    instruction: 'Create a variable called favorite_animal',
    hint: 'Use quotes for text!',
    validation: {
      type: 'regex',
      pattern: 'favorite_animal\\s*=\\s*["\'][^"\']+["\']',
      errorMessage: 'Create a variable called favorite_animal with text inside quotes!',
    },
  },
  reward: {
    stars: 1,
    badge: 'First Variable',
    message: 'Great job!',
  },
  nextLesson: 'lesson-2',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../mcp-server/data');

describe('buildStudentValidation', () => {
  it('flags empty submissions with no attempt', () => {
    const result = buildStudentValidation(mockLesson, '');

    expect(result.correct).toBe(false);
    expect(result.hasAttempt).toBe(false);
    expect(result.message).toContain('Please write some code');
  });

  it('rejects overly long submissions', () => {
    const longCode = 'a'.repeat(5001);
    const result = buildStudentValidation(mockLesson, longCode, { maxLength: 5000 });

    expect(result.correct).toBe(false);
    expect(result.hasAttempt).toBe(true);
    expect(result.message).toContain('exceeds maximum length');
  });

  it('validates correct code and returns reward info', () => {
    const result = buildStudentValidation(mockLesson, 'favorite_animal = "cat"');

    expect(result.correct).toBe(true);
    expect(result.reward).toEqual(mockLesson.reward);
    expect(result.nextLesson).toBe('lesson-2');
  });

  it('handles non-string input gracefully', () => {
    const result = buildStudentValidation(mockLesson, null);

    expect(result.correct).toBe(false);
    expect(result.hasAttempt).toBe(false);
    expect(result.message).toBe('Code must be a string');
  });
});

describe('guided validation', () => {
  it('accepts alternative variable name for lesson 1 when code works', async () => {
    const loader = createDataLoader(DATA_DIR);
    const lessonsData = await loader.loadLessons('python-kids');
    const lesson = lessonsData.lessons.find((item: { id: string }) => item.id === 'lesson-1');

    const result = buildStudentValidation(
      lesson,
      'fav_animal = "cat"\nprint(fav_animal)'
    );

    expect(result.correct).toBe(true);
    expect(result.reward).toBeDefined();
  });

  it('guides when numbers are quoted in lesson 2', async () => {
    const loader = createDataLoader(DATA_DIR);
    const lessonsData = await loader.loadLessons('python-kids');
    const lesson = lessonsData.lessons.find((item: { id: string }) => item.id === 'lesson-2');

    const result = buildStudentValidation(
      lesson,
      'my_candies = "7"\nfriend_candies = 5\ntotal_candies = my_candies + friend_candies'
    );

    expect(result.correct).toBe(false);
    expect(result.message).toContain('numbers without quotes');
  });

  it('accepts alternative function name for lesson 5 when logic is correct', async () => {
    const loader = createDataLoader(DATA_DIR);
    const lessonsData = await loader.loadLessons('python-kids');
    const lesson = lessonsData.lessons.find((item: { id: string }) => item.id === 'lesson-5');

    const result = buildStudentValidation(
      lesson,
      `def intro(name):\n    return "Hi, I'm " + name + "!"`
    );

    expect(result.correct).toBe(true);
    expect(result.reward).toBeDefined();
  });
});
