#!/usr/bin/env node

/**
 * LearnKids AI - MCP Server
 *
 * This server exposes educational content and tools to ChatGPT via the Model Context Protocol.
 * It provides courses, lessons, and exercise validation for children learning to code.
 *
 * @version 2.6.0
 * @license MIT
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { APP_VERSION } from '../lib/config.js';
import { buildStudentValidation } from '../lib/lessonValidation.js';
import { isValidCourseId } from '../lib/validation.js';

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
// VALIDATION HELPERS (shared via lib/validation.js)
// ============================================================================

// ============================================================================
// MCP SERVER SETUP
// ============================================================================

const server = new Server(
  {
    name: 'learningkids-server',
    version: APP_VERSION,
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
        name: 'get-courses',
        description: 'Returns a list of all available courses. Use this when the student wants to browse available courses or start learning.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: 'view-course-details',
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
          additionalProperties: false,
        },
      },
      {
        name: 'get-course-details',
        description: 'Alias for view-course-details. Gets detailed information about a specific course including all lesson titles and objectives.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The unique identifier of the course (e.g., "python-kids")',
            },
          },
          required: ['courseId'],
          additionalProperties: false,
        },
      },
      {
        name: 'start-lesson',
        description: 'Retrieves complete content for a specific lesson including explanations, examples, and exercises. Use this when the student wants to start or continue a lesson.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The course identifier',
            },
            lessonNumber: {
              type: 'number',
              description: 'Lesson number (1-10)',
              minimum: 1,
              maximum: 10,
            },
          },
          required: ['courseId', 'lessonNumber'],
          additionalProperties: false,
        },
      },
      {
        name: 'check-student-work',
        description: 'Validates a student\'s code submission for an exercise. Returns whether the answer is correct and provides feedback. Use this when the student submits their code for an exercise.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The course identifier',
            },
            lessonNumber: {
              type: 'number',
              description: 'Lesson number (1-10)',
              minimum: 1,
              maximum: 10,
            },
            studentCode: {
              type: 'string',
              description: 'The student\'s code submission',
              maxLength: 5000,
            },
          },
          required: ['courseId', 'lessonNumber', 'studentCode'],
          additionalProperties: false,
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
    // Tool: get-courses
    // ========================================================================
    if (name === 'get-courses') {
      console.error('[LearnKids] Tool called: get-courses');

      const coursesList = coursesData.courses.map(course => ({
        id: course.id,
        title: course.title,
        emoji: course.emoji,
        color: course.color,
        description: course.description,
        ageRange: course.ageRange,
        difficulty: course.difficulty,
        totalLessons: course.totalLessons,
        estimatedDuration: course.estimatedDuration,
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Found ${coursesList.length} course${coursesList.length !== 1 ? 's' : ''} available for learning.`,
          },
        ],
        structuredContent: {
          courses: coursesList,
        },
      };
    }

    // ========================================================================
    // Tool: view-course-details
    // ========================================================================
    if (name === 'view-course-details' || name === 'get-course-details') {
      console.error('[LearnKids] Tool called: view-course-details', args);

      const { courseId } = args;

      // Validate course ID
      if (!isValidCourseId(courseId, coursesData)) {
        return {
          content: [
            {
              type: 'text',
              text: `Course "${courseId}" not found. Please use get-courses to see available courses.`,
            },
          ],
          isError: true,
        };
      }

      const course = coursesData.courses.find(c => c.id === courseId);
      const lessonsData = await loadLessons(courseId);
      const lessonsSummary = lessonsData.lessons.map(lesson => ({
        id: lesson.id,
        number: lesson.order,
        title: lesson.title,
        duration: lesson.duration,
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Loaded details for "${course.title}" - ${course.totalLessons} lessons covering ${course.description}`,
          },
        ],
        structuredContent: {
          course: {
            id: course.id,
            title: course.title,
            description: course.description,
            ageRange: course.ageRange,
            difficulty: course.difficulty,
            totalLessons: course.totalLessons,
            estimatedDuration: course.estimatedDuration,
            prerequisites: course.prerequisites || [],
            learningObjectives: course.learningObjectives || [],
            lessonIds: course.lessonIds || lessonsSummary.map(lesson => lesson.id),
            lessons: lessonsSummary,
          },
        },
      };
    }

    // ========================================================================
    // Tool: start-lesson
    // ========================================================================
    if (name === 'start-lesson') {
      console.error('[LearnKids] Tool called: start-lesson', args);

      const { courseId, lessonNumber } = args;

      // Validate course ID
      if (!isValidCourseId(courseId, coursesData)) {
        return {
          content: [
            {
              type: 'text',
              text: `Course "${courseId}" not found.`,
            },
          ],
          isError: true,
        };
      }

      // Load lessons for this course
      const lessonsData = await loadLessons(courseId);
      const lessonId = `lesson-${lessonNumber}`;
      const lesson = lessonsData.lessons.find(l => l.id === lessonId);

      if (!lesson) {
        return {
          content: [
            {
              type: 'text',
              text: `Lesson ${lessonNumber} not found in this course. Available lessons: 1-${lessonsData.lessons.length}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Starting "${lesson.title}" - ${lesson.objective}`,
          },
        ],
        structuredContent: {
          lesson: {
            id: lesson.id,
            courseId,
            number: lessonNumber,
            title: lesson.title,
            objective: lesson.objective,
            duration: lesson.duration,
            content: lesson.content,
            examples: lesson.examples,
            exercise: lesson.exercise,
          },
        },
      };
    }

    // ========================================================================
    // Tool: check-student-work
    // ========================================================================
    if (name === 'check-student-work') {
      console.error('[LearnKids] Tool called: check-student-work', {
        courseId: args.courseId,
        lessonNumber: args.lessonNumber,
        answerLength: args.studentCode?.length,
      });

      const { courseId, lessonNumber, studentCode } = args;

      // Validate inputs
      if (!isValidCourseId(courseId, coursesData)) {
        return {
          content: [
            {
              type: 'text',
              text: `Course "${courseId}" not found.`,
            },
          ],
          isError: true,
        };
      }

      // Load lesson
      const lessonsData = await loadLessons(courseId);
      const lessonId = `lesson-${lessonNumber}`;
      const lesson = lessonsData.lessons.find(l => l.id === lessonId);

      if (!lesson) {
        return {
          content: [
            {
              type: 'text',
              text: `Lesson ${lessonNumber} not found.`,
            },
          ],
          isError: true,
        };
      }

      // Validate the answer
      const validationResult = buildStudentValidation(lesson, studentCode, { maxLength: 5000 });
      const feedback = validationResult.message
        || (validationResult.correct
          ? '✨ Great job! Your code is correct!'
          : 'Your code needs some adjustments. Check the instructions and try again!');

      const responseValidation = {
        correct: validationResult.correct,
        hasAttempt: validationResult.hasAttempt,
        message: feedback,
        reward: validationResult.correct ? validationResult.reward || null : null,
        nextLesson: validationResult.correct ? validationResult.nextLesson || null : null,
        hint: validationResult.hint,
        error: validationResult.error,
      };

      return {
        content: [
          {
            type: 'text',
            text: feedback,
          },
        ],
        structuredContent: {
          validation: responseValidation,
        },
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
