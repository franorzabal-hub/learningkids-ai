/**
 * LearnKids AI - MCP Server for Cloud Run / Railway
 *
 * Persistent HTTP server with SSE support for ChatGPT Apps SDK
 * Based on OpenAI's official pizzaz_server_node example
 *
 * Compatible with: Google Cloud Run
 * @version 2.2.0
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
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;
const SSE_PATH = '/mcp';
const POST_PATH = '/mcp/messages';
const WEB_COMPONENT_DIR = path.join(__dirname, 'web-component');

// Widget configuration for OpenAI Apps SDK
const WIDGET_URI = 'ui://widget/learningkids.html';
const WIDGET_TITLE = 'LearnKids AI - Interactive Learning Platform';
const WIDGET_DOMAIN = 'learningkids';

// Widget CSP configuration - domains the widget can connect to
const WIDGET_CSP = {
  connect_domains: ['https://learningkids-ai-470541916594.us-central1.run.app'],
  resource_domains: ['https://unpkg.com', 'https://*.oaistatic.com'],
};

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Session management for SSE connections
const sessions = new Map();

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

// Widget HTML cache
let widgetHtml = null;

async function loadWidgetHtml() {
  if (widgetHtml) return widgetHtml;

  try {
    const indexPath = path.join(WEB_COMPONENT_DIR, 'index.html');
    const cssPath = path.join(WEB_COMPONENT_DIR, 'styles.css');

    const [htmlContent, cssContent] = await Promise.all([
      fs.readFile(indexPath, 'utf-8'),
      fs.readFile(cssPath, 'utf-8').catch(() => ''),
    ]);

    // Inline the CSS into the HTML for widget self-containment
    widgetHtml = htmlContent.replace(
      '<link rel="stylesheet" href="styles.css">',
      `<style>${cssContent}</style>`
    );

    console.log('[LearnKids] Widget HTML loaded and CSS inlined');
    return widgetHtml;
  } catch (error) {
    console.error('[LearnKids] Error loading widget HTML:', error);
    throw new Error('Failed to load widget HTML');
  }
}

// ============================================================================
// STATIC FILE SERVING
// ============================================================================

async function serveStaticFile(res, filePath) {
  try {
    // Security: prevent path traversal
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(WEB_COMPONENT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      console.error('[LearnKids] Error serving static file:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
}

// ============================================================================
// MCP SERVER FACTORY
// ============================================================================

function createMcpServer() {
  const server = new Server(
    {
      name: 'learningkids-server',
      version: '2.3.1',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // ============================================================================
  // RESOURCES - Widget Registration (OpenAI Apps SDK best practice)
  // ============================================================================

  // List available resources (the widget)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: WIDGET_URI,
          name: 'learningkids-widget',
          title: WIDGET_TITLE,
          description: 'Interactive learning platform widget for kids education with courses, lessons, and exercises',
          mimeType: 'text/html+skybridge',
          _meta: {
            'openai/widgetDomain': WIDGET_DOMAIN,
            'openai/widgetCSP': WIDGET_CSP,
            'openai/widgetPrefersBorder': true,
            'openai/widgetDescription': 'Shows an interactive learning platform with courses, lessons, and coding exercises for kids.',
          },
        },
      ],
    };
  });

  // Read resource content (returns the widget HTML)
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === WIDGET_URI) {
      const html = await loadWidgetHtml();

      return {
        contents: [
          {
            uri: WIDGET_URI,
            mimeType: 'text/html+skybridge',
            text: html,
            _meta: {
              'openai/widgetDomain': WIDGET_DOMAIN,
              'openai/widgetCSP': WIDGET_CSP,
              'openai/widgetPrefersBorder': true,
              'openai/widgetDescription': 'Shows an interactive learning platform with courses, lessons, and coding exercises for kids.',
            },
          },
        ],
      };
    }

    return {
      contents: [],
      isError: true,
    };
  });

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get-courses',
          title: 'Browse Learning Courses',
          description: 'Shows all available educational courses for kids. Safe, read-only operation.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: true,
          },
          securitySchemes: [{ type: 'noauth' }],
          _meta: {
            'openai/visibility': 'public',
            'openai/outputTemplate': WIDGET_URI,
            'openai/widgetAccessible': true,
            'openai/resultCanProduceWidget': true,
            'openai/toolInvocation/invoking': 'Loading courses...',
            'openai/toolInvocation/invoked': 'Courses loaded',
          },
        },
        {
          name: 'view-course-details',
          title: 'View Course Details',
          description: 'Shows lesson plan and learning objectives for a specific course. Safe, read-only operation that helps students plan their learning journey.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'Course ID from the course list (e.g., "python-kids")',
                pattern: '^[a-z0-9-]+$',
              },
            },
            required: ['courseId'],
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: true,
          },
          securitySchemes: [{ type: 'noauth' }],
          _meta: {
            'openai/visibility': 'public',
            'openai/outputTemplate': WIDGET_URI,
            'openai/widgetAccessible': true,
            'openai/resultCanProduceWidget': true,
            'openai/toolInvocation/invoking': 'Loading course details...',
            'openai/toolInvocation/invoked': 'Course details loaded',
          },
        },
        {
          name: 'start-lesson',
          title: 'Start Learning Lesson',
          description: 'Loads educational content for a specific lesson. Safe, read-only operation that provides learning materials to students.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'Course ID (e.g., "python-kids")',
                pattern: '^[a-z0-9-]+$',
              },
              lessonNumber: {
                type: 'number',
                description: 'Lesson number (1-5)',
                minimum: 1,
                maximum: 10,
              },
            },
            required: ['courseId', 'lessonNumber'],
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: true,
          },
          securitySchemes: [{ type: 'noauth' }],
          _meta: {
            'openai/visibility': 'public',
            'openai/outputTemplate': WIDGET_URI,
            'openai/widgetAccessible': true,
            'openai/resultCanProduceWidget': true,
            'openai/toolInvocation/invoking': 'Loading lesson...',
            'openai/toolInvocation/invoked': 'Lesson ready',
          },
        },
        {
          name: 'check-student-work',
          title: 'Validate Learning Exercise',
          description: 'Provides feedback on student code exercises. Educational tool for learning validation only. Does not execute code.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'Course ID',
                pattern: '^[a-z0-9-]+$',
              },
              lessonNumber: {
                type: 'number',
                description: 'Lesson number',
                minimum: 1,
                maximum: 10,
              },
              studentCode: {
                type: 'string',
                description: 'Student\'s code submission',
                maxLength: 5000,
              },
            },
            required: ['courseId', 'lessonNumber', 'studentCode'],
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: true, // Validates but doesn't persist or execute code
          },
          securitySchemes: [{ type: 'noauth' }],
          _meta: {
            'openai/visibility': 'public',
            'openai/outputTemplate': WIDGET_URI,
            'openai/widgetAccessible': true,
            'openai/resultCanProduceWidget': true,
            'openai/toolInvocation/invoking': 'Checking your work...',
            'openai/toolInvocation/invoked': 'Feedback ready',
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
        case 'get-courses': {
          await loadCourses();

          const coursesList = coursesData.courses.map(course => ({
            id: course.id,
            title: course.title,
            emoji: course.emoji,
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
            _meta: {
              'openai/outputTemplate': WIDGET_URI,
              'openai/widgetAccessible': true,
            },
          };
        }

        case 'view-course-details': {
          const { courseId } = args;
          await loadCourses();

          if (!isValidCourseId(courseId)) {
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
                lessons: course.lessons || [],
              },
            },
            _meta: {
              'openai/outputTemplate': WIDGET_URI,
              'openai/widgetAccessible': true,
            },
          };
        }

        case 'start-lesson': {
          const { courseId, lessonNumber } = args;
          await loadCourses();

          if (!isValidCourseId(courseId)) {
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

          const lessonId = `lesson-${lessonNumber}`;
          const lessonsData = await loadLessons(courseId);
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
                number: lessonNumber,
                title: lesson.title,
                objective: lesson.objective,
                duration: lesson.duration,
                content: lesson.content,
                examples: lesson.examples,
                exercise: lesson.exercise,
              },
            },
            _meta: {
              'openai/outputTemplate': WIDGET_URI,
              'openai/widgetAccessible': true,
            },
          };
        }

        case 'check-student-work': {
          const { courseId, lessonNumber, studentCode } = args;
          await loadCourses();

          if (!isValidCourseId(courseId)) {
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

          const lessonId = `lesson-${lessonNumber}`;
          const lessonsData = await loadLessons(courseId);
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

          // Simple validation logic
          const hasCode = studentCode && studentCode.trim().length > 0;
          const isCorrect = hasCode && studentCode.trim().length > 5;

          const feedback = isCorrect
            ? '✨ Great job! Your code looks good.'
            : hasCode
              ? 'Good start! Try adding more to your code.'
              : 'Please write some code to check.';

          return {
            content: [
              {
                type: 'text',
                text: feedback,
              },
            ],
            structuredContent: {
              validation: {
                correct: isCorrect,
                hasAttempt: hasCode,
                codeLength: studentCode?.length || 0,
              },
            },
            _meta: {
              'openai/outputTemplate': WIDGET_URI,
              'openai/widgetAccessible': true,
            },
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Tool "${name}" not recognized.`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      console.error(`[LearnKids] Error in tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// ============================================================================
// HTTP SERVER
// ============================================================================

async function handleSseRequest(req, res, url) {
  console.log('[LearnKids] New SSE connection request');

  const server = createMcpServer();
  const transport = new SSEServerTransport(POST_PATH, res);

  try {
    await server.connect(transport);
    console.log('[LearnKids] SSE connection established');

    // Note: ChatGPT generates its own sessionId and includes it in POST requests
    // We can't know it ahead of time, so we store this session globally and match later
    // Store with a temporary key that we'll update when first POST arrives
    const tempKey = `temp-${Date.now()}`;
    sessions.set(tempKey, { server, transport, createdAt: Date.now(), temp: true });

    console.log(`[LearnKids] Stored session with temp key: ${tempKey}`);

    // Clean up session when connection closes
    req.on('close', () => {
      console.log(`[LearnKids] SSE connection closed for ${tempKey}`);
      sessions.delete(tempKey);
    });

    // Also clean up after 1 hour of inactivity
    setTimeout(() => {
      if (sessions.has(tempKey)) {
        console.log(`[LearnKids] Cleaning up inactive session: ${tempKey}`);
        sessions.delete(tempKey);
      }
    }, 3600000); // 1 hour
  } catch (error) {
    console.error('[LearnKids] SSE connection error:', error);
    if (!res.headersSent) {
      res.writeHead(500).end('Failed to establish SSE connection');
    }
  }
}

async function handlePostMessage(req, res, url) {
  const sessionId = url.searchParams.get('sessionId');
  console.log(`[LearnKids] POST message - sessionId: ${sessionId}`);

  // Read request body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString();

  console.log('[LearnKids] Message body:', body);

  try {
    // Parse the JSON-RPC message
    const message = JSON.parse(body);

    // Try to find session by exact sessionId first
    let session = sessions.get(sessionId);

    if (!session) {
      // Session not found - look for any temp session and promote it
      console.log(`[LearnKids] Session ${sessionId} not found, searching for temp session...`);

      for (const [key, value] of sessions.entries()) {
        if (value.temp) {
          console.log(`[LearnKids] Promoting temp session ${key} to ${sessionId}`);
          // Promote this temp session to the real sessionId
          sessions.delete(key);
          value.temp = false;
          sessions.set(sessionId, value);
          session = value;
          break;
        }
      }
    }

    if (!session) {
      console.error(`[LearnKids] No session available for: ${sessionId}`);
      console.log('[LearnKids] Active sessions:', Array.from(sessions.keys()));

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: message.id
      }));
      return;
    }

    // Handle the message through the transport
    await session.transport.handleMessage(message);

    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({ received: true }));
  } catch (error) {
    console.error('[LearnKids] Error handling message:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal error: ' + error.message },
      id: null
    }));
  }
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
    await handleSseRequest(req, res, url);
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
      version: '2.3.1',
      server: process.env.K_SERVICE ? 'Cloud Run' : 'Local',
      transport: 'SSE',
      mcp: 'enabled',
      resources: 'enabled',
      widget: WIDGET_URI,
    }));
    return;
  }

  // API info endpoint
  if (req.method === 'GET' && url.pathname === '/api') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'LearnKids AI',
      version: '2.3.1',
      description: 'Interactive learning platform for kids',
      mcp: {
        endpoint: '/mcp',
        transport: 'SSE',
        tools: ['get-courses', 'view-course-details', 'start-lesson', 'check-student-work'],
        resources: [WIDGET_URI],
      },
      openai: {
        widgetDomain: WIDGET_DOMAIN,
        widgetAccessible: true,
        outputTemplate: WIDGET_URI,
      },
      endpoints: {
        health: '/health',
        mcp: '/mcp',
        mcpMessages: '/mcp/messages',
        widget: '/',
      },
      documentation: 'https://github.com/franorzabal-hub/learningkids-ai',
    }));
    return;
  }

  // Serve web component - root serves index.html
  if (req.method === 'GET' && url.pathname === '/') {
    await serveStaticFile(res, path.join(WEB_COMPONENT_DIR, 'index.html'));
    return;
  }

  // Serve styles.css
  if (req.method === 'GET' && url.pathname === '/styles.css') {
    await serveStaticFile(res, path.join(WEB_COMPONENT_DIR, 'styles.css'));
    return;
  }

  // Serve assets (images, etc.)
  if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
    const assetPath = path.join(WEB_COMPONENT_DIR, url.pathname);
    await serveStaticFile(res, assetPath);
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
  console.log(`  Widget: http://localhost:${PORT}/`);
  console.log(`  SSE stream: GET http://localhost:${PORT}${SSE_PATH}`);
  console.log(`  Message endpoint: POST http://localhost:${PORT}${POST_PATH}`);
  console.log(`  Health check: GET http://localhost:${PORT}/health`);
  console.log(`  API info: GET http://localhost:${PORT}/api`);
});
