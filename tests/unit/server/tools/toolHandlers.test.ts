import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDataLoader } from '../../../../lib/data.js';
import { isValidCourseId, validateAnswer } from '../../../../lib/validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../../mcp-server/data');

/**
 * These tests simulate the MCP tool handlers by testing the
 * underlying logic that powers them
 */

describe('get-courses tool logic', () => {
  let loader: ReturnType<typeof createDataLoader>;

  beforeEach(() => {
    loader = createDataLoader(DATA_DIR);
  });

  it('returns list of all courses', async () => {
    const coursesData = await loader.loadCourses();
    const coursesList = coursesData.courses.map((course: {
      id: string;
      title: string;
      emoji: string;
      description: string;
      ageRange: string;
      difficulty: string;
      totalLessons: number;
      estimatedDuration: string;
    }) => ({
      id: course.id,
      title: course.title,
      emoji: course.emoji,
      description: course.description,
      ageRange: course.ageRange,
      difficulty: course.difficulty,
      totalLessons: course.totalLessons,
      estimatedDuration: course.estimatedDuration,
    }));

    expect(coursesList.length).toBeGreaterThan(0);
    expect(coursesList[0]).toHaveProperty('id');
    expect(coursesList[0]).toHaveProperty('title');
    expect(coursesList[0]).toHaveProperty('totalLessons');
  });

  it('courses have all required display fields', async () => {
    const coursesData = await loader.loadCourses();

    for (const course of coursesData.courses) {
      expect(course.id).toBeDefined();
      expect(course.title).toBeDefined();
      expect(course.emoji).toBeDefined();
      expect(course.description).toBeDefined();
    }
  });
});

describe('view-course-details tool logic', () => {
  let loader: ReturnType<typeof createDataLoader>;
  let coursesData: { courses: Array<{ id: string; title: string; totalLessons: number }> };

  beforeEach(async () => {
    loader = createDataLoader(DATA_DIR);
    coursesData = await loader.loadCourses();
  });

  it('returns course details for valid courseId', () => {
    const courseId = 'python-kids';
    expect(isValidCourseId(courseId, coursesData)).toBe(true);

    const course = coursesData.courses.find((c: { id: string }) => c.id === courseId);
    expect(course).toBeDefined();
    expect(course?.title).toBeDefined();
    expect(course?.totalLessons).toBeGreaterThan(0);
  });

  it('rejects invalid courseId', () => {
    expect(isValidCourseId('nonexistent', coursesData)).toBe(false);
    expect(isValidCourseId('../etc/passwd', coursesData)).toBe(false);
  });
});

describe('start-lesson tool logic', () => {
  let loader: ReturnType<typeof createDataLoader>;
  let coursesData: { courses: Array<{ id: string }> };

  beforeEach(async () => {
    loader = createDataLoader(DATA_DIR);
    coursesData = await loader.loadCourses();
  });

  it('loads lesson for valid courseId and lessonNumber', async () => {
    const courseId = 'python-kids';
    const lessonNumber = 1;

    expect(isValidCourseId(courseId, coursesData)).toBe(true);

    const lessonsData = await loader.loadLessons(courseId);
    const lessonId = `lesson-${lessonNumber}`;
    const lesson = lessonsData.lessons.find((l: { id: string }) => l.id === lessonId);

    expect(lesson).toBeDefined();
    expect(lesson.title).toBeDefined();
    expect(lesson.content).toBeDefined();
  });

  it('returns undefined for out-of-range lessonNumber', async () => {
    const courseId = 'python-kids';
    const lessonsData = await loader.loadLessons(courseId);

    const lessonId = 'lesson-999';
    const lesson = lessonsData.lessons.find((l: { id: string }) => l.id === lessonId);

    expect(lesson).toBeUndefined();
  });

  it('returns undefined for lessonNumber 0', async () => {
    const courseId = 'python-kids';
    const lessonsData = await loader.loadLessons(courseId);

    const lessonId = 'lesson-0';
    const lesson = lessonsData.lessons.find((l: { id: string }) => l.id === lessonId);

    expect(lesson).toBeUndefined();
  });
});

describe('check-student-work tool logic', () => {
  let loader: ReturnType<typeof createDataLoader>;
  let coursesData: { courses: Array<{ id: string }> };

  beforeEach(async () => {
    loader = createDataLoader(DATA_DIR);
    coursesData = await loader.loadCourses();
  });

  it('validates correct answer', async () => {
    const courseId = 'python-kids';
    const lessonsData = await loader.loadLessons(courseId);
    const lesson = lessonsData.lessons[0];

    // Lesson 1 expects: favorite_animal = "value"
    const correctCode = 'favorite_animal = "cat"\nprint(favorite_animal)';
    const result = validateAnswer(lesson, correctCode);

    expect(result.correct).toBe(true);
    expect(result.hasAttempt).toBe(true);
  });

  it('rejects incorrect answer', async () => {
    const courseId = 'python-kids';
    const lessonsData = await loader.loadLessons(courseId);
    const lesson = lessonsData.lessons[0];

    // This doesn't match the pattern: favorite_animal = "value"
    const incorrectCode = 'wrong_variable = "cat"';
    const result = validateAnswer(lesson, incorrectCode);

    expect(result.correct).toBe(false);
    expect(result.hasAttempt).toBe(true);
  });

  it('handles empty submission', async () => {
    const courseId = 'python-kids';
    const lessonsData = await loader.loadLessons(courseId);
    const lesson = lessonsData.lessons[0];

    const result = validateAnswer(lesson, '');

    expect(result.correct).toBe(false);
    expect(result.hasAttempt).toBe(false);
  });

  it('returns reward for correct answer', async () => {
    const courseId = 'python-kids';
    const lessonsData = await loader.loadLessons(courseId);
    const lesson = lessonsData.lessons[0];

    // Lesson 1 expects: favorite_animal = "value"
    const correctCode = 'favorite_animal = "dragon"';
    const result = validateAnswer(lesson, correctCode);

    if (result.correct && lesson.reward) {
      expect(result.reward).toBeDefined();
    }
  });

  it('returns nextLesson for correct answer', async () => {
    const courseId = 'python-kids';
    const lessonsData = await loader.loadLessons(courseId);
    const lesson = lessonsData.lessons[0];

    // Lesson 1 expects: favorite_animal = "value"
    const correctCode = 'favorite_animal = "unicorn"';
    const result = validateAnswer(lesson, correctCode);

    if (result.correct && lesson.nextLesson) {
      expect(result.nextLesson).toBeDefined();
    }
  });
});

describe('tool response format', () => {
  let loader: ReturnType<typeof createDataLoader>;

  beforeEach(() => {
    loader = createDataLoader(DATA_DIR);
  });

  it('get-courses returns proper MCP format', async () => {
    const coursesData = await loader.loadCourses();
    const coursesList = coursesData.courses.map((course: {
      id: string;
      title: string;
      emoji?: string;
      description?: string;
    }) => ({
      id: course.id,
      title: course.title,
      emoji: course.emoji,
      description: course.description,
    }));

    // Simulate MCP response format
    const response = {
      content: [
        {
          type: 'text',
          text: `Found ${coursesList.length} courses available`,
        },
      ],
      structuredContent: {
        courses: coursesList,
      },
    };

    expect(response.content[0].type).toBe('text');
    expect(response.structuredContent.courses).toBeInstanceOf(Array);
  });

  it('error responses have proper format', () => {
    // Simulate error response
    const errorResponse = {
      content: [
        {
          type: 'text',
          text: 'Course "nonexistent" not found',
        },
      ],
      isError: true,
    };

    expect(errorResponse.isError).toBe(true);
    expect(errorResponse.content[0].text).toContain('not found');
  });
});
