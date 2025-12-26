/**
 * LearnKids AI - MCP Handler for Vercel
 *
 * Uses official Vercel mcp-handler for serverless deployment
 * @version 2.0.0
 */

import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// DATA LOADING (LAZY)
// ============================================================================

let coursesData = null;
let lessonsCache = new Map();

async function loadCourses() {
  if (coursesData) return coursesData;

  try {
    const coursesPath = path.join(__dirname, '..', 'mcp-server', 'data', 'courses.json');
    const data = await fs.readFile(coursesPath, 'utf-8');
    coursesData = JSON.parse(data);
    console.log('[LearnKids] Loaded', coursesData.courses.length, 'courses');
    return coursesData;
  } catch (error) {
    console.error('[LearnKids] Error loading courses:', error);
    throw new Error('Failed to load courses data');
  }
}

async function loadLessons(courseId) {
  if (lessonsCache.has(courseId)) {
    return lessonsCache.get(courseId);
  }

  try {
    const lessonsPath = path.join(__dirname, '..', 'mcp-server', 'data', 'lessons', `${courseId}.json`);
    const data = await fs.readFile(lessonsPath, 'utf-8');
    const lessons = JSON.parse(data);
    lessonsCache.set(courseId, lessons);
    console.log(`[LearnKids] Loaded ${lessons.lessons.length} lessons for: ${courseId}`);
    return lessons;
  } catch (error) {
    console.error(`[LearnKids] Error loading lessons for ${courseId}:`, error);
    throw new Error(`Failed to load lessons for course: ${courseId}`);
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function isValidCourseId(courseId) {
  if (!coursesData) return false;
  if (courseId.includes('..') || courseId.includes('/') || courseId.includes('\\')) {
    return false;
  }
  return coursesData.courses.some(course => course.id === courseId);
}

function validateAnswer(lesson, userAnswer) {
  if (!lesson.exercise || !lesson.exercise.validation) {
    return {
      correct: userAnswer.trim().length > 0,
      message: userAnswer.trim().length > 0
        ? "Great job! ✨"
        : "Please write some code first!"
    };
  }

  const { validation } = lesson.exercise;

  try {
    if (validation.type === 'regex') {
      const regex = new RegExp(validation.pattern, 'i');
      const isValid = regex.test(userAnswer);

      if (isValid) {
        return {
          correct: true,
          message: lesson.reward?.message || "Excellent work! 🌟",
          reward: lesson.reward || null,
          nextLesson: lesson.nextLesson || null
        };
      } else {
        return {
          correct: false,
          message: "Not quite right. " + (lesson.exercise.hint || "Try again!"),
          hint: lesson.exercise.hint
        };
      }
    }

    return {
      correct: true,
      message: "Good effort! Keep going! 💪"
    };
  } catch (error) {
    console.error('[LearnKids] Validation error:', error);
    return {
      correct: false,
      message: "Oops! Something went wrong. Try again!",
      error: error.message
    };
  }
}

// ============================================================================
// MCP HANDLER
// ============================================================================

const handler = createMcpHandler(
  (server) => {
    console.log('[LearnKids] Setting up MCP tools...');

    // Tool: getCourses
    server.tool(
      'getCourses',
      'Returns a list of all available courses. Use this when the student wants to browse available courses or start learning.',
      {},
      async () => {
        console.log('[LearnKids] Tool called: getCourses');
        await loadCourses();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                courses: coursesData.courses.map(course => ({
                  id: course.id,
                  title: course.title,
                  emoji: course.emoji,
                  color: course.color,
                  description: course.description,
                  ageRange: course.ageRange,
                  difficulty: course.difficulty,
                  totalLessons: course.totalLessons,
                  estimatedDuration: course.estimatedDuration,
                })),
              },
            }),
          }],
        };
      }
    );

    // Tool: getCourse
    server.tool(
      'getCourse',
      'Gets detailed information about a specific course including all lesson titles and objectives.',
      {
        courseId: z.string().describe('The unique identifier of the course (e.g., "python-kids")'),
      },
      async ({ courseId }) => {
        console.log('[LearnKids] Tool called: getCourse', courseId);
        await loadCourses();

        if (!isValidCourseId(courseId)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Course not found',
                errorCode: 'COURSE_NOT_FOUND',
              }),
            }],
          };
        }

        const course = coursesData.courses.find(c => c.id === courseId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: { course },
            }),
          }],
        };
      }
    );

    // Tool: getLesson
    server.tool(
      'getLesson',
      'Retrieves complete content for a specific lesson including explanations, examples, and exercises.',
      {
        courseId: z.string().describe('The course identifier'),
        lessonId: z.string().describe('The lesson identifier (e.g., "lesson-1")'),
      },
      async ({ courseId, lessonId }) => {
        console.log('[LearnKids] Tool called: getLesson', { courseId, lessonId });
        await loadCourses();

        if (!isValidCourseId(courseId)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Course not found',
                errorCode: 'COURSE_NOT_FOUND',
              }),
            }],
          };
        }

        if (lessonId.includes('..') || !lessonId.startsWith('lesson-')) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Invalid lesson ID',
                errorCode: 'INVALID_LESSON_ID',
              }),
            }],
          };
        }

        const lessonsData = await loadLessons(courseId);
        const lesson = lessonsData.lessons.find(l => l.id === lessonId);

        if (!lesson) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Lesson not found',
                errorCode: 'LESSON_NOT_FOUND',
              }),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: { lesson },
            }),
          }],
        };
      }
    );

    // Tool: checkAnswer
    server.tool(
      'checkAnswer',
      'Validates a student\'s code submission for an exercise. Returns whether the answer is correct and provides feedback.',
      {
        courseId: z.string().describe('The course identifier'),
        lessonId: z.string().describe('The lesson identifier'),
        answer: z.string().describe('The student\'s code submission'),
      },
      async ({ courseId, lessonId, answer }) => {
        console.log('[LearnKids] Tool called: checkAnswer', {
          courseId,
          lessonId,
          answerLength: answer?.length,
        });
        await loadCourses();

        if (!isValidCourseId(courseId)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Course not found',
              }),
            }],
          };
        }

        const lessonsData = await loadLessons(courseId);
        const lesson = lessonsData.lessons.find(l => l.id === lessonId);

        if (!lesson) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Lesson not found',
              }),
            }],
          };
        }

        const result = validateAnswer(lesson, answer);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: result,
            }),
          }],
        };
      }
    );

    // Resource: Course Catalog
    server.resource(
      'learningkids://courses',
      'Complete catalog of all available courses',
      async () => {
        await loadCourses();
        return {
          contents: [{
            uri: 'learningkids://courses',
            mimeType: 'application/json',
            text: JSON.stringify(coursesData, null, 2),
          }],
        };
      }
    );
  },
  {
    serverInfo: {
      name: 'learningkids-server',
      version: '2.0.0',
    },
    capabilities: {
      tools: {},
      resources: {},
    },
  },
  {
    basePath: '/api/mcp',
    maxDuration: 60,
    verboseLogs: true,
  }
);

// Export for Vercel serverless (all HTTP methods for CORS and SSE)
export { handler as GET, handler as POST, handler as OPTIONS };
