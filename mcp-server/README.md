# LearnKids MCP Server

Model Context Protocol server that provides educational content and tools for the LearnKids AI platform.

**Version:** 2.0.0 (Vercel Serverless with mcp-handler)

## Overview

This MCP server exposes educational tools for children through ChatGPT:
- 📚 Course catalog (educational content for children)
- 📝 Lesson content (explanations, examples, exercises)
- ✅ Answer validation (check student submissions)
- 🎯 Interactive learning experience

## Architecture

**New in v2.0:**
- Uses Vercel's official `mcp-handler` package
- Deployed as serverless function on Vercel
- SSE (Server-Sent Events) transport
- Lazy data loading for optimal cold starts

**Files:**
- `/api/[transport].js` - MCP server implementation (production)
- `index.js` - Stdio server for local development
- `data/` - Educational content (courses and lessons)

## Local Development

```bash
cd mcp-server
npm install

# Development mode (stdio transport)
npm run dev

# Or start with Node directly
node index.js
```

## Production Deployment

The MCP server is deployed to Vercel at `/api`:

```
https://learningkids-ai.vercel.app/api
```

The handler uses dynamic routing with `[transport].js` pattern, which automatically derives SSE endpoints.

See [../docs/DEPLOYMENT_VERCEL.md](../docs/DEPLOYMENT_VERCEL.md) for deployment details.

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

**Location:** `data/courses.json`

Contains the course catalog with metadata for each course.

### Lessons

**Location:** `data/lessons/{courseId}.json`

Contains all lessons for a specific course, including:
- Content (explanations, examples, fun facts)
- Exercises (instructions, templates, hints)
- Validation rules (regex patterns)
- Rewards (stars, badges, messages)

## Validation

The server uses regex pattern matching to validate student code submissions.

**Security:** We never execute user code. Only pattern matching for safety.

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
- ✅ Lazy data loading (serverless-friendly)

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

The server logs important events:

```
[LearnKids] Setting up MCP tools...
[LearnKids] Loaded 1 courses
[LearnKids] Tool called: getCourses
[LearnKids] Tool called: getLesson { courseId: 'python-kids', lessonId: 'lesson-1' }
```

View logs in Vercel Dashboard: https://vercel.com/francisco-orzabals-projects/learningkids-ai

## Testing

### Local Testing

```bash
# Use MCP inspector (stdio mode)
npx @modelcontextprotocol/inspector node index.js
```

### Production Testing

```bash
# Health check
curl https://learningkids-ai.vercel.app/api/health

# Test in ChatGPT
# See docs/CHATGPT_CONFIGURATION.md
```

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
      "description": "Course description",
      "ageRange": "7-12 years",
      "difficulty": "Beginner",
      "totalLessons": 5,
      "estimatedDuration": "30 minutes"
    }
  ]
}
```

2. Create `data/lessons/new-course.json` with lesson content

3. Deploy to Vercel (changes auto-deployed on git push)

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

**Local server won't start**
- Check Node.js version: `node --version` (needs 20+)
- Install dependencies: `npm install`
- Check for syntax errors in JSON files

**Vercel deployment fails**
- Check Vercel logs: `vercel logs`
- Verify data files are included in deployment
- Check `vercel.json` configuration

**Tool not responding**
- Check Vercel function logs
- Verify data files exist and are valid JSON
- Test locally with MCP inspector first

**Validation always fails**
- Test regex pattern separately
- Check for typos in pattern
- Remember: patterns are case-insensitive by default

## Migration from v1.0

**Changes in v2.0:**
- ❌ Removed: Railway/Render deployment
- ✅ Added: Vercel serverless deployment
- ✅ Added: `mcp-handler` package
- ✅ Added: SSE transport
- ✅ Changed: Entry point is `/api/mcp.js` (production)
- ✅ Kept: `index.js` for local development

**Migration steps:**
1. Install new dependency: `npm install mcp-handler`
2. Deploy to Vercel (see docs/DEPLOYMENT_VERCEL.md)
3. Update ChatGPT configuration with new URL

## Contributing

When adding new content:
1. Follow the existing JSON structure
2. Test regex patterns thoroughly
3. Keep language age-appropriate (7-12 years)
4. Add fun facts to keep engagement high
5. Use emojis for visual appeal
6. Test locally before deploying

## Resources

- **Production URL**: https://learningkids-ai.vercel.app
- **MCP Endpoint**: https://learningkids-ai.vercel.app/api
- **Vercel Dashboard**: https://vercel.com/francisco-orzabals-projects/learningkids-ai
- **Documentation**: See `/docs` folder
- **ChatGPT Config**: See `docs/CHATGPT_CONFIGURATION.md`

---

**Built with ❤️ for young learners**
