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
- Server deployed to Cloud Run: `https://learningkids-ai-470541916594.us-central1.run.app`
- Health check passing: `https://learningkids-ai-470541916594.us-central1.run.app/health`

✅ **ChatGPT Requirements**
- **ChatGPT Plus**, **Business**, **Enterprise**, or **Education** plan (✅ Confirmed working on Plus)
- Developer Mode enabled in ChatGPT settings
- Access to ChatGPT Settings → Connectors panel

**Note**: Earlier documentation suggested MCP wasn't available on Plus, but this has been verified working on ChatGPT Plus as of December 2025.

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
     "url": "https://learningkids-ai-470541916594.us-central1.run.app/mcp",
     "description": "Interactive learning platform for kids"
   }
   ```

   **Note:** ChatGPT expects the endpoint at `/mcp`. The Cloud Run deployment supports persistent SSE connections with no timeout limits.

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
           "https://learningkids-ai-470541916594.us-central1.run.app/mcp"
         ]
       }
     }
   }
   ```

   **Note:** Cloud Run deployment uses the `/mcp` endpoint with persistent connections (no timeout).

3. **Restart Claude Desktop**
   - Close and reopen Claude Desktop
   - The MCP server should connect automatically

---

### For Other MCP Clients

Generic configuration for MCP-compatible clients:

**Connection Type:** HTTP/SSE
**Endpoints:**
- `https://learningkids-ai-470541916594.us-central1.run.app/mcp` (SSE endpoint)
- `https://learningkids-ai-470541916594.us-central1.run.app/mcp/messages` (Message POST endpoint)

**Protocol:** Server-Sent Events (SSE)
**Authentication:** None (public endpoint)
**Max Duration:** 3600 seconds (1 hour) - persistent connections supported

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
curl https://learningkids-ai-470541916594.us-central1.run.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "2.1.0",
  "server": "Cloud Run",
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
   curl https://learningkids-ai-470541916594.us-central1.run.app/health
   ```

2. Check endpoint URL is correct (no trailing slash):
   ✅ `https://learningkids-ai-470541916594.us-central1.run.app/mcp`
   ❌ `https://learningkids-ai-470541916594.us-central1.run.app/mcp/` (trailing slash)

3. Verify ChatGPT plan supports MCP:
   - ✅ Plus, Business, Enterprise, or Education plans
   - ❌ Free plan only (MCP not available)

4. Test with `mcp-remote`:
   ```bash
   npx -y mcp-remote https://learningkids-ai-470541916594.us-central1.run.app/mcp
   ```

---

### Tool Not Available

**Problem:** "Tool 'getCourses' not found"

**Solutions:**
1. Reconnect to the MCP server
2. Check server logs with `gcloud run logs read --tail`
3. Verify deployment succeeded:
   ```bash
   curl https://learningkids-ai-470541916594.us-central1.run.app/
   ```

---

### Timeout Errors

**Problem:** "Request timed out"

**Explanation:** Cloud Run deployment supports up to 3600 seconds (1 hour) for SSE connections.

**Solutions:**
1. Check Cloud Run logs: `gcloud run logs read --service learningkids-ai --tail`
2. Verify the service is healthy: `curl https://learningkids-ai-470541916594.us-central1.run.app/health`
3. Timeout issues should be rare with Cloud Run's persistent container architecture

---

### 405 Method Not Allowed

**Problem:** Getting 405 error when accessing `/mcp`

**Explanation:** The `/mcp` endpoint only accepts GET requests with SSE headers or POST to `/mcp/messages`.

**Solution:** This is normal! MCP clients handle the SSE connection automatically. If testing manually:
```bash
# Test health endpoint instead:
curl https://learningkids-ai-470541916594.us-central1.run.app/health

# Use mcp-remote for testing the MCP endpoint:
npx -y mcp-remote https://learningkids-ai-470541916594.us-central1.run.app/mcp
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
**Version:** 2.1.0
**Transport:** Server-Sent Events (SSE)
**Hosting:** Google Cloud Run
**Region:** us-central1 (Iowa)

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

- **Production (Cloud Run):** `https://learningkids-ai-470541916594.us-central1.run.app`
- **Health Check:** `https://learningkids-ai-470541916594.us-central1.run.app/health`
- **MCP Endpoint:** `https://learningkids-ai-470541916594.us-central1.run.app/mcp`
- **Messages Endpoint:** `https://learningkids-ai-470541916594.us-central1.run.app/mcp/messages`
- **GitHub:** `https://github.com/franorzabal-hub/learningkids-ai`
- **Cloud Console:** `https://console.cloud.google.com/run/detail/us-central1/learningkids-ai`

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

- 📖 Check [README.md](../README.md) for Cloud Run deployment details
- 🏗️ Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- 🐛 Report bugs: [GitHub Issues](https://github.com/franorzabal-hub/learningkids-ai/issues)
- 📊 Monitor: Cloud Run logs via `gcloud run logs read --service learningkids-ai --tail`
- 🌐 Cloud Console: [View Service](https://console.cloud.google.com/run/detail/us-central1/learningkids-ai)

---

**🎓 LearnKids AI is ready for students to start learning!**

Configure ChatGPT, test the connection, and let the AI tutor guide young learners through interactive coding lessons.
