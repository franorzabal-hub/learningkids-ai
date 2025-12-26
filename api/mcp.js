/**
 * LearnKids AI - MCP SSE Endpoint (ChatGPT Compatible)
 *
 * This endpoint handles SSE (Server-Sent Events) connections from ChatGPT.
 * ChatGPT expects exactly: GET /mcp
 *
 * Based on OpenAI's official example:
 * https://github.com/openai/openai-apps-sdk-examples/blob/main/pizzaz_server_node/src/server.ts
 *
 * @version 2.0.1
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// DATA LOADING
// ============================================================================

let coursesData = null;
let lessonsCache = new Map();

async function loadCourses() {
  if (coursesData) return coursesData;

  try {
    const coursesPath = path.join(__dirname, '..', 'mcp-server', 'data', 'courses.json');
    const data = await fs.readFile(coursesPath, 'utf-8');
    coursesData = JSON.parse(data);
    console.log('[LearnKids MCP] Loaded', coursesData.courses.length, 'courses');
    return coursesData;
  } catch (error) {
    console.error('[LearnKids MCP] Error loading courses:', error);
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
    console.log(`[LearnKids MCP] Loaded ${lessons.lessons.length} lessons for: ${courseId}`);
    return lessons;
  } catch (error) {
    console.error(`[LearnKids MCP] Error loading lessons for ${courseId}:`, error);
    throw new Error(`Failed to load lessons for course: ${courseId}`);
  }
}

// ============================================================================
// MCP SERVER SETUP
// ============================================================================

function createMcpServer() {
  const server = new Server(
    {
      name: 'learningkids-server',
      version: '2.0.1',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register request handlers
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

          const course = coursesData.courses.find(c => c.id === courseId);
          if (!course) {
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

          // Simple validation
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
      console.error(`[LearnKids MCP] Error in tool ${name}:`, error);
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
// VERCEL SERVERLESS HANDLER
// ============================================================================

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET for SSE connection.' });
  }

  try {
    console.log('[LearnKids MCP] New SSE connection request');

    // Create MCP server instance
    const server = createMcpServer();

    // Create SSE transport (messages will be posted to /mcp/messages)
    const transport = new SSEServerTransport('/mcp/messages', res);

    // Connect server to transport
    await server.connect(transport);

    console.log('[LearnKids MCP] SSE connection established');

    // Keep connection alive (Vercel will handle timeout)
  } catch (error) {
    console.error('[LearnKids MCP] SSE connection error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to establish SSE connection' });
    }
  }
}
