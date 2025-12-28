import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidCourseId,
  isValidLessonId,
  validateStudentCode,
  validateAnswer,
} from '../../../lib/validation.js';

// Mock courses data
const mockCoursesData = {
  courses: [
    { id: 'python-kids', title: 'Python for Kids' },
    { id: 'scratch-basics', title: 'Scratch Basics' },
    { id: 'web-intro', title: 'Intro to Web' },
  ],
};

describe('isValidCourseId', () => {
  describe('path traversal prevention', () => {
    it('rejects ".." sequences', () => {
      expect(isValidCourseId('../etc/passwd', mockCoursesData)).toBe(false);
      expect(isValidCourseId('python-kids/../admin', mockCoursesData)).toBe(false);
      expect(isValidCourseId('..', mockCoursesData)).toBe(false);
      expect(isValidCourseId('....', mockCoursesData)).toBe(false);
    });

    it('rejects forward slashes', () => {
      expect(isValidCourseId('path/to/file', mockCoursesData)).toBe(false);
      expect(isValidCourseId('/etc/passwd', mockCoursesData)).toBe(false);
      expect(isValidCourseId('python-kids/', mockCoursesData)).toBe(false);
    });

    it('rejects backslashes', () => {
      expect(isValidCourseId('path\\to\\file', mockCoursesData)).toBe(false);
      expect(isValidCourseId('C:\\Windows', mockCoursesData)).toBe(false);
      expect(isValidCourseId('python-kids\\..', mockCoursesData)).toBe(false);
    });

    it('rejects null bytes', () => {
      expect(isValidCourseId('python-kids\0admin', mockCoursesData)).toBe(false);
      expect(isValidCourseId('\0', mockCoursesData)).toBe(false);
    });

    it('rejects URL-encoded path traversal', () => {
      expect(isValidCourseId('%2e%2e%2f', mockCoursesData)).toBe(false); // ../
      expect(isValidCourseId('%2e%2e/', mockCoursesData)).toBe(false); // ../
      expect(isValidCourseId('..%2f', mockCoursesData)).toBe(false); // ../
      expect(isValidCourseId('%2e%2e%5c', mockCoursesData)).toBe(false); // ..\
    });

    it('rejects malformed URL encoding', () => {
      expect(isValidCourseId('%ZZ', mockCoursesData)).toBe(false);
    });
  });

  describe('valid course IDs', () => {
    it('accepts valid course IDs that exist', () => {
      expect(isValidCourseId('python-kids', mockCoursesData)).toBe(true);
      expect(isValidCourseId('scratch-basics', mockCoursesData)).toBe(true);
      expect(isValidCourseId('web-intro', mockCoursesData)).toBe(true);
    });

    it('rejects non-existent course IDs', () => {
      expect(isValidCourseId('nonexistent-course', mockCoursesData)).toBe(false);
      expect(isValidCourseId('python', mockCoursesData)).toBe(false);
      expect(isValidCourseId('PYTHON-KIDS', mockCoursesData)).toBe(false); // case sensitive
    });
  });

  describe('edge cases', () => {
    it('rejects empty string', () => {
      expect(isValidCourseId('', mockCoursesData)).toBe(false);
    });

    it('rejects null/undefined coursesData', () => {
      expect(isValidCourseId('python-kids', null as unknown as typeof mockCoursesData)).toBe(false);
      expect(isValidCourseId('python-kids', undefined as unknown as typeof mockCoursesData)).toBe(false);
    });

    it('rejects empty courses array', () => {
      expect(isValidCourseId('python-kids', { courses: [] })).toBe(false);
    });

    it('rejects non-string courseId', () => {
      expect(isValidCourseId(123 as unknown as string, mockCoursesData)).toBe(false);
      expect(isValidCourseId(null as unknown as string, mockCoursesData)).toBe(false);
      expect(isValidCourseId({} as unknown as string, mockCoursesData)).toBe(false);
    });
  });
});

describe('isValidLessonId', () => {
  describe('valid lesson IDs', () => {
    it('accepts valid lesson-N format', () => {
      expect(isValidLessonId('lesson-1')).toBe(true);
      expect(isValidLessonId('lesson-5')).toBe(true);
      expect(isValidLessonId('lesson-10')).toBe(true);
      expect(isValidLessonId('lesson-99')).toBe(true);
    });
  });

  describe('invalid lesson IDs', () => {
    it('rejects path traversal attempts', () => {
      expect(isValidLessonId('../lesson-1')).toBe(false);
      expect(isValidLessonId('lesson-1/..')).toBe(false);
      expect(isValidLessonId('lesson-1\\..\\admin')).toBe(false);
    });

    it('rejects invalid formats', () => {
      expect(isValidLessonId('lesson-')).toBe(false);
      expect(isValidLessonId('lesson-abc')).toBe(false);
      expect(isValidLessonId('LESSON-1')).toBe(false);
      expect(isValidLessonId('1')).toBe(false);
      expect(isValidLessonId('')).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(isValidLessonId(1 as unknown as string)).toBe(false);
      expect(isValidLessonId(null as unknown as string)).toBe(false);
    });
  });
});

describe('validateStudentCode', () => {
  describe('valid submissions', () => {
    it('accepts non-empty code', () => {
      const result = validateStudentCode('print("Hello")');
      expect(result.valid).toBe(true);
    });

    it('accepts code up to max length', () => {
      const code = 'a'.repeat(5000);
      const result = validateStudentCode(code);
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid submissions', () => {
    it('rejects empty string', () => {
      const result = validateStudentCode('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No code provided');
    });

    it('rejects whitespace-only code', () => {
      const result = validateStudentCode('   \n\t  ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Code cannot be only whitespace');
    });

    it('rejects code exceeding max length', () => {
      const code = 'a'.repeat(5001);
      const result = validateStudentCode(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    it('rejects non-string values', () => {
      const result = validateStudentCode(123 as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Code must be a string');
    });
  });

  describe('custom max length', () => {
    it('respects custom max length', () => {
      const result = validateStudentCode('a'.repeat(101), 100);
      expect(result.valid).toBe(false);
    });
  });
});

describe('validateAnswer', () => {
  // Pattern matching actual lesson 1: favorite_animal = "value"
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

  describe('correct answers', () => {
    it('validates correct variable assignment', () => {
      const result = validateAnswer(mockLesson, 'favorite_animal = "cat"');
      expect(result.correct).toBe(true);
      expect(result.hasAttempt).toBe(true);
      expect(result.reward).toEqual(mockLesson.reward);
      expect(result.nextLesson).toBe('lesson-2');
    });

    it('validates with single quotes', () => {
      const result = validateAnswer(mockLesson, "favorite_animal = 'dog'");
      expect(result.correct).toBe(true);
    });

    it('validates with spaces around equals', () => {
      const result = validateAnswer(mockLesson, 'favorite_animal   =   "rabbit"');
      expect(result.correct).toBe(true);
    });
  });

  describe('incorrect answers', () => {
    it('rejects wrong syntax', () => {
      const result = validateAnswer(mockLesson, 'console.log("Hello")');
      expect(result.correct).toBe(false);
      expect(result.hasAttempt).toBe(true);
      expect(result.message).toBe('Create a variable called favorite_animal with text inside quotes!');
    });

    it('provides hint on incorrect answer', () => {
      const result = validateAnswer(mockLesson, 'wrong answer');
      expect(result.hint).toBe('Use quotes for text!');
    });
  });

  describe('empty answers', () => {
    it('handles empty string', () => {
      const result = validateAnswer(mockLesson, '');
      expect(result.correct).toBe(false);
      expect(result.hasAttempt).toBe(false);
    });

    it('handles whitespace only', () => {
      const result = validateAnswer(mockLesson, '   ');
      expect(result.correct).toBe(false);
      expect(result.hasAttempt).toBe(false);
    });

    it('handles null/undefined', () => {
      const result = validateAnswer(mockLesson, null as unknown as string);
      expect(result.correct).toBe(false);
      expect(result.hasAttempt).toBe(false);
    });
  });

  describe('lessons without validation', () => {
    it('accepts any non-empty answer when no validation', () => {
      const lessonNoValidation = { exercise: { instruction: 'Write something' } };
      const result = validateAnswer(lessonNoValidation, 'anything');
      expect(result.correct).toBe(true);
    });

    it('accepts answer when no exercise defined', () => {
      const lessonNoExercise = {};
      const result = validateAnswer(lessonNoExercise, 'anything');
      expect(result.correct).toBe(true);
    });
  });

  describe('multiline code', () => {
    it('validates multiline code correctly', () => {
      const result = validateAnswer(mockLesson, `
# This is a comment
favorite_animal = "dragon"
print(favorite_animal)
# More comments
      `);
      expect(result.correct).toBe(true);
    });
  });

  describe('regex error handling', () => {
    it('handles invalid regex pattern gracefully', () => {
      const lessonBadRegex = {
        exercise: {
          validation: {
            type: 'regex',
            pattern: '[invalid(regex', // Invalid regex
          },
        },
      };

      // Should not throw
      const result = validateAnswer(lessonBadRegex, 'some long code here that is more than 10 chars');
      expect(result.hasAttempt).toBe(true);
      expect(result.error).toBeDefined();
    });
  });
});
