# 📘 Apps SDK Best Practices & Patterns

This document consolidates best practices from OpenAI's official Apps SDK documentation and applies them to the LearnKids AI project.

## Table of Contents
- [Core Concepts](#core-concepts)
- [MCP Server Patterns](#mcp-server-patterns)
- [Web Component Guidelines](#web-component-guidelines)
- [State Management](#state-management)
- [UI/UX Guidelines](#uiux-guidelines)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Core Concepts

### What is the Apps SDK?

The Apps SDK enables developers to build apps that run **directly inside ChatGPT conversations**. It consists of:

1. **MCP Server** (Model Context Protocol)
   - Exposes your app's capabilities to ChatGPT
   - Defines "tools" (functions ChatGPT can call)
   - Handles business logic and data

2. **Web Component**
   - UI that renders in an iframe within ChatGPT
   - Communicates via `window.openai` API
   - Provides interactive experiences

3. **ChatGPT Integration**
   - ChatGPT acts as the orchestrator
   - Suggests your app when relevant
   - Provides AI tutor capabilities

### Key Principle

> **Apps should extend ChatGPT's capabilities, not replace them.**

Your app provides specialized functionality (e.g., interactive coding exercises) while ChatGPT provides conversational intelligence and context understanding.

---

## MCP Server Patterns

### Tool Definition Best Practices

#### 1. Clear, Descriptive Tool Names

```javascript
// ❌ Bad: Vague names
server.tool("get", { id: z.string() }, handler);
server.tool("do", { data: z.string() }, handler);

// ✅ Good: Clear, action-oriented names
server.tool("getCourse", { courseId: z.string() }, handler);
server.tool("submitExercise", { lessonId: z.string(), answer: z.string() }, handler);
```

#### 2. Detailed Descriptions

ChatGPT uses tool descriptions to decide when to call them. Be specific!

```javascript
// ❌ Bad: Too vague
{
  name: "getLesson",
  description: "Gets a lesson"
}

// ✅ Good: Clear about what and when
{
  name: "getLesson",
  description: "Retrieves detailed lesson content including explanation, examples, and interactive exercises for a specific lesson within a course. Use this when the student wants to start or continue learning."
}
```

#### 3. Strong Input Validation

```javascript
server.tool(
  "getLesson",
  {
    courseId: z.string().regex(/^[a-z0-9-]+$/),
    lessonId: z.string().regex(/^lesson-\d+$/)
  },
  async ({ courseId, lessonId }) => {
    // Additional validation
    const validCourses = ['python-kids', 'scratch-kids'];
    if (!validCourses.includes(courseId)) {
      throw new Error(`Invalid course: ${courseId}`);
    }

    // Prevent path traversal
    if (courseId.includes('..') || lessonId.includes('..')) {
      throw new Error('Invalid path');
    }

    // Your logic here...
  }
);
```

#### 4. Structured, Predictable Responses

```javascript
// ❌ Bad: Inconsistent structure
return { content: [{ type: "text", text: someData }] };
// Sometimes returns error in different format
return { error: "Something failed" };

// ✅ Good: Consistent structure
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      success: true,
      data: lesson,
      metadata: { courseId, timestamp: Date.now() }
    })
  }]
};

// Errors also structured
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      success: false,
      error: "Lesson not found",
      errorCode: "LESSON_NOT_FOUND"
    })
  }]
};
```

### Resource Patterns (Advanced)

Resources provide read-only data that ChatGPT can access without explicit tool calls.

```javascript
// Define a resource for course catalog
server.setRequestHandler("resources/list", async () => ({
  resources: [
    {
      uri: "learningkids://courses",
      name: "Available Courses",
      description: "Complete catalog of all courses",
      mimeType: "application/json"
    }
  ]
}));

server.setRequestHandler("resources/read", async (request) => {
  const { uri } = request.params;

  if (uri === "learningkids://courses") {
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(courses)
      }]
    };
  }
});
```

**When to use Resources vs Tools:**
- **Resources**: Static or infrequently changing data (course catalog)
- **Tools**: Actions or dynamic data (submit answer, get user progress)

---

## Web Component Guidelines

### The `window.openai` API

Your web component communicates with ChatGPT through this global object.

#### Key Methods

##### 1. `callTool()`

Invoke MCP server tools from your UI:

```javascript
const response = await window.openai.callTool({
  name: 'getLesson',
  parameters: {
    courseId: 'python-kids',
    lessonId: 'lesson-1'
  }
});

// Parse response
const data = JSON.parse(response.content[0].text);
console.log(data); // { success: true, data: {...} }
```

##### 2. `setWidgetState()`

Persist data across user interactions:

```javascript
// Save progress
window.openai.setWidgetState({
  completedLessons: ['lesson-1', 'lesson-2'],
  currentLesson: 'lesson-3',
  earnedStars: 10
});

// Read state on mount
useEffect(() => {
  const savedState = window.openai.widgetState;
  if (savedState) {
    setProgress(savedState);
  }
}, []);
```

**Important**: State is limited to ~4KB. Store IDs, not full content!

##### 3. `sendFollowUpMessage()`

Send user messages to ChatGPT:

```javascript
// When user clicks "Ask Tutor" button
function askTutor() {
  window.openai.sendFollowUpMessage(
    "I don't understand why this code doesn't work"
  );
}
```

##### 4. `toolOutput` Property

Access data from the tool call that triggered this widget:

```javascript
function MyComponent() {
  const [lesson, setLesson] = useState(null);

  useEffect(() => {
    // Read initial data from tool output
    const toolData = window.openai.toolOutput;
    if (toolData) {
      setLesson(JSON.parse(toolData));
    }
  }, []);

  return <LessonView lesson={lesson} />;
}
```

### Component Lifecycle

```javascript
function App() {
  // 1. Initialize from tool output or widget state
  useEffect(() => {
    // First, check if we have tool output (new invocation)
    if (window.openai.toolOutput) {
      const data = JSON.parse(window.openai.toolOutput);
      setCurrentView(data.view || 'catalog');
    }
    // Otherwise, restore from widget state (returning to widget)
    else if (window.openai.widgetState) {
      setCurrentView(window.openai.widgetState.currentView);
    }
  }, []);

  // 2. Save state on important changes
  useEffect(() => {
    window.openai.setWidgetState({
      currentView,
      progress
    });
  }, [currentView, progress]);

  // 3. Render based on current state
  return (
    <div>
      {currentView === 'catalog' && <CourseCatalog />}
      {currentView === 'lesson' && <LessonViewer />}
    </div>
  );
}
```

---

## State Management

### Widget State Best Practices

#### 1. Keep It Minimal

```javascript
// ❌ Bad: Storing full lesson content
window.openai.setWidgetState({
  currentLesson: {
    id: 'lesson-1',
    title: 'Variables',
    content: '... 5KB of text ...',
    exercises: [...]
  }
});

// ✅ Good: Store IDs only, fetch content when needed
window.openai.setWidgetState({
  currentLessonId: 'lesson-1',
  currentCourseId: 'python-kids'
});
```

#### 2. Version Your State

```javascript
// Include version for future migrations
window.openai.setWidgetState({
  version: '1.0',
  progress: {
    completedLessons: [],
    currentCourse: null
  }
});

// Later, handle migrations
const state = window.openai.widgetState;
if (state.version === '1.0') {
  // Migrate to v2 format
  const migratedState = migrateV1ToV2(state);
  window.openai.setWidgetState(migratedState);
}
```

#### 3. Defensive State Reading

```javascript
// ❌ Bad: Assumes state exists
const progress = window.openai.widgetState.progress.completedLessons;

// ✅ Good: Defensive with defaults
const state = window.openai.widgetState || {};
const progress = state.progress || {};
const completedLessons = progress.completedLessons || [];
```

### When State is Reset

Widget state persists **only** when users interact through:
- Widget's inline controls (buttons in your UI)
- Picture-in-Picture composer
- Fullscreen composer

State is **reset** when:
- User types in main chat composer (creates new widget instance)
- User starts a new conversation
- User navigates away and returns later

**Strategy**: Design your app to gracefully handle state loss.

```javascript
// Always handle missing state
function App() {
  const [progress, setProgress] = useState(() => {
    const saved = window.openai.widgetState?.progress;
    return saved || {
      completedLessons: [],
      earnedStars: 0
    };
  });

  // Save after every significant action
  const completeLesson = (lessonId) => {
    const newProgress = {
      ...progress,
      completedLessons: [...progress.completedLessons, lessonId],
      earnedStars: progress.earnedStars + 1
    };
    setProgress(newProgress);
    window.openai.setWidgetState({ progress: newProgress });
  };

  return <Lesson onComplete={completeLesson} />;
}
```

---

## UI/UX Guidelines

### Display Mode Selection

#### Inline Mode

**Use for:**
- Course catalog
- Quick actions
- Navigation
- Summary views

**Characteristics:**
- Shows in conversation flow
- Compact (card-like)
- Max 2 primary actions
- Quick interactions

```jsx
// Inline mode example
<div className="course-card">
  <h3>{course.title}</h3>
  <p>{course.description}</p>
  <button onClick={startCourse}>Start Learning</button>
  <button onClick={viewDetails}>Learn More</button>
</div>
```

#### Fullscreen Mode

**Use for:**
- Complex workflows
- Interactive lessons
- Code editors
- Rich content

**Characteristics:**
- Takes full viewport
- ChatGPT composer overlays at bottom
- Users can still chat
- Immersive experience

```jsx
// Fullscreen mode - ChatGPT automatically provides this
<div className="lesson-fullscreen">
  <LessonContent />
  <CodeEditor />
  {/* ChatGPT composer will overlay at bottom */}
</div>
```

#### Picture-in-Picture (PiP)

**Use for:**
- Video playback
- Live activities
- Persistent widgets
- Real-time updates

```javascript
// Request PiP mode (when supported)
if (window.openai.requestPiP) {
  window.openai.requestPiP();
}
```

### Design for Children

Our specific guidelines for LearnKids AI:

#### 1. Visual Hierarchy

```css
/* Large, readable fonts */
.title {
  font-size: 28px;
  font-weight: bold;
  color: #1F2937;
}

.body-text {
  font-size: 18px;
  line-height: 1.8;
}

/* High contrast */
.button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 16px;
  padding: 16px 32px;
}
```

#### 2. Generous Spacing

```css
/* Lots of whitespace */
.lesson-content {
  padding: 32px;
  margin: 24px 0;
}

.button {
  margin: 16px 8px;
}
```

#### 3. Emojis as Visual Anchors

```jsx
// Use emojis to make UI friendly and recognizable
<div className="lesson-header">
  <span className="character" style={{fontSize: '64px'}}>
    🧙‍♂️
  </span>
  <h2>Magic Variables!</h2>
</div>
```

#### 4. Immediate Feedback

```javascript
function checkAnswer(answer) {
  const isCorrect = validateAnswer(answer);

  if (isCorrect) {
    // Celebrate immediately!
    showConfetti();
    playSuccessSound();
    showMessage("🎉 Amazing! You got it!");

    // Then save progress
    saveProgress();
  } else {
    // Encouraging, not discouraging
    showMessage("💪 Almost! Try again - you're so close!");
  }
}
```

---

## Common Patterns

### Pattern 1: Catalog → Detail Flow

Very common in Apps SDK apps:

```javascript
function App() {
  const [view, setView] = useState('catalog');
  const [selectedItem, setSelectedItem] = useState(null);

  const handleSelect = async (itemId) => {
    // Load full details
    const result = await window.openai.callTool({
      name: 'getItemDetails',
      parameters: { itemId }
    });

    setSelectedItem(JSON.parse(result.content[0].text));
    setView('detail');
  };

  return (
    <>
      {view === 'catalog' && (
        <Catalog onSelect={handleSelect} />
      )}
      {view === 'detail' && (
        <Detail item={selectedItem} onBack={() => setView('catalog')} />
      )}
    </>
  );
}
```

### Pattern 2: Progressive Disclosure

Don't overwhelm users - reveal complexity gradually:

```javascript
function Lesson({ lesson }) {
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  return (
    <div>
      <Exercise />

      {!showHint && (
        <button onClick={() => setShowHint(true)}>
          💡 Need a hint?
        </button>
      )}

      {showHint && <Hint text={lesson.hint} />}

      {showHint && !showSolution && (
        <button onClick={() => setShowSolution(true)}>
          🔍 Show solution
        </button>
      )}

      {showSolution && <Solution code={lesson.solution} />}
    </div>
  );
}
```

### Pattern 3: Optimistic Updates

Update UI immediately, sync in background:

```javascript
async function completeLesson(lessonId) {
  // 1. Update UI immediately
  setCompletedLessons(prev => [...prev, lessonId]);
  showCelebration();

  // 2. Persist in background
  try {
    await window.openai.callTool({
      name: 'saveProgress',
      parameters: { lessonId }
    });

    window.openai.setWidgetState({
      completedLessons: [...completedLessons, lessonId]
    });
  } catch (error) {
    // 3. Revert on error
    setCompletedLessons(prev => prev.filter(id => id !== lessonId));
    showError("Couldn't save progress. Try again!");
  }
}
```

### Pattern 4: Error Boundaries

Gracefully handle errors:

```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[LearnKids Error]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div style={{fontSize: '64px'}}>😅</div>
          <h2>Oops! Something went wrong</h2>
          <p>Let's try that again!</p>
          <button onClick={() => window.location.reload()}>
            🔄 Restart
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## Troubleshooting

### Common Issues

#### Issue: "window.openai is undefined"

**Cause**: Component loaded outside ChatGPT environment

**Solution**:
```javascript
// Detect environment
const isInChatGPT = typeof window.openai !== 'undefined';

if (!isInChatGPT) {
  // Show dev mode UI or error
  return <div>This app runs inside ChatGPT</div>;
}
```

#### Issue: Tool calls failing silently

**Cause**: Network errors not handled

**Solution**:
```javascript
async function safeCallTool(name, parameters) {
  try {
    const result = await window.openai.callTool({ name, parameters });
    const data = JSON.parse(result.content[0].text);

    if (data.success === false) {
      throw new Error(data.error || 'Tool call failed');
    }

    return data;
  } catch (error) {
    console.error(`Tool ${name} failed:`, error);

    // Show user-friendly error
    showNotification({
      type: 'error',
      message: 'Something went wrong. Please try again!'
    });

    return null;
  }
}
```

#### Issue: State not persisting

**Cause**: User typing in main composer resets widget

**Solution**: Educate users or redesign flow

```javascript
// Show hint to use widget controls
<div className="tip">
  💡 Use the buttons below to interact.
  If you chat in the main box, you'll start fresh!
</div>
```

#### Issue: Widget state exceeds 4KB

**Cause**: Storing too much data

**Solution**: Store only IDs, fetch content on demand

```javascript
// ❌ Don't store:
setWidgetState({
  lessons: [/* full lesson objects */]
});

// ✅ Do store:
setWidgetState({
  lessonIds: ['lesson-1', 'lesson-2']
});

// Fetch on demand
const lesson = await loadLesson(lessonIds[0]);
```

---

## Performance Tips

### 1. Lazy Load Images

```javascript
<img
  src={imageUrl}
  loading="lazy"
  alt="Lesson illustration"
/>
```

### 2. Debounce Tool Calls

```javascript
const debouncedSaveProgress = useMemo(
  () => debounce((lessonId) => {
    window.openai.callTool({
      name: 'saveProgress',
      parameters: { lessonId }
    });
  }, 1000),
  []
);
```

### 3. Memoize Expensive Computations

```javascript
const processedLessons = useMemo(() => {
  return lessons.map(lesson => ({
    ...lesson,
    difficulty: calculateDifficulty(lesson)
  }));
}, [lessons]);
```

---

## Additional Resources

- [Official Apps SDK Docs](https://developers.openai.com/apps-sdk)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples)
- [ChatGPT App Guidelines](https://developers.openai.com/apps-sdk/concepts/ui-guidelines/)

---

**Last Updated**: 2025-12-26
