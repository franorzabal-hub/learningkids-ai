# Architecture Documentation

## Overview

LearnKids AI is a ChatGPT-native learning platform built using OpenAI's Apps SDK. This document describes the system architecture, data flows, and key technical decisions.

**Version**: 2.6.0
**Hosting**: Google Cloud Run (unified server)

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────┐
│                    CHATGPT HOST                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │         User Interface (iframe)                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  Widget (Vite build)                        │  │  │
│  │  │  - Course Catalog View                      │  │  │
│  │  │  - Lesson Viewer                            │  │  │
│  │  │  - Exercise Interface                       │  │  │
│  │  │  - Progress Display                         │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                     ↕ window.openai API           │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  ChatGPT Integration Layer                  │  │  │
│  │  │  - Tool invocation                          │  │  │
│  │  │  - Widget state management                  │  │  │
│  │  │  - Message handling                         │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↕ HTTPS
┌─────────────────────────────────────────────────────────┐
│                    MCP SERVER                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Tool Handler Layer                               │  │
│  │  ├─ get-courses()                                  │  │
│  │  ├─ view-course-details(courseId)                  │  │
│  │  ├─ start-lesson(courseId, lessonNumber)            │  │
│  │  └─ check-student-work(courseId, lessonNumber, studentCode) │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Content Management Layer                         │  │
│  │  ├─ Course loader                                 │  │
│  │  ├─ Lesson parser                                 │  │
│  │  └─ Answer validator                              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                   DATA STORAGE                          │
│  ┌───────────────────┐  ┌───────────────────────────┐  │
│  │  Static Content   │  │  User State               │  │
│  │  (JSON files)     │  │  (ChatGPT Widget State)   │  │
│  │                   │  │                           │  │
│  │  - courses.json   │  │  - currentLessonId        │  │
│  │  - lessons/       │  │  - completedLessons[]     │  │
│  │    *.json         │  │  - earnedStars            │  │
│  └───────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Web Component (Frontend)

**Technology**: React 19 + Vite (built for ChatGPT sandbox)
**Purpose**: Render UI and handle user interactions
**Location**: `widget-src/` (source), `web-component/dist/` (build output)

#### Key Responsibilities:
- Display course catalog in Inline mode
- Render lessons in Fullscreen mode
- Handle code editor interactions
- Communicate with ChatGPT via `window.openai` API
- Manage local UI state
- Persist progress via widget state

#### Display Modes:

| Mode | Use Case | Characteristics |
|------|----------|-----------------|
| **Inline** | Course catalog, quick navigation | Compact cards, max 2 actions |
| **Fullscreen** | Lesson viewer, code exercises | Full screen with ChatGPT composer overlay |
| **PiP** | (Future: video lessons) | Floating window while chatting |

#### State Management:

```javascript
// Local React state (ephemeral)
const [view, setView] = useState('catalog'); // 'catalog' | 'lesson'
const [courses, setCourses] = useState([]);
const [currentLesson, setCurrentLesson] = useState(null);

// Persisted state (survives page refresh)
window.openai.setWidgetState({
  progress: {
    completedLessons: ['lesson-1', 'lesson-2'],
    currentCourse: 'python-kids',
    earnedStars: 15
  }
});
```

### 2. MCP Server (Backend)

**Technology**: Node.js 20+, MCP SDK
**Purpose**: Expose app capabilities to ChatGPT, serve static files
**Location**: `server.js` (root)

#### Tool Definitions:

##### `get-courses()`
```json
{
  "name": "get-courses",
  "description": "Returns list of all available courses",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

**Returns**:
```json
{
  "courses": [
    {
      "id": "python-kids",
      "title": "Python for Kids",
      "emoji": "🐍",
      "description": "Learn programming through play",
      "totalLessons": 5,
      "duration": "~25 minutes",
      "ageRange": "8-12"
    }
  ]
}
```

##### `start-lesson(courseId, lessonNumber)`
```json
{
  "name": "start-lesson",
  "description": "Retrieves a specific lesson with content and exercises",
  "inputSchema": {
    "type": "object",
    "properties": {
      "courseId": { "type": "string" },
      "lessonNumber": { "type": "number" }
    },
    "required": ["courseId", "lessonNumber"]
  }
}
```

**Returns**:
```json
{
  "lesson": {
    "id": "lesson-1",
    "courseId": "python-kids",
    "number": 1,
    "title": "Magic Variables",
    "content": { "...": "..." },
    "exercise": { "...": "..." }
  }
}
```

##### `check-student-work(courseId, lessonNumber, studentCode)`
```json
{
  "name": "check-student-work",
  "description": "Validates student's code answer",
  "inputSchema": {
    "type": "object",
    "properties": {
      "courseId": { "type": "string" },
      "lessonNumber": { "type": "number" },
      "studentCode": { "type": "string" }
    },
    "required": ["courseId", "lessonNumber", "studentCode"]
  }
}
```

**Returns**:
```json
{
  "validation": {
    "correct": true,
    "message": "Excellent work! 🌟",
    "hint": null,
    "nextLesson": "lesson-2"
  }
}
```

### 3. Data Storage

#### Static Content (JSON Files)

**Location**: `mcp-server/data/`

**courses.json** - Course catalog:
```json
{
  "courses": [
    {
      "id": "python-kids",
      "title": "Python for Kids",
      "emoji": "🐍",
      "color": "#8B5CF6",
      "description": "Learn programming through play",
      "ageRange": "8-12 years",
      "difficulty": "beginner",
      "totalLessons": 5,
      "estimatedDuration": "25 minutes",
      "lessonIds": ["lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5"]
    }
  ]
}
```

**lessons/python-kids.json** - All lessons for a course:
```json
{
  "courseId": "python-kids",
  "lessons": [
    {
      "id": "lesson-1",
      "order": 1,
      "title": "Magic Variables",
      "content": { },
      "exercise": { },
      "reward": { }
    }
  ]
}
```

#### User State (Widget State)

**Storage**: ChatGPT Widget State (~4KB limit)
**Scope**: Per-user, per-conversation
**Persistence**: As long as widget is active

```javascript
// Structure
{
  "version": "1.0",
  "currentCourse": "python-kids",
  "currentLesson": "lesson-3",
  "progress": {
    "python-kids": {
      "completedLessons": ["lesson-1", "lesson-2"],
      "earnedStars": 2,
      "lastAccessed": "2025-12-26T10:30:00Z"
    }
  }
}
```

## Data Flow

### Flow 1: Loading Course Catalog

```
User opens app
    ↓
Web Component mounts
    ↓
useEffect() calls window.openai.callTool({name: 'get-courses'})
    ↓
ChatGPT → MCP Server → get-courses()
    ↓
MCP reads courses.json
    ↓
Returns course list
    ↓
Web Component renders course cards (Inline mode)
```

### Flow 2: Starting a Lesson

```
User clicks "Start Learning" on Python course
    ↓
Web Component calls window.openai.callTool({
  name: 'start-lesson',
  parameters: { courseId: 'python-kids', lessonNumber: 1 }
})
    ↓
ChatGPT → MCP Server → start-lesson()
    ↓
MCP reads lessons/python-kids.json
    ↓
Finds lesson-1, returns full content
    ↓
Web Component receives lesson data
    ↓
Switches to Fullscreen mode
    ↓
Renders lesson (character, explanation, exercise)
```

### Flow 3: Submitting an Answer

```
User writes code in editor
    ↓
Clicks "Check Answer"
    ↓
Web Component reads textarea value
    ↓
Calls window.openai.callTool({
  name: 'check-student-work',
  parameters: { courseId: 'python-kids', lessonNumber: 1, studentCode: userCode }
})
    ↓
MCP Server → check-student-work()
    ↓
Validates answer against lesson's validation rules
    ↓
Returns validation payload { correct: true, message: "Great!" }
    ↓
Web Component shows success message
    ↓
Updates widget state:
  window.openai.setWidgetState({
    progress: {
      completedLessons: [...prev, 'lesson-1'],
      earnedStars: prev + 1
    }
  })
    ↓
Shows "Next Lesson" button
```

### Flow 4: AI Tutor Interaction

```
User types in ChatGPT: "I don't understand variables"
    ↓
ChatGPT has context of:
  - Current lesson (from widget state)
  - Lesson content (from last tool call)
  - User's progress
    ↓
ChatGPT generates personalized explanation:
  "I see you're on Lesson 1 about variables!
   Think of a variable like a labeled box..."
    ↓
User can continue chatting while app stays visible (Fullscreen)
```

## Technical Decisions

### Why No Database?

**Decision**: Use static JSON files instead of PostgreSQL/MongoDB

**Rationale**:
- ✅ MVP doesn't need dynamic content updates
- ✅ Simpler deployment (no DB hosting/migrations)
- ✅ Faster reads (file system cache)
- ✅ Version control content alongside code
- ✅ Easy to hand-edit content

**Trade-offs**:
- ❌ Can't add courses without redeploying
- ❌ No analytics on user behavior across users
- ✅ For MVP: acceptable, can migrate later

### Why ChatGPT Widget State for User Progress?

**Decision**: Store user progress in ChatGPT's widget state instead of a backend DB

**Rationale**:
- ✅ No user authentication needed
- ✅ ChatGPT handles identity management
- ✅ Privacy-first (no PII stored by us)
- ✅ Simpler backend (stateless)
- ✅ 4KB is enough for progress tracking

**Trade-offs**:
- ❌ Progress lost if user creates new conversation
- ❌ Can't track users across devices
- ✅ For MVP: acceptable, kids likely use same conversation

### Why Vite Build for the Widget?

**Decision**: Build the widget with Vite and ship `web-component/dist`.

**Rationale**:
- ✅ Avoids runtime Babel/unsafe-eval in the ChatGPT sandbox
- ✅ Bundles JS/CSS into predictable assets
- ✅ Fast local dev server and hot reload

**Trade-offs**:
- ❌ Requires a build step before deploy
- ❌ Slightly larger repo footprint (built assets)

### Why Node.js for MCP Server?

**Decision**: Use Node.js instead of Python

**Rationale**:
- JavaScript everywhere (same language as frontend)
- Faster JSON parsing (V8 engine)
- Better async I/O for file reads
- Easy deployment to Cloud Run

**Note**: Could easily be rewritten in Python if needed

## Security Considerations

### Input Validation

```javascript
// Always validate lesson inputs
function startLesson(courseId, lessonNumber) {
  if (courseId.includes('..')) {
    throw new Error('Invalid ID');
  }
  if (!Number.isInteger(lessonNumber) || lessonNumber < 1) {
    throw new Error('Invalid lesson number');
  }

  // Whitelist validation
  const validCourses = ['python-kids', 'scratch-kids'];
  if (!validCourses.includes(courseId)) {
    throw new Error('Course not found');
  }
}
```

### Code Execution Safety

**Important**: We NEVER execute user code on the server for security reasons.

```javascript
// ✅ Safe: Pattern matching validation
function validateAnswer(userCode, expectedPattern) {
  const regex = new RegExp(expectedPattern);
  return regex.test(userCode);
}
```

### Content Security Policy

```html
<!-- Example strict CSP for widget hosting -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline';">
```

## Performance Optimizations

### Lazy Loading Lessons

```javascript
// Don't load all lessons upfront
// Load on-demand when user clicks
async function loadLesson(courseId, lessonNumber) {
  const result = await window.openai.callTool({
    name: 'start-lesson',
    parameters: { courseId, lessonNumber }
  });
  return result.structuredContent?.lesson;
}
```

### Image Optimization

```
- Use SVG for icons/simple graphics (scalable, small)
- Use WebP for photos (better compression)
- Lazy load images below the fold
- Max 100KB per image
```

### State Minimization

```javascript
// Only store essential data in widget state
// Bad: storing entire lesson content
setWidgetState({
  currentLesson: { /* 50KB of data */ }
}); // ❌ Too large!

// Good: store IDs only
setWidgetState({
  currentLessonId: 'lesson-3',
  completedLessons: ['lesson-1', 'lesson-2']
}); // ✅ Minimal
```

## Error Handling

### Network Errors

```javascript
async function callTool(name, params) {
  try {
    return await window.openai.callTool({ name, parameters: params });
  } catch (error) {
    console.error('Tool call failed:', error);
    showMessage({
      type: 'error',
      emoji: '😅',
      text: 'Oops! Something went wrong. Try again in a moment.'
    });
  }
}
```

### Missing Content

```javascript
function startLesson(courseId, lessonNumber) {
  const course = courses.find(c => c.id === courseId);
  if (!course) {
    return {
      error: true,
      message: "We can't find that course right now. Try another one!",
      emoji: "🔍"
    };
  }
}
```

## Monitoring & Debugging

### Logging Strategy

```javascript
// Structured logging for debugging
console.log('[LearnKids]', {
  event: 'lesson_completed',
  lessonId: 'lesson-1',
  timestamp: new Date().toISOString(),
  userProgress: progress
});
```

## Future Architecture Considerations

### When to Add a Database

Consider adding PostgreSQL when:
- Need to track users across devices
- Need admin panel to update content
- Need analytics/reporting
- Need user accounts with profiles

### When to Add Authentication

Consider adding auth when:
- Need parent dashboards
- Need to integrate with schools
- Need to issue official certificates
- Need subscription/payment system

---

**Last Updated**: 2025-12-26
