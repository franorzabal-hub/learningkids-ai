# 🤖 ChatGPT Configuration Guide

Step-by-step guide to connect ChatGPT to your deployed LearnKids AI MCP server.

---

## Table of Contents
- [Prerequisites](#prerequisites)
- [Connection Methods](#connection-methods)
- [Configuration Steps](#configuration-steps)
- [Testing the Connection](#testing-the-connection)
- [Troubleshooting](#troubleshooting)
- [Usage Examples](#usage-examples)

---

## Prerequisites

Before connecting ChatGPT to your MCP server:

✅ **Deployment Complete**
- Server deployed to Vercel: `https://learningkids-ai.vercel.app`
- Health check passing: `https://learningkids-ai.vercel.app/api/health`

✅ **ChatGPT Requirements**
- **ChatGPT Business**, **Enterprise**, or **Education** plan (MCP not available on Plus/Free)
- Developer Mode enabled in ChatGPT settings
- Access to ChatGPT Settings → Connectors panel

**Alternative:**
- Claude Desktop with MCP support (works with free Claude account)

---

## Connection Methods

There are two main ways to connect to the MCP server:

### Method 1: Direct HTTP Connection (Recommended)

Connect directly to the Vercel-deployed MCP endpoint.

**Best for:**
- Production use
- Stable connections
- Shared access

### Method 2: mcp-remote Proxy

Use `mcp-remote` to proxy HTTP into stdio for older clients.

**Best for:**
- Older MCP clients
- Clients without native HTTP support
- Local testing

---

## Configuration Steps

### For ChatGPT (Direct HTTP)

1. **Open ChatGPT Settings**
   - Go to ChatGPT Settings → Developer Mode
   - Navigate to "MCP Servers" or "Custom Tools"

2. **Add New MCP Server**
   ```json
   {
     "name": "LearnKids AI",
     "url": "https://learningkids-ai.vercel.app/mcp",
     "description": "Interactive learning platform for kids"
   }
   ```

   **Note:** ChatGPT expects the endpoint at `/mcp`. We also provide `/api` for other MCP clients like Claude Desktop.

3. **Save Configuration**
   - Click "Save" or "Add Server"
   - Wait for connection status to show "Connected"

4. **Verify Tools Available**
   - Check that the following tools appear:
     - `getCourses` - Browse available courses
     - `getCourse` - Get course details
     - `getLesson` - View lesson content
     - `checkAnswer` - Validate student answers

---

### For Claude Desktop (mcp-remote)

If using Claude Desktop or another MCP client that requires stdio:

1. **Install mcp-remote**
   ```bash
   npm install -g mcp-remote
   ```

2. **Add to Claude Desktop Config**

   Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent:

   ```json
   {
     "mcpServers": {
       "learningkids": {
         "command": "npx",
         "args": [
           "-y",
           "mcp-remote",
           "https://learningkids-ai.vercel.app/api"
         ]
       }
     }
   }
   ```

   **Note:** Claude Desktop works best with `/api` endpoint. ChatGPT uses `/mcp`.

3. **Restart Claude Desktop**
   - Close and reopen Claude Desktop
   - The MCP server should connect automatically

---

### For Other MCP Clients

Generic configuration for MCP-compatible clients:

**Connection Type:** HTTP/SSE
**Endpoints:**
- `https://learningkids-ai.vercel.app/mcp` (for ChatGPT Apps SDK)
- `https://learningkids-ai.vercel.app/api` (for Claude Desktop and other MCP clients)

**Protocol:** Server-Sent Events (SSE)
**Authentication:** None (public endpoint)
**Max Duration:** 60 seconds per request

**Available Tools:**
```typescript
interface Tools {
  getCourses(): Promise<Course[]>;
  getCourse(courseId: string): Promise<CourseDetails>;
  getLesson(courseId: string, lessonId: string): Promise<Lesson>;
  checkAnswer(courseId: string, lessonId: string, answer: string): Promise<ValidationResult>;
}
```

---

## Testing the Connection

### 1. Manual Health Check

Test the server is running:

```bash
curl https://learningkids-ai.vercel.app/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-26T15:40:39.741Z",
  "version": "2.0.0",
  "transport": "SSE",
  "mcp": "enabled"
}
```

### 2. Test in ChatGPT

Try these prompts after connecting:

**Test 1: Browse Courses**
```
Show me available courses
```

Expected: List of educational courses with emojis, descriptions, and metadata

**Test 2: Get Course Details**
```
Tell me about the Python for Kids course
```

Expected: Detailed course information with lesson list

**Test 3: Get a Lesson**
```
Show me lesson 1 from Python for Kids
```

Expected: Complete lesson content with explanations and exercises

**Test 4: Check an Answer**
```
Check if this answer is correct for Python lesson 1: print("Hello World")
```

Expected: Validation result with feedback

---

## Troubleshooting

### Connection Issues

**Problem:** "Cannot connect to MCP server"

**Solutions:**
1. Verify server is running:
   ```bash
   curl https://learningkids-ai.vercel.app/api/health
   ```

2. Check endpoint URL is correct (no trailing slash):
   ✅ `https://learningkids-ai.vercel.app/mcp` (for ChatGPT)
   ✅ `https://learningkids-ai.vercel.app/api` (for Claude Desktop)
   ❌ `https://learningkids-ai.vercel.app/mcp/` (trailing slash)

3. Verify ChatGPT plan supports MCP:
   - ✅ Business, Enterprise, or Education plans
   - ❌ Plus or Free plans (MCP not available)

4. Test with `mcp-remote`:
   ```bash
   # For ChatGPT endpoint:
   npx -y mcp-remote https://learningkids-ai.vercel.app/mcp

   # For Claude Desktop endpoint:
   npx -y mcp-remote https://learningkids-ai.vercel.app/api
   ```

---

### Tool Not Available

**Problem:** "Tool 'getCourses' not found"

**Solutions:**
1. Reconnect to the MCP server
2. Check server logs in Vercel dashboard
3. Verify deployment succeeded:
   ```bash
   curl https://learningkids-ai.vercel.app/api
   ```

---

### Timeout Errors

**Problem:** "Request timed out after 60 seconds"

**Explanation:** Vercel serverless functions have a 60-second max duration on free tier.

**Solutions:**
1. This is expected for long-running operations
2. Upgrade to Vercel Pro for 300s max duration
3. Break long operations into smaller chunks

---

### 405 Method Not Allowed

**Problem:** Getting 405 error when accessing `/api`

**Explanation:** This is expected for simple GET requests without SSE connection.

**Solution:** This is normal! MCP clients handle the SSE connection automatically. If testing manually:
```bash
# This will show 405 (expected)
curl -I https://learningkids-ai.vercel.app/api

# MCP clients connect via the transport endpoint (e.g., /api/sse)
# Use mcp-remote for testing:
npx -y mcp-remote https://learningkids-ai.vercel.app/api
```

---

## Usage Examples

### Example 1: Start Learning Python

**User:**
> "I want to learn Python. What courses are available?"

**Assistant (using getCourses tool):**
> "I found a course perfect for you: **🐍 Python for Kids**
> - **Age Range:** 7-12 years
> - **Difficulty:** Beginner
> - **Lessons:** 5 lessons
> - **Duration:** About 5 hours
>
> Would you like to start with Lesson 1?"

---

### Example 2: Get Lesson Content

**User:**
> "Yes, show me lesson 1!"

**Assistant (using getLesson tool):**
> "# Lesson 1: Your First Program! 🎉
>
> **What you'll learn:**
> - What is Python?
> - How to print text to the screen
> - Writing your first program
>
> **Exercise:**
> Write a program that prints 'Hello, World!' to the screen.
>
> Would you like a hint?"

---

### Example 3: Check Student Answer

**User:**
> "Here's my code: print('Hello, World!')"

**Assistant (using checkAnswer tool):**
> "🌟 Excellent work! That's exactly right!
>
> Your code will print 'Hello, World!' to the screen. You've written your first Python program!
>
> **What's Next:**
> Lesson 2 introduces variables. Ready to continue?"

---

## MCP Server Information

**Server Name:** learningkids-server
**Version:** 2.0.0
**Transport:** Server-Sent Events (SSE)
**Hosting:** Vercel Serverless Functions
**Region:** US East (iad1)

**Capabilities:**
- ✅ Tools (4 total)
- ✅ Resources (1 total)
- ❌ Prompts (not implemented)

**Tools:**
1. `getCourses` - List all available courses
2. `getCourse` - Get detailed course information
3. `getLesson` - Retrieve lesson content
4. `checkAnswer` - Validate student code submissions

**Resources:**
1. `learningkids://courses` - Course catalog

---

## Production URLs

- **Production:** `https://learningkids-ai.vercel.app`
- **Health Check:** `https://learningkids-ai.vercel.app/api/health`
- **MCP Endpoints:**
  - ChatGPT Apps SDK: `https://learningkids-ai.vercel.app/mcp`
  - Claude Desktop / Other: `https://learningkids-ai.vercel.app/api`
- **GitHub:** `https://github.com/franorzabal-hub/learningkids-ai`
- **Vercel Dashboard:** `https://vercel.com/francisco-orzabals-projects/learningkids-ai`

---

## Next Steps

After successful connection:

1. ✅ Test all 4 tools with sample queries
2. ✅ Try completing a full lesson workflow
3. ✅ Monitor usage in Vercel dashboard
4. ✅ Gather feedback from test users
5. ✅ Consider adding more courses
6. ✅ Plan v0.2 features

---

## Support

**Issues or Questions?**

- 📖 Check [DEPLOYMENT_VERCEL.md](./DEPLOYMENT_VERCEL.md) for deployment details
- 🏗️ Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- 🐛 Report bugs: [GitHub Issues](https://github.com/franorzabal-hub/learningkids-ai/issues)
- 📊 Monitor: [Vercel Dashboard](https://vercel.com/francisco-orzabals-projects/learningkids-ai)

---

**🎓 LearnKids AI is ready for students to start learning!**

Configure ChatGPT, test the connection, and let the AI tutor guide young learners through interactive coding lessons.
