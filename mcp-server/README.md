# LearnKids MCP Server

Model Context Protocol server that provides educational content and tools for the LearnKids AI platform.

## Overview

This MCP server exposes:
- 📚 Course catalog (educational content for children)
- 📝 Lesson content (explanations, examples, exercises)
- ✅ Answer validation (check student submissions)
- 🎯 Progress tracking capabilities

## Installation

```bash
cd mcp-server
npm install
```

## Running Locally

```bash
# Development mode (auto-reload on file changes)
npm run dev

# Production mode
npm start
```

## Tools Provided

### `getCourses()`

Returns list of all available courses.

**Returns:**
```json
{
  "success": true,
  "data": {
    "courses": [
      {
        "id": "python-kids",
        "title": "Python for Kids",
        "emoji": "🐍",
        "description": "...",
        "totalLessons": 5,
        "estimatedDuration": "25 minutes"
      }
    ]
  }
}
```

### `getCourse(courseId)`

Gets detailed information about a specific course.

**Parameters:**
- `courseId` (string): Course identifier (e.g., "python-kids")

**Returns:**
```json
{
  "success": true,
  "data": {
    "course": {
      "id": "python-kids",
      "title": "Python for Kids",
      "learningObjectives": [...],
      "lessonIds": ["lesson-1", "lesson-2", ...]
    }
  }
}
```

### `getLesson(courseId, lessonId)`

Retrieves complete lesson content including exercises.

**Parameters:**
- `courseId` (string): Course identifier
- `lessonId` (string): Lesson identifier (e.g., "lesson-1")

**Returns:**
```json
{
  "success": true,
  "data": {
    "lesson": {
      "id": "lesson-1",
      "title": "Magic Variables",
      "content": {
        "character": "🧙‍♂️",
        "explanation": "...",
        "examples": [...]
      },
      "exercise": {
        "instruction": "...",
        "template": "...",
        "hint": "..."
      },
      "reward": {
        "stars": 1,
        "badge": "First Variable",
        "message": "..."
      }
    }
  }
}
```

### `checkAnswer(courseId, lessonId, answer)`

Validates a student's code submission.

**Parameters:**
- `courseId` (string): Course identifier
- `lessonId` (string): Lesson identifier
- `answer` (string): Student's code submission

**Returns (Correct):**
```json
{
  "success": true,
  "data": {
    "correct": true,
    "message": "🎉 Amazing! You got it!",
    "reward": { "stars": 1, "badge": "..." },
    "nextLesson": "lesson-2"
  }
}
```

**Returns (Incorrect):**
```json
{
  "success": true,
  "data": {
    "correct": false,
    "message": "Not quite right. Try again!",
    "hint": "Remember to use quotes for text!"
  }
}
```

## Data Structure

### Courses

Location: `data/courses.json`

Contains the course catalog with metadata for each course.

### Lessons

Location: `data/lessons/{courseId}.json`

Contains all lessons for a specific course, including:
- Content (explanations, examples, fun facts)
- Exercises (instructions, templates, hints)
- Validation rules (regex patterns)
- Rewards (stars, badges, messages)

## Validation

The server uses regex pattern matching to validate student code submissions. **Important**: We never execute user code for security reasons.

Example validation:
```javascript
{
  "validation": {
    "type": "regex",
    "pattern": "my_name\\s*=\\s*[\"'][^\"']+[\"']"
  }
}
```

This checks if the student created a variable called `my_name` with a string value.

## Security

- ✅ Input sanitization (no path traversal)
- ✅ Whitelist validation for course IDs
- ✅ Never executes user code
- ✅ Pattern matching only for validation
- ✅ Graceful error handling

## Error Handling

All tools return structured error responses:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "errorCode": "MACHINE_READABLE_CODE"
}
```

Error codes:
- `COURSE_NOT_FOUND` - Invalid course ID
- `LESSON_NOT_FOUND` - Invalid lesson ID
- `INVALID_LESSON_ID` - Malformed lesson ID
- `INTERNAL_ERROR` - Server error

## Logging

The server logs to stderr (visible in development):

```
[LearnKids] Starting MCP server...
[LearnKids] Loaded 1 courses
[LearnKids] MCP server running successfully! 🚀
[LearnKids] Tool called: getCourses
[LearnKids] Tool called: getLesson { courseId: 'python-kids', lessonId: 'lesson-1' }
```

## Testing

```bash
# Manual testing with MCP inspector
npx @modelcontextprotocol/inspector node index.js

# Or use automated tests (TODO)
npm test
```

## Deployment

See [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for deployment instructions to Railway, Render, or other platforms.

## Adding New Content

### Add a New Course

1. Edit `data/courses.json`:
```json
{
  "courses": [
    {
      "id": "new-course",
      "title": "New Course Title",
      "emoji": "🎨",
      ...
    }
  ]
}
```

2. Create `data/lessons/new-course.json` with lesson content

3. Server will automatically load it on next start

### Add a New Lesson

Edit the course's lesson file (`data/lessons/{courseId}.json`):

```json
{
  "lessons": [
    {
      "id": "lesson-6",
      "order": 6,
      "title": "New Concept",
      "content": { ... },
      "exercise": { ... },
      "reward": { ... }
    }
  ]
}
```

## Troubleshooting

**Server won't start**
- Check Node.js version: `node --version` (needs 20+)
- Install dependencies: `npm install`
- Check for syntax errors in JSON files

**Tool not responding**
- Check stderr logs for errors
- Verify JSON structure in data files
- Use MCP inspector for debugging

**Validation always fails**
- Test regex pattern separately
- Check for typos in pattern
- Remember: patterns are case-insensitive by default

## Contributing

When adding new content:
1. Follow the existing JSON structure
2. Test regex patterns thoroughly
3. Keep language age-appropriate (8-12 years)
4. Add fun facts to keep engagement high
5. Use emojis for visual appeal

---

**Built with ❤️ for young learners**
