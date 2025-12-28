import { describe, it, expect } from 'vitest';
import { buildStudentValidation } from '../../../lib/lessonValidation.js';

const mockLesson = {
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
