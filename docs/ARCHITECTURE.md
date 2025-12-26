# 🏗️ Architecture Documentation

## Overview

LearnKids AI is a ChatGPT-native learning platform built using OpenAI's Apps SDK. This document describes the system architecture, data flows, and key technical decisions.

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────┐
│                    CHATGPT HOST                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │         User Interface (iframe)                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  Web Component (index.html)                 │  │  │
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
│  │  ├─ getCourses()                                  │  │
│  │  ├─ getCourse(id)                                 │  │
│  │  ├─ getLesson(courseId, lessonId)                │  │
│  │  ├─ checkAnswer(lessonId, answer)                │  │
│  │  ├─ saveProgress(lessonId)                       │  │
│  │  └─ getProgress()                                 │  │
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

**Technology**: Vanilla React 18 (loaded via CDN)
**Purpose**: Render UI and handle user interactions
**Location**: `web-component/index.html`

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
**Purpose**: Expose app capabilities to ChatGPT
**Location**: `mcp-server/index.js`

#### Tool Definitions:

##### `getCourses()`
```json
{
  "name": "getCourses",
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

##### `getLesson(courseId, lessonId)`
```json
{
  "name": "getLesson",
  "description": "Retrieves a specific lesson with content and exercises",
  "inputSchema": {
    "type": "object",
    "properties": {
      "courseId": { "type": "string" },
      "lessonId": { "type": "string" }
    },
    "required": ["courseId", "lessonId"]
  }
}
```

**Returns**:
```json
{
  "id": "lesson-1",
  "title": "Magic Variables",
  "character": "🧙‍♂️",
  "explanation": "A variable is like a box...",
  "image": "/assets/images/variable-box.png",
  "examples": ["name = 'Ana'", "age = 8"],
  "exercise": {
    "instruction": "Create a variable with your name",
    "template": "my_name = \"___\"",
    "hint": "Write your name between quotes",
    "validation": {
      "type": "contains_string",
      "pattern": "my_name\\s*=\\s*[\"'].+[\"']"
    }
  },
  "reward": {
    "stars": 1,
    "message": "Amazing! You created your first variable! 🎉"
  }
}
```

##### `checkAnswer(lessonId, answer)`
```json
{
  "name": "checkAnswer",
  "description": "Validates student's code answer",
  "inputSchema": {
    "type": "object",
    "properties": {
      "lessonId": { "type": "string" },
      "answer": { "type": "string" }
    },
    "required": ["lessonId", "answer"]
  }
}
```

**Returns**:
```json
{
  "correct": true,
  "message": "Excellent work! 🌟",
  "hint": null,
  "nextLesson": "lesson-2"
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
useEffect() calls window.openai.callTool({name: 'getCourses'})
    ↓
ChatGPT → MCP Server → getCourses()
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
  name: 'getLesson',
  parameters: { courseId: 'python-kids', lessonId: 'lesson-1' }
})
    ↓
ChatGPT → MCP Server → getLesson()
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
  name: 'checkAnswer',
  parameters: { lessonId: 'lesson-1', answer: userCode }
})
    ↓
MCP Server → checkAnswer()
    ↓
Validates answer against lesson's validation rules
    ↓
Returns { correct: true, message: "Great!" }
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

### Why Vanilla React (CDN) Instead of Build Tool?

**Decision**: Load React via CDN, no webpack/vite/etc.

**Rationale**:
- ✅ Single HTML file (easier to host)
- ✅ No build step (faster iteration)
- ✅ Smaller deployment package
- ✅ Easier for others to understand/fork

**Trade-offs**:
- ❌ No JSX (use React.createElement or babel-standalone)
- ❌ No tree-shaking
- ❌ No TypeScript
- ✅ For MVP: acceptable, we chose babel-standalone for JSX support

### Why Node.js for MCP Server?

**Decision**: Use Node.js instead of Python

**Rationale**:
- ✅ JavaScript everywhere (same language as frontend)
- ✅ Faster JSON parsing (V8 engine)
- ✅ Better async I/O for file reads
- ✅ Easier deployment (Railway loves Node.js)

**Note**: Could easily be rewritten in Python if needed

## Security Considerations

### Input Validation

```javascript
// Always validate lesson IDs
function getLesson(courseId, lessonId) {
  // Prevent path traversal
  if (courseId.includes('..') || lessonId.includes('..')) {
    throw new Error('Invalid ID');
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
<!-- In web-component/index.html -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' https://unpkg.com 'unsafe-inline' 'unsafe-eval';
               style-src 'self' 'unsafe-inline';">
```

## Performance Optimizations

### Lazy Loading Lessons

```javascript
// Don't load all lessons upfront
// Load on-demand when user clicks
async function loadLesson(lessonId) {
  const result = await window.openai.callTool({
    name: 'getLesson',
    parameters: { lessonId }
  });
  return JSON.parse(result.content[0].text);
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
function getLesson(courseId, lessonId) {
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
