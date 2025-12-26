# ChatGPT Configuration Guide

Step-by-step guide to connect ChatGPT to your deployed LearnKids AI MCP server.

## Prerequisites

Before connecting ChatGPT to your MCP server:

**Deployment Complete**
- Server deployed to Cloud Run: `https://learningkids-ai-470541916594.us-central1.run.app`
- Health check passing: `https://learningkids-ai-470541916594.us-central1.run.app/health`

**ChatGPT Requirements**
- ChatGPT Plus, Business, Enterprise, or Education plan
- Developer Mode enabled in ChatGPT settings
- Access to ChatGPT Settings -> Connectors panel

## Configuration Steps

### For ChatGPT (Direct HTTP)

1. **Open ChatGPT Settings**
   - Go to ChatGPT Settings -> Developer Mode
   - Navigate to "MCP Servers" or "Custom Tools"

2. **Add New MCP Server**
   ```json
   {
     "name": "LearnKids AI",
     "url": "https://learningkids-ai-470541916594.us-central1.run.app/mcp",
     "description": "Interactive learning platform for kids"
   }
   ```

3. **Save Configuration**
   - Click "Save" or "Add Server"
   - Wait for connection status to show "Connected"

4. **Verify Tools Available**
   - Check that the following tools appear:
     - `get-courses` - Browse available courses
     - `view-course-details` - Get course details
     - `start-lesson` - View lesson content
     - `check-student-work` - Validate student answers

### For Claude Desktop (mcp-remote)

If using Claude Desktop or another MCP client that requires stdio:

1. **Install mcp-remote**
   ```bash
   npm install -g mcp-remote
   ```

2. **Add to Claude Desktop Config**

   Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

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

3. **Restart Claude Desktop**

## Testing the Connection

### 1. Manual Health Check

```bash
curl https://learningkids-ai-470541916594.us-central1.run.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "2.2.0",
  "server": "Cloud Run",
  "transport": "SSE",
  "mcp": "enabled"
}
```

### 2. Test in ChatGPT

**Test 1: Browse Courses**
```
Show me available courses
```

**Test 2: Get Course Details**
```
Tell me about the Python for Kids course
```

**Test 3: Get a Lesson**
```
Show me lesson 1 from Python for Kids
```

**Test 4: Check an Answer**
```
Check if this answer is correct for Python lesson 1: print("Hello World")
```

## Troubleshooting

### Connection Issues

**Problem:** "Cannot connect to MCP server"

**Solutions:**
1. Verify server is running:
   ```bash
   curl https://learningkids-ai-470541916594.us-central1.run.app/health
   ```

2. Check endpoint URL (no trailing slash):
   - Correct: `https://learningkids-ai-470541916594.us-central1.run.app/mcp`
   - Wrong: `https://learningkids-ai-470541916594.us-central1.run.app/mcp/`

3. Test with mcp-remote:
   ```bash
   npx -y mcp-remote https://learningkids-ai-470541916594.us-central1.run.app/mcp
   ```

### Tool Not Available

**Problem:** "Tool 'get-courses' not found"

**Solutions:**
1. Reconnect to the MCP server
2. Check server logs: `gcloud run logs read --service learningkids-ai --tail`
3. Verify deployment:
   ```bash
   curl https://learningkids-ai-470541916594.us-central1.run.app/api
   ```

## Usage Examples

### Example 1: Start Learning Python

**User:**
> "I want to learn Python. What courses are available?"

**Assistant (using get-courses tool):**
> "I found a course perfect for you: **Python for Kids**
> - **Age Range:** 7-12 years
> - **Difficulty:** Beginner
> - **Lessons:** 5 lessons
>
> Would you like to start with Lesson 1?"

### Example 2: Get Lesson Content

**User:**
> "Yes, show me lesson 1!"

**Assistant (using start-lesson tool):**
> "# Lesson 1: Your First Program!
>
> **What you'll learn:**
> - What is Python?
> - How to print text to the screen
>
> **Exercise:**
> Write a program that prints 'Hello, World!' to the screen."

### Example 3: Check Student Answer

**User:**
> "Here's my code: print('Hello, World!')"

**Assistant (using check-student-work tool):**
> "Excellent work! That's exactly right!
>
> Ready for Lesson 2?"

## Server Information

| Property | Value |
|----------|-------|
| Server Name | learningkids-server |
| Version | 2.2.0 |
| Transport | SSE (Server-Sent Events) |
| Hosting | Google Cloud Run |
| Region | us-central1 |

## Production URLs

| Endpoint | URL |
|----------|-----|
| Widget | https://learningkids-ai-470541916594.us-central1.run.app/ |
| MCP Endpoint | https://learningkids-ai-470541916594.us-central1.run.app/mcp |
| Health Check | https://learningkids-ai-470541916594.us-central1.run.app/health |
| API Info | https://learningkids-ai-470541916594.us-central1.run.app/api |

## Support

**Issues or Questions?**

- Check [README.md](../README.md) for deployment details
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Monitor: `gcloud run logs read --service learningkids-ai --tail`
- Cloud Console: [View Service](https://console.cloud.google.com/run/detail/us-central1/learningkids-ai)
