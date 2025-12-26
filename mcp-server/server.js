#!/usr/bin/env node

/**
 * LearnKids AI - HTTP Server for Vercel
 *
 * This server exposes MCP tools via HTTP/SSE for deployment on Vercel.
 * Replaces the stdio transport with SSE transport for serverless compatibility.
 *
 * @version 2.0.0
 * @license MIT
 */

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// DATA LOADING (Same as before)
// ============================================================================

let coursesData = null;
let lessonsCache = new Map();

async function loadCourses() {
  try {
    const coursesPath = path.join(__dirname, 'data', 'courses.json');
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
    const lessonsPath = path.join(__dirname, 'data', 'lessons', `${courseId}.json`);
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
// VALIDATION HELPERS (Same as before)
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
// MCP SERVER SETUP
// ============================================================================

const mcpServer = new Server(
  {
    name: 'learningkids-server',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    },
  }
);

// Tool Handlers (Same as before)
mcpServer.setRequestHandler('tools/list', async () => {
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
        description: 'Gets detailed information about a specific course including all lesson titles and objectives.',
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
        description: 'Retrieves complete content for a specific lesson including explanations, examples, and exercises.',
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
        description: 'Validates a student\'s code submission for an exercise. Returns whether the answer is correct and provides feedback.',
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

mcpServer.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (!coursesData) {
      await loadCourses();
    }

    // getCourses
    if (name === 'getCourses') {
      console.log('[LearnKids] Tool called: getCourses');
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

    // getCourse
    if (name === 'getCourse') {
      console.log('[LearnKids] Tool called: getCourse', args);
      const { courseId } = args;

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
              data: { course },
            }),
          },
        ],
      };
    }

    // getLesson
    if (name === 'getLesson') {
      console.log('[LearnKids] Tool called: getLesson', args);
      const { courseId, lessonId } = args;

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
              data: { lesson },
            }),
          },
        ],
      };
    }

    // checkAnswer
    if (name === 'checkAnswer') {
      console.log('[LearnKids] Tool called: checkAnswer', {
        courseId: args.courseId,
        lessonId: args.lessonId,
        answerLength: args.answer?.length,
      });

      const { courseId, lessonId, answer } = args;

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

// Resources
mcpServer.setRequestHandler('resources/list', async () => {
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

mcpServer.setRequestHandler('resources/read', async (request) => {
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
// EXPRESS HTTP SERVER
// ============================================================================

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (web component)
app.use(express.static(path.join(__dirname, '..', 'web-component')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    transport: 'SSE'
  });
});

// MCP SSE endpoint
app.post('/api/mcp', async (req, res) => {
  console.log('[LearnKids] MCP connection established via SSE');

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const transport = new SSEServerTransport('/api/mcp', res);
    await mcpServer.connect(transport);

    console.log('[LearnKids] MCP server connected via SSE');

    // Handle client disconnect
    req.on('close', () => {
      console.log('[LearnKids] MCP client disconnected');
    });
  } catch (error) {
    console.error('[LearnKids] Error setting up SSE transport:', error);
    res.status(500).json({
      error: 'Failed to establish MCP connection',
      message: error.message
    });
  }
});

// MCP GET endpoint (for SSE initial connection)
app.get('/api/mcp', async (req, res) => {
  console.log('[LearnKids] MCP SSE GET request');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const transport = new SSEServerTransport('/api/mcp', res);
    await mcpServer.connect(transport);

    console.log('[LearnKids] MCP server connected via SSE (GET)');

    req.on('close', () => {
      console.log('[LearnKids] MCP client disconnected');
    });
  } catch (error) {
    console.error('[LearnKids] Error in SSE GET:', error);
    res.status(500).end();
  }
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web-component', 'index.html'));
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function startServer() {
  try {
    console.log('[LearnKids] Starting HTTP server...');

    // Load data at startup
    await loadCourses();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log('[LearnKids] ✅ HTTP server running on port', PORT);
      console.log('[LearnKids] 🚀 MCP endpoint: /api/mcp');
      console.log('[LearnKids] 🎨 Web UI: http://localhost:' + PORT);
      console.log('[LearnKids] ❤️  Health check: http://localhost:' + PORT + '/health');
    });
  } catch (error) {
    console.error('[LearnKids] Fatal error starting server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[LearnKids] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[LearnKids] Shutting down gracefully...');
  process.exit(0);
});

// Start if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('[LearnKids] Unhandled error:', error);
    process.exit(1);
  });
}

// Export for Vercel
export default app;
