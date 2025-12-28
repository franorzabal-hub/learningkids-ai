/**
 * LearnKids AI - MCP Server for Cloud Run / Railway
 *
 * Persistent HTTP server with SSE support for ChatGPT Apps SDK
 * Based on OpenAI's official pizzaz_server_node example
 *
 * v2.4.0: Migrated widget to Vite build system for ChatGPT sandbox compatibility
 *         (Babel standalone requires unsafe-eval which is blocked by CSP)
 *
 * Compatible with: Google Cloud Run
 * @version 2.6.0
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
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

import { APP_VERSION } from './lib/config.js';
import { createDataLoader } from './lib/data.js';
import { buildStudentValidation } from './lib/lessonValidation.js';
import { createSessionStore } from './lib/sessionStore.js';
import { isValidCourseId } from './lib/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;
const SSE_PATH = '/mcp';
const POST_PATH = '/mcp/messages';
const MAX_BODY_BYTES = 1024 * 1024;
const WEB_COMPONENT_DIR = path.join(__dirname, 'web-component', 'dist');

// Debug mode: set DEBUG=true to enable verbose logging
// Claude (Opus 4.5) - 2025-12-27
const DEBUG = process.env.DEBUG === 'true';

// Widget configuration for OpenAI Apps SDK
// Following official pattern from: https://github.com/openai/openai-apps-sdk-examples
const WIDGET_URI = 'ui://widget/learningkids.html';
const WIDGET_TITLE = 'LearnKids AI - Interactive Learning Platform';

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
const sessionStore = createSessionStore();

// ============================================================================
// DATA LOADING
// Refactored to use createDataLoader from lib/data.js - Claude (Opus 4.5) - 2025-12-27
// ============================================================================

const DATA_DIR = path.join(__dirname, 'mcp-server', 'data');
const dataLoader = createDataLoader(DATA_DIR);

// Wrapper functions to maintain existing API and add logging
async function loadCourses() {
  const wasCached = !!dataLoader.getCoursesCached();
  const coursesData = await dataLoader.loadCourses();
  if (!wasCached) {
    console.log('[LearnKids] Loaded', coursesData.courses.length, 'courses');
  }
  return coursesData;
}

async function loadLessons(courseId) {
  const lessonsData = await dataLoader.loadLessons(courseId);
  // Note: dataLoader already handles caching, log is kept for debugging
  return lessonsData;
}

function getBaseUrl(url, req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || url.protocol.replace(':', '');
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers.host || url.host;

  return `${protocol}://${host}`;
}

// Widget HTML cache
let widgetHtml = null;

async function loadWidgetHtml() {
  if (widgetHtml) return widgetHtml;

  try {
    const cssPath = path.join(WEB_COMPONENT_DIR, 'widget.css');
    const jsPath = path.join(WEB_COMPONENT_DIR, 'widget.js');

    // Added logging for missing files - Claude (Opus 4.5) - 2025-12-27
    const cssContent = await fs.readFile(cssPath, 'utf-8').catch((err) => {
      console.warn('[LearnKids] CSS file not found, continuing without styles:', err.message);
      return '';
    });
    let jsContent = await fs.readFile(jsPath, 'utf-8');

    // CRITICAL: Escape patterns that would break the inline script
    // 1. Replace </script with a safe unicode escape sequence
    jsContent = jsContent.split('</script').join('<\\/script');
    // 2. Replace <!-- to prevent HTML comment issues
    jsContent = jsContent.split('<!--').join('<\\!--');

    // Inline everything - ChatGPT sandbox blocks external script loading
    widgetHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${cssContent}
</style>
</head>
<body>
<div id="root"></div>
<script>
${jsContent}
</script>
</body>
</html>`;

    console.log('[LearnKids] Widget HTML loaded with inline JS, size:', widgetHtml.length);
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
  if (DEBUG) console.log('[DEBUG] serveStaticFile called with:', filePath);
  try {
    // Security: prevent path traversal
    const normalizedPath = path.normalize(filePath);
    if (DEBUG) {
      console.log('[DEBUG] normalizedPath:', normalizedPath);
      console.log('[DEBUG] startsWith check:', normalizedPath.startsWith(WEB_COMPONENT_DIR));
    }
    if (!normalizedPath.startsWith(WEB_COMPONENT_DIR)) {
      if (DEBUG) console.log('[DEBUG] Path traversal blocked');
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    const data = await fs.readFile(filePath);
    if (DEBUG) console.log('[DEBUG] File read success, size:', data.length);
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
      version: APP_VERSION,
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
  // Following official pattern from kitchen_sink_server_node
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: WIDGET_URI,
          name: 'LearnKids Widget',
          description: 'Interactive learning platform widget for kids education',
          mimeType: 'text/html+skybridge',
          _meta: {
            'openai/outputTemplate': WIDGET_URI,
          },
        },
      ],
    };
  });

  // Read resource content (returns the widget HTML)
  // Following official pattern from kitchen_sink_server_node
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
              'openai/outputTemplate': WIDGET_URI,
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
            'openai/outputTemplate': WIDGET_URI,
            'openai/toolInvocation/invoking': 'Loading courses...',
            'openai/toolInvocation/invoked': 'Courses loaded',
            'openai/widgetAccessible': true,
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
            'openai/outputTemplate': WIDGET_URI,
            'openai/toolInvocation/invoking': 'Loading course details...',
            'openai/toolInvocation/invoked': 'Course details loaded',
            'openai/widgetAccessible': true,
          },
        },
        {
          name: 'get-course-details',
          title: 'View Course Details',
          description: 'Alias for view-course-details. Returns lesson plan and learning objectives for a specific course.',
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
            'openai/outputTemplate': WIDGET_URI,
            'openai/toolInvocation/invoking': 'Loading course details...',
            'openai/toolInvocation/invoked': 'Course details loaded',
            'openai/widgetAccessible': true,
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
            'openai/outputTemplate': WIDGET_URI,
            'openai/toolInvocation/invoking': 'Loading lesson...',
            'openai/toolInvocation/invoked': 'Lesson ready',
            'openai/widgetAccessible': true,
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
            'openai/outputTemplate': WIDGET_URI,
            'openai/toolInvocation/invoking': 'Checking your work...',
            'openai/toolInvocation/invoked': 'Feedback ready',
            'openai/widgetAccessible': true,
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
          const coursesData = await loadCourses();

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
            _meta: {
              'openai/outputTemplate': WIDGET_URI,
              'openai/widgetAccessible': true,
            },
          };
        }

        case 'view-course-details':
        case 'get-course-details': {
          const { courseId } = args;
          const coursesData = await loadCourses();

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
            _meta: {
              'openai/outputTemplate': WIDGET_URI,
              'openai/widgetAccessible': true,
            },
          };
        }

        case 'start-lesson': {
          const { courseId, lessonNumber } = args;
          const coursesData = await loadCourses();

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
            _meta: {
              'openai/outputTemplate': WIDGET_URI,
              'openai/widgetAccessible': true,
            },
          };
        }

        case 'check-student-work': {
          const { courseId, lessonNumber, studentCode } = args;
          const coursesData = await loadCourses();

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
    const tempKey = `temp-${randomUUID()}`;
    const session = sessionStore.addSession(tempKey, {
      server,
      transport,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      temp: true,
    });

    console.log(`[LearnKids] Stored session with temp key: ${tempKey}`);

    // Clean up session when connection closes
    req.on('close', () => {
      const key = session.key;
      if (sessionStore.removeSession(session)) {
        console.log(`[LearnKids] SSE connection closed for ${key}`);
      }
    });
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
  let bodySize = 0;
  for await (const chunk of req) {
    bodySize += chunk.length;
    if (bodySize > MAX_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32602, message: 'Payload too large' },
        id: null
      }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString();

  console.log('[LearnKids] Message body size:', body.length);

  try {
    // Parse the JSON-RPC message
    let message;
    try {
      message = JSON.parse(body);
    } catch (parseError) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' },
        id: null
      }));
      return;
    }

    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32602, message: 'Missing sessionId' },
        id: message.id
      }));
      return;
    }

    // Try to find session by exact sessionId first
    const { session, promoted, previousKey } = sessionStore.promoteSession(sessionId);

    if (promoted) {
      console.log(`[LearnKids] Promoting temp session ${previousKey} to ${sessionId}`);
    }

    if (!session) {
      console.error(`[LearnKids] No session available for: ${sessionId}`);
      console.log('[LearnKids] Active sessions:', sessionStore.listKeys());

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: message.id
      }));
      return;
    }

    sessionStore.touchSession(session);

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

  // Debug logging for static file requests
  if (DEBUG && (url.pathname.includes('widget') || url.pathname === '/')) {
    console.log(`[DEBUG] ${req.method} ${url.pathname}`);
  }

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
      version: APP_VERSION,
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
    const baseUrl = getBaseUrl(url, req);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'LearnKids AI',
      version: APP_VERSION,
      description: 'Interactive learning platform for kids',
      mcp: {
        endpoint: '/mcp',
        transport: 'SSE',
        tools: ['get-courses', 'view-course-details', 'start-lesson', 'check-student-work'],
        resources: [WIDGET_URI],
      },
      openai: {
        widgetDomain: baseUrl,
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

  // Serve widget.css (Vite build output)
  if (req.method === 'GET' && url.pathname === '/widget.css') {
    await serveStaticFile(res, path.join(WEB_COMPONENT_DIR, 'widget.css'));
    return;
  }

  // Serve widget.js (Vite build output)
  if (req.method === 'GET' && url.pathname === '/widget.js') {
    if (DEBUG) console.log('[DEBUG] Matched /widget.js route');
    const filePath = path.join(WEB_COMPONENT_DIR, 'widget.js');
    if (DEBUG) console.log('[DEBUG] File path:', filePath);
    await serveStaticFile(res, filePath);
    return;
  }

  // Serve assets (images, etc.)
  if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
    const assetPath = path.join(WEB_COMPONENT_DIR, url.pathname.replace(/^\/+/, ''));
    await serveStaticFile(res, assetPath);
    return;
  }

  res.writeHead(404).end('Not Found');
});

httpServer.on('clientError', (err, socket) => {
  console.error('[LearnKids] HTTP client error:', err);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

httpServer.listen(PORT, async () => {
  console.log(`🎓 LearnKids AI MCP server listening on port ${PORT}`);
  console.log(`  Widget: http://localhost:${PORT}/`);
  console.log(`  SSE stream: GET http://localhost:${PORT}${SSE_PATH}`);
  console.log(`  Message endpoint: POST http://localhost:${PORT}${POST_PATH}`);
  console.log(`  Health check: GET http://localhost:${PORT}/health`);
  console.log(`  API info: GET http://localhost:${PORT}/api`);

  // Start periodic session cleanup (every 15 minutes, remove sessions inactive for 1 hour)
  // Claude (Opus 4.5) - 2025-12-27
  sessionStore.startPeriodicCleanup();
  console.log(`  Session cleanup: enabled (every 15 min)`);

  // Debug: List widget files
  if (DEBUG) {
    console.log(`  WEB_COMPONENT_DIR: ${WEB_COMPONENT_DIR}`);
    try {
      const files = await fs.readdir(WEB_COMPONENT_DIR);
      console.log(`  Widget files:`, files);
    } catch (err) {
      console.error(`  ERROR listing widget dir:`, err.message);
    }
  }
});
