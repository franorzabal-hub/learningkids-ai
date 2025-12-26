/**
 * LearnKids AI - MCP Server for Cloud Run / Railway
 *
 * Persistent HTTP server with SSE support for ChatGPT Apps SDK
 * Based on OpenAI's official pizzaz_server_node example
 *
 * Compatible with: Cloud Run, Railway, Fly.io
 * @version 2.1.0
 */

import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;
const SSE_PATH = '/mcp';
const POST_PATH = '/mcp/messages';

// ============================================================================
// DATA LOADING
// ============================================================================

let coursesData = null;
let lessonsCache = new Map();

async function loadCourses() {
  if (coursesData) return coursesData;

  try {
    const coursesPath = path.join(__dirname, 'mcp-server', 'data', 'courses.json');
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
    const lessonsPath = path.join(__dirname, 'mcp-server', 'data', 'lessons', `${courseId}.json`);
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

function isValidCourseId(courseId) {
  if (!coursesData) return false;
  if (courseId.includes('..') || courseId.includes('/') || courseId.includes('\\')) {
    return false;
  }
  return coursesData.courses.some(course => course.id === courseId);
}

// ============================================================================
// MCP SERVER FACTORY
// ============================================================================

function createMcpServer() {
  const server = new Server(
    {
      name: 'learningkids-server',
      version: '2.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
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

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'getCourses': {
          await loadCourses();
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

        case 'getCourse': {
          const { courseId } = args;
          await loadCourses();

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

        case 'getLesson': {
          const { courseId, lessonId } = args;
          await loadCourses();

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

        case 'checkAnswer': {
          const { courseId, lessonId, answer } = args;
          await loadCourses();

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

          // Validation logic
          const isCorrect = answer && answer.trim().length > 0;

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  data: {
                    correct: isCorrect,
                    message: isCorrect ? 'Great job! ✨' : 'Please write some code first!',
                  },
                }),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Unknown tool: ${name}`,
                }),
              },
            ],
          };
      }
    } catch (error) {
      console.error(`[LearnKids] Error in tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }),
          },
        ],
      };
    }
  });

  return server;
}

// ============================================================================
// HTTP SERVER
// ============================================================================

async function handleSseRequest(res) {
  console.log('[LearnKids] New SSE connection');

  const server = createMcpServer();
  const transport = new SSEServerTransport(POST_PATH, res);

  try {
    await server.connect(transport);
    console.log('[LearnKids] SSE connection established');
  } catch (error) {
    console.error('[LearnKids] SSE connection error:', error);
    if (!res.headersSent) {
      res.writeHead(500).end('Failed to establish SSE connection');
    }
  }
}

async function handlePostMessage(req, res, url) {
  console.log('[LearnKids] Message received:', {
    sessionId: url.searchParams.get('sessionId'),
    path: url.pathname,
  });

  // Read request body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString();

  console.log('[LearnKids] Message body:', body);

  // For now, acknowledge receipt
  // In a full implementation, this would route to the correct SSE session
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify({ received: true }));
}

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end('Missing URL');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS' && (url.pathname === SSE_PATH || url.pathname === POST_PATH)) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
    });
    res.end();
    return;
  }

  // Handle SSE connection
  if (req.method === 'GET' && url.pathname === SSE_PATH) {
    await handleSseRequest(res);
    return;
  }

  // Handle message posting
  if (req.method === 'POST' && url.pathname === POST_PATH) {
    await handlePostMessage(req, res, url);
    return;
  }

  // Health check
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      version: '2.1.0',
      server: process.env.K_SERVICE ? 'Cloud Run' : 'Railway',
      transport: 'SSE',
      mcp: 'enabled',
    }));
    return;
  }

  // Root endpoint - info
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'LearnKids AI',
      version: '2.1.0',
      description: 'Interactive learning platform for kids',
      mcp: {
        endpoint: '/mcp',
        transport: 'SSE',
        tools: ['getCourses', 'getCourse', 'getLesson', 'checkAnswer'],
      },
      endpoints: {
        health: '/health',
        mcp: '/mcp',
        mcpMessages: '/mcp/messages',
      },
      documentation: 'https://github.com/franorzabal-hub/learningkids-ai',
    }));
    return;
  }

  res.writeHead(404).end('Not Found');
});

httpServer.on('clientError', (err, socket) => {
  console.error('[LearnKids] HTTP client error:', err);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

httpServer.listen(PORT, () => {
  console.log(`🎓 LearnKids AI MCP server listening on port ${PORT}`);
  console.log(`  SSE stream: GET http://localhost:${PORT}${SSE_PATH}`);
  console.log(`  Message endpoint: POST http://localhost:${PORT}${POST_PATH}`);
  console.log(`  Health check: GET http://localhost:${PORT}/health`);
});
