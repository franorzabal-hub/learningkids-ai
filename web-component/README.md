# LearnKids Web Component

The frontend UI for LearnKids AI that runs inside ChatGPT as an iframe.

## Overview

This is a single-page React application that provides an interactive learning interface for children. It communicates with ChatGPT via the `window.openai` API and with the MCP server through tool calls.

## Architecture

```
index.html (Single File App)
├─ React 18 (via CDN)
├─ Babel Standalone (JSX support)
├─ styles.css (Kid-friendly design)
└─ Application Components
   ├─ CourseCatalog (Inline mode)
   ├─ LessonViewer (Fullscreen mode)
   ├─ Code Editor
   └─ Progress Tracking
```

## Key Features

### 1. Course Catalog (Inline Mode)

Displays available courses in a colorful, card-based layout:
- Large emojis for visual appeal
- Clear descriptions
- Age-appropriate metadata
- One-click course start

### 2. Lesson Viewer (Fullscreen Mode)

Interactive lesson experience:
- Character-based teaching (🧙‍♂️, 🤖, 📖)
- Clear explanations with examples
- Fun facts to maintain engagement
- Code editor for exercises
- Instant feedback on submissions

### 3. Progress Tracking

Uses ChatGPT Widget State to persist:
- Completed lessons
- Earned stars
- Current position in course

### 4. AI Tutor Integration

Students can ask questions to ChatGPT while viewing lessons:
- ChatGPT has context of current lesson
- Can provide personalized help
- Natural language explanations

## Development

### Local Testing

1. Open `index.html` in a browser:
```bash
open web-component/index.html
```

2. Or use a local server:
```bash
cd web-component
python3 -m http.server 8000
# Visit http://localhost:8000
```

**Note**: The `window.openai` API will not be available outside ChatGPT, so you'll need to mock it for local testing.

### Mock window.openai for Testing

Add this before the React app loads:

```javascript
window.openai = {
  callTool: async ({ name, parameters }) => {
    console.log('Mock callTool:', name, parameters);
    // Return mock data based on tool name
    if (name === 'getCourses') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: { courses: [/* mock courses */] }
          })
        }]
      };
    }
  },
  setWidgetState: (state) => {
    console.log('Mock setWidgetState:', state);
    localStorage.setItem('widget-state', JSON.stringify(state));
  },
  widgetState: JSON.parse(localStorage.getItem('widget-state') || 'null')
};
```

## Components

### App (Main Component)

**State:**
- `view`: Current view ('loading' | 'catalog' | 'lesson' | 'error')
- `courses`: Array of available courses
- `currentLesson`: Current lesson data
- `currentCourseId`: ID of active course
- `progress`: User progress (completedLessons[], earnedStars)

**Lifecycle:**
1. Load widget state on mount
2. Fetch courses from MCP server
3. Display catalog
4. Handle course/lesson selection
5. Save progress after each completion

### CourseCatalog

**Props:**
- `courses`: Array of course objects
- `onSelectCourse`: Callback when course is clicked

**Features:**
- Responsive grid layout
- Hover effects
- Clear metadata display

### LessonViewer

**Props:**
- `lesson`: Lesson object with content
- `courseId`: ID of current course
- `onBack`: Callback to return to catalog
- `onComplete`: Callback when lesson is completed

**Features:**
- Character-based teaching
- Code editor with syntax highlighting
- Answer validation
- Hint system
- Reward display
- Auto-advance to next lesson

### LoadingSpinner

Simple loading state with animated emoji.

### ErrorMessage

User-friendly error display with retry option.

## Styling Philosophy

### Design for Children (Ages 8-12)

1. **Typography**
   - Comic Sans MS for friendly feel
   - Large font sizes (18-36px)
   - High line-height for readability

2. **Colors**
   - Bright, cheerful gradients
   - High contrast for accessibility
   - Different colors for different states

3. **Spacing**
   - Generous padding (24-48px)
   - Clear visual hierarchy
   - Room to breathe

4. **Interactive Elements**
   - Large, tappable buttons
   - Hover effects for feedback
   - Smooth animations

5. **Emojis**
   - Large (64-96px) for visual anchors
   - Consistent character usage
   - Adds personality

## State Management

### Widget State Structure

```javascript
{
  version: '1.0',
  progress: {
    completedLessons: ['lesson-1', 'lesson-2'],
    earnedStars: 5
  },
  currentCourseId: 'python-kids',
  lastAccessed: '2025-12-26T10:30:00Z'
}
```

**Size Limit**: ~4KB
**Strategy**: Store IDs only, fetch content on demand

### When State Persists

✅ User clicks buttons in the widget
✅ User uses PiP or Fullscreen composer
✅ Within same conversation

### When State Resets

❌ User types in main ChatGPT composer
❌ User starts new conversation
❌ User navigates away from ChatGPT

## Tool Integration

### getCourses()

Loads course catalog on app initialization.

```javascript
const data = await callTool('getCourses');
setCourses(data.courses);
```

### getLesson(courseId, lessonId)

Loads lesson content when user starts or continues.

```javascript
const data = await callTool('getLesson', {
  courseId: 'python-kids',
  lessonId: 'lesson-1'
});
setCurrentLesson(data.lesson);
```

### checkAnswer(courseId, lessonId, answer)

Validates user's code submission.

```javascript
const data = await callTool('checkAnswer', {
  courseId,
  lessonId: 'lesson-1',
  answer: userCode
});

if (data.correct) {
  // Show success, update progress
  saveProgress(lessonId);
}
```

## Error Handling

### Network Errors

```javascript
try {
  const data = await callTool('getCourses');
} catch (error) {
  setView('error');
  setError('Could not load courses. Please try again!');
}
```

### User-Friendly Messages

- No technical jargon
- Emoji for emotion (😅)
- Clear action (Try Again button)
- Encouraging tone

## Performance

### Optimizations

1. **Lazy Loading**
   - Only load lessons when needed
   - Don't fetch all courses at once

2. **Minimal State**
   - Store IDs, not full content
   - Keep widget state under 4KB

3. **CSS Animations**
   - Use transforms (GPU-accelerated)
   - Respect `prefers-reduced-motion`

4. **Code Splitting**
   - Single file for simplicity
   - Could be split in v2

## Accessibility

- ✅ High contrast colors
- ✅ Large, tappable buttons
- ✅ Keyboard navigation support
- ✅ Focus indicators
- ✅ ARIA labels (could be improved)
- ✅ Responsive design
- ✅ Reduced motion support

## Browser Support

Tested on:
- ✅ Chrome 90+
- ✅ Safari 14+
- ✅ Firefox 88+
- ✅ Edge 90+

**Note**: Requires modern browser with ES6+ support.

## Deployment

### Production Deployment (Vercel)

**Current deployment:** The web component is served alongside the MCP server on Vercel.

**URL:** https://learningkids-ai.vercel.app

The web component is automatically served as static files by the Vercel serverless function at `/api/index.js`.

### How it Works

1. Vercel deploys the entire project
2. MCP server runs at `/api/mcp`
3. Static files (web component) served from `/web-component`
4. All automatically included via `express.static()` in the API handler

### Configure in ChatGPT

See [../docs/CHATGPT_CONFIGURATION.md](../docs/CHATGPT_CONFIGURATION.md) for complete setup instructions.

Quick config:
1. Go to ChatGPT Settings > Developer Mode
2. Add MCP Server URL: `https://learningkids-ai.vercel.app/api/mcp`
3. Web component loads automatically from root URL

## Troubleshooting

### App doesn't load

- Check console for errors
- Verify React/Babel loaded from CDN
- Check Content Security Policy

### Tools not working

- Verify MCP server is running
- Check network tab for failed requests
- Look for CORS issues

### State not persisting

- User might be typing in main composer (resets widget)
- Check widget state size (< 4KB)
- Verify `setWidgetState` is being called

### Styles not applying

- Check `styles.css` is loaded
- Verify correct class names
- Check for CSS conflicts

## Future Enhancements

### v0.2
- [ ] Add celebration animations (confetti)
- [ ] Sound effects for success
- [ ] More visual rewards
- [ ] Certificate generation

### v0.3
- [ ] Video support (PiP mode)
- [ ] Interactive code playgrounds
- [ ] Peer code sharing
- [ ] Parent dashboard

### v1.0
- [ ] Offline support (PWA)
- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] Custom themes

---

**Built with ❤️ using React, designed for young learners**
