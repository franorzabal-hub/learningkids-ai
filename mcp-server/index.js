#!/usr/bin/env node

/**
 * LearnKids AI - MCP Server
 *
 * This server exposes educational content and tools to ChatGPT via the Model Context Protocol.
 * It provides courses, lessons, and exercise validation for children learning to code.
 *
 * @version 1.0.0
 * @license MIT
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// DATA LOADING
// ============================================================================

let coursesData = null;
let lessonsCache = new Map(); // Cache lessons by courseId

/**
 * Load courses catalog from JSON file
 */
async function loadCourses() {
  try {
    const coursesPath = path.join(__dirname, 'data', 'courses.json');
    const data = await fs.readFile(coursesPath, 'utf-8');
    coursesData = JSON.parse(data);
    console.error('[LearnKids] Loaded', coursesData.courses.length, 'courses');
    return coursesData;
  } catch (error) {
    console.error('[LearnKids] Error loading courses:', error);
    throw new Error('Failed to load courses data');
  }
}

/**
 * Load lessons for a specific course
 * @param {string} courseId - The course identifier
 * @returns {Promise<Object>} Lessons data
 */
async function loadLessons(courseId) {
  // Check cache first
  if (lessonsCache.has(courseId)) {
    return lessonsCache.get(courseId);
  }

  try {
    const lessonsPath = path.join(__dirname, 'data', 'lessons', `${courseId}.json`);
    const data = await fs.readFile(lessonsPath, 'utf-8');
    const lessons = JSON.parse(data);

    // Cache it
    lessonsCache.set(courseId, lessons);

    console.error(`[LearnKids] Loaded ${lessons.lessons.length} lessons for course: ${courseId}`);
    return lessons;
  } catch (error) {
    console.error(`[LearnKids] Error loading lessons for ${courseId}:`, error);
    throw new Error(`Failed to load lessons for course: ${courseId}`);
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate a course ID exists
 * @param {string} courseId - Course ID to validate
 * @returns {boolean} True if valid
 */
function isValidCourseId(courseId) {
  if (!coursesData) return false;

  // Prevent path traversal
  if (courseId.includes('..') || courseId.includes('/') || courseId.includes('\\')) {
    return false;
  }

  return coursesData.courses.some(course => course.id === courseId);
}

/**
 * Validate user's code answer for an exercise
 * @param {Object} lesson - The lesson object containing validation rules
 * @param {string} userAnswer - User's submitted code
 * @returns {Object} Validation result
 */
function validateAnswer(lesson, userAnswer) {
  if (!lesson.exercise || !lesson.exercise.validation) {
    // No validation rules - accept any non-empty answer
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
      const regex = new RegExp(validation.pattern, 'i'); // case-insensitive
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

    // Default: accept non-empty
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
// MCP SERVER SETUP
// ============================================================================

const server = new Server(
  {
    name: 'learningkids-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    },
  }
);

// ============================================================================
// TOOL HANDLERS
// ============================================================================

/**
 * List all available tools
 */
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'getCourses',
        description: 'Returns a list of all available courses. Use this when the student wants to browse available courses or start learning.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'getCourse',
        description: 'Gets detailed information about a specific course including all lesson titles and objectives. Use this when the student wants to know more about a specific course before starting.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The unique identifier of the course (e.g., "python-kids")',
            },
          },
          required: ['courseId'],
        },
      },
      {
        name: 'getLesson',
        description: 'Retrieves complete content for a specific lesson including explanations, examples, and exercises. Use this when the student wants to start or continue a lesson.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The course identifier',
            },
            lessonId: {
              type: 'string',
              description: 'The lesson identifier (e.g., "lesson-1")',
            },
          },
          required: ['courseId', 'lessonId'],
        },
      },
      {
        name: 'checkAnswer',
        description: 'Validates a student\'s code submission for an exercise. Returns whether the answer is correct and provides feedback. Use this when the student submits their code for an exercise.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The course identifier',
            },
            lessonId: {
              type: 'string',
              description: 'The lesson identifier',
            },
            answer: {
              type: 'string',
              description: 'The student\'s code submission',
            },
          },
          required: ['courseId', 'lessonId', 'answer'],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Ensure data is loaded
    if (!coursesData) {
      await loadCourses();
    }

    // ========================================================================
    // Tool: getCourses
    // ========================================================================
    if (name === 'getCourses') {
      console.error('[LearnKids] Tool called: getCourses');

      return {
        content: [
          {
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
          },
        ],
      };
    }

    // ========================================================================
    // Tool: getCourse
    // ========================================================================
    if (name === 'getCourse') {
      console.error('[LearnKids] Tool called: getCourse', args);

      const { courseId } = args;

      // Validate course ID
      if (!isValidCourseId(courseId)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Course not found',
                errorCode: 'COURSE_NOT_FOUND',
              }),
            },
          ],
        };
      }

      const course = coursesData.courses.find(c => c.id === courseId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                course,
              },
            }),
          },
        ],
      };
    }

    // ========================================================================
    // Tool: getLesson
    // ========================================================================
    if (name === 'getLesson') {
      console.error('[LearnKids] Tool called: getLesson', args);

      const { courseId, lessonId } = args;

      // Validate course ID
      if (!isValidCourseId(courseId)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Course not found',
                errorCode: 'COURSE_NOT_FOUND',
              }),
            },
          ],
        };
      }

      // Validate lesson ID format
      if (lessonId.includes('..') || !lessonId.startsWith('lesson-')) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Invalid lesson ID',
                errorCode: 'INVALID_LESSON_ID',
              }),
            },
          ],
        };
      }

      // Load lessons for this course
      const lessonsData = await loadLessons(courseId);
      const lesson = lessonsData.lessons.find(l => l.id === lessonId);

      if (!lesson) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Lesson not found',
                errorCode: 'LESSON_NOT_FOUND',
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                lesson,
              },
            }),
          },
        ],
      };
    }

    // ========================================================================
    // Tool: checkAnswer
    // ========================================================================
    if (name === 'checkAnswer') {
      console.error('[LearnKids] Tool called: checkAnswer', {
        courseId: args.courseId,
        lessonId: args.lessonId,
        answerLength: args.answer?.length,
      });

      const { courseId, lessonId, answer } = args;

      // Validate inputs
      if (!isValidCourseId(courseId)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Course not found',
              }),
            },
          ],
        };
      }

      // Load lesson
      const lessonsData = await loadLessons(courseId);
      const lesson = lessonsData.lessons.find(l => l.id === lessonId);

      if (!lesson) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Lesson not found',
              }),
            },
          ],
        };
      }

      // Validate the answer
      const result = validateAnswer(lesson, answer);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: result,
            }),
          },
        ],
      };
    }

    // Unknown tool
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error(`[LearnKids] Error in tool ${name}:`, error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            errorCode: 'INTERNAL_ERROR',
          }),
        },
      ],
    };
  }
});

// ============================================================================
// RESOURCES (Optional - for ChatGPT to access data without explicit tools)
// ============================================================================

server.setRequestHandler('resources/list', async () => {
  return {
    resources: [
      {
        uri: 'learningkids://courses',
        name: 'Course Catalog',
        description: 'Complete catalog of all available courses',
        mimeType: 'application/json',
      },
    ],
  };
});

server.setRequestHandler('resources/read', async (request) => {
  const { uri } = request.params;

  if (uri === 'learningkids://courses') {
    if (!coursesData) {
      await loadCourses();
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(coursesData, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function main() {
  try {
    console.error('[LearnKids] Starting MCP server...');

    // Load data at startup
    await loadCourses();

    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('[LearnKids] MCP server running successfully! 🚀');
    console.error('[LearnKids] Courses available:', coursesData.courses.length);
  } catch (error) {
    console.error('[LearnKids] Fatal error starting server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\n[LearnKids] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n[LearnKids] Shutting down gracefully...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('[LearnKids] Unhandled error:', error);
  process.exit(1);
});
