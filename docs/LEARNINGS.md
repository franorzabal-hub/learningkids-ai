# Learnings & Insights - LearnKids AI

> Knowledge base capturing architectural decisions, errors solved, and lessons learned during development.

**Last Updated**: 2025-12-26
**Project Version**: 2.3.1 (Security Best Practices)

---

## Table of Contents

- [Architectural Decisions](#architectural-decisions)
- [Errors & Solutions](#errors--solutions)
- [Development Patterns](#development-patterns)
- [Key Takeaways](#key-takeaways)

---

## Architectural Decisions

### 1. Unified Server vs Split Architecture

**Decision**: Single Node.js server serves both MCP endpoints AND static files.

**Before (v2.1)**: Split architecture
- Cloud Run → MCP server only
- Vercel → Static files (web-component)
- Two deployments to maintain

**After (v2.2)**: Unified server
```javascript
// server.js handles everything:
// - / → Widget (index.html)
// - /styles.css → Static CSS
// - /assets/* → Static assets
// - /mcp → SSE endpoint
// - /mcp/messages → POST endpoint
// - /health → Health check
// - /api → Server info
```

**Why**:
- Single deployment = simpler operations
- One URL for everything
- Easier debugging
- No CORS issues between frontend/backend

---

### 2. Static File Serving with Security

**Implementation**:
```javascript
async function serveStaticFile(res, filePath) {
  // Security: prevent path traversal
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(WEB_COMPONENT_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  // ... serve file
}
```

**Why path traversal protection**:
- User-controlled URLs could include `../`
- Could expose sensitive files outside web-component/
- `path.normalize()` + prefix check prevents this

---

### 3. Lazy Loading for Serverless Compatibility

**Problem**: Module-level `await loadCourses()` caused initialization failures.

**Solution**: Load data on first request.

```javascript
// ❌ Module level (fails in serverless)
const coursesData = await loadCourses();

// ✅ Lazy loading (works)
let coursesData = null;

async function loadCourses() {
  if (!coursesData) {
    const data = await fs.readFile('data/courses.json', 'utf8');
    coursesData = JSON.parse(data);
  }
  return coursesData;
}
```

**Impact**: Cold start improved from >3s to <500ms.

---

### 4. Session Management: Temp-to-Real Promotion

**Problem**: ChatGPT generates sessionId, but SSE connection starts before we know it.

**Solution**: Temp-to-real session promotion pattern.

```javascript
// 1. SSE connection arrives (no sessionId yet)
const tempKey = `temp-${Date.now()}`;
sessions.set(tempKey, { server, transport, temp: true });

// 2. First POST arrives with real sessionId
if (!session && value.temp) {
  sessions.delete(tempKey);
  sessions.set(realSessionId, value);
  value.temp = false;
}
```

**Why this works**:
- SSE connections are long-lived
- POST messages include sessionId
- Promotion links the two together

---

### 5. Why No Database?

**Decision**: Use static JSON files instead of PostgreSQL/MongoDB.

**Rationale**:
- MVP doesn't need dynamic content updates
- Simpler deployment (no DB hosting/migrations)
- Faster reads (file system cache)
- Version control content alongside code
- Easy to hand-edit content

**Trade-offs**:
- Can't add courses without redeploying
- No cross-user analytics

**For MVP**: Acceptable, can migrate later if needed.

---

### 6. OpenAI Apps SDK Best Practices (v2.3.0)

**Decision**: Implement full OpenAI Apps SDK patterns for widget integration.

**Improvements Made**:

1. **Widget as MCP Resource**:
```javascript
// Register widget with ui:// URI scheme
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{
    uri: 'ui://widget/learningkids.html',
    mimeType: 'text/html+skybridge',
    _meta: {
      'openai/widgetDomain': 'learningkids',
      'openai/widgetCSP': { connect_domains: [...], resource_domains: [...] },
      'openai/widgetDescription': '...',
    },
  }],
}));
```

2. **outputTemplate Linking**:
```javascript
// Tools point to widget via outputTemplate
_meta: {
  'openai/outputTemplate': 'ui://widget/learningkids.html',
  'openai/widgetAccessible': true,
  'openai/resultCanProduceWidget': true,
}
```

3. **Widget Accessibility**:
- Enabled `widgetAccessible: true` for all tools
- Allows widget to call tools via `window.openai.callTool()`
- Enables interactive experiences within the widget

4. **CSP Configuration**:
```javascript
'openai/widgetCSP': {
  connect_domains: ['https://learningkids-ai-...run.app'],
  resource_domains: ['https://unpkg.com', 'https://*.oaistatic.com'],
}
```

**Why These Improvements Matter**:
- ChatGPT can now properly display the widget when tools are called
- Widget is self-contained with inlined CSS
- Proper security via CSP domains
- Better UX with widgetDescription reducing redundant text

---

### 7. Why ChatGPT Widget State for User Progress?

**Decision**: Store user progress in ChatGPT's widget state, not backend.

**Rationale**:
- No user authentication needed
- ChatGPT handles identity management
- Privacy-first (no PII stored by us)
- Simpler backend (stateless)
- 4KB is enough for progress tracking

**Trade-offs**:
- Progress lost if user creates new conversation
- Can't track users across devices

**For MVP**: Acceptable, kids likely use same conversation.

---

## Errors & Solutions

### Error 1: Vercel 60-Second Timeout

**Symptom**: "Connection closed" after ChatGPT connects.

**Root Cause**: Vercel serverless functions have 60-second hard limit. SSE connections need to stay open indefinitely.

**Solution**: Migrated to Google Cloud Run with 3600-second timeout.

**Lesson**: Serverless ≠ persistent connections. Choose platform based on use case.

---

### Error 2: Cloud Run IAM Permissions

**Full Error**:
```
PERMISSION_DENIED: Build failed because the default service account
is missing required IAM permissions.
```

**Solution**:
```bash
# Grant required roles to Cloud Build service account
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

**Lesson**: GCP follows security-by-default. New projects require explicit permission grants.

---

### Error 3: 405 Method Not Allowed (MCP Connection)

**Symptom**: ChatGPT couldn't connect to MCP server.

**Root Cause**: Missing OPTIONS handler for CORS preflight.

**Solution**: Handle OPTIONS in HTTP server:
```javascript
if (req.method === 'OPTIONS') {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  });
  res.end();
  return;
}
```

---

### Error 4: Data Files Not Found in Docker

**Symptom**: `ENOENT: no such file or directory 'data/courses.json'`

**Root Cause**: Dockerfile didn't copy data directory.

**Solution**: Update Dockerfile:
```dockerfile
COPY server.js ./
COPY mcp-server ./mcp-server
COPY web-component ./web-component  # Added
```

**Lesson**: Docker only includes what you explicitly COPY.

---

### Error 5: ChatGPT Plus MCP Support

**Discovery**: Documentation claimed MCP only on Business/Enterprise tiers.

**Reality**: MCP works on ChatGPT Plus (confirmed December 2025).

**Lesson**: Verify documentation claims with real testing. Platforms update faster than docs.

---

## Development Patterns

### Pattern 1: Single File React (No Build Step)

**Approach**: Load React via CDN, use Babel standalone for JSX.

```html
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel">
  // JSX works here
</script>
```

**Why**:
- Single HTML file (easier to host)
- No build step (faster iteration)
- Smaller deployment package
- Easier for others to understand/fork

---

### Pattern 2: MCP Tool Design

**Good tool design**:
```javascript
{
  name: 'get-courses',
  title: 'Browse Learning Courses',
  description: 'Shows all available educational courses for kids. Safe, read-only operation.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  _meta: {
    'openai/visibility': 'public',
    'openai/toolInvocation/invoking': 'Loading courses...',
    'openai/toolInvocation/invoked': 'Courses loaded',
  },
}
```

**Key elements**:
- Clear, descriptive name
- Human-readable title
- Detailed description with safety info
- OpenAI metadata for better UX

---

### Pattern 3: Structured Error Responses

```javascript
if (!isValidCourseId(courseId)) {
  return {
    content: [{
      type: 'text',
      text: `Course "${courseId}" not found. Please use get-courses to see available courses.`,
    }],
    isError: true,
  };
}
```

**Why**:
- `isError: true` signals failure to ChatGPT
- Helpful message guides user to fix issue
- Never expose internal errors

---

### Pattern 4: Health Check Design

```javascript
if (url.pathname === '/health') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'healthy',
    version: '2.6.0',
    server: process.env.K_SERVICE ? 'Cloud Run' : 'Local',
    transport: 'SSE',
    mcp: 'enabled',
  }));
}
```

**Include**:
- Status (healthy/degraded/unhealthy)
- Version (for debugging)
- Environment detection
- Feature flags

---

## Key Takeaways

### Infrastructure
1. **Serverless ≠ persistent connections** - Use containers for SSE/WebSocket
2. **Cloud Run is excellent** - 3600s timeout, generous free tier, full CLI control
3. **Unified deployment** - One server for everything reduces complexity
4. **IAM security-by-default** - New GCP projects require explicit permission grants

### MCP Development
5. **Lazy load in serverless** - Never expensive I/O at module level
6. **Session promotion pattern** - Handle unknown sessionId at SSE start
7. **Structured responses** - Use `isError` flag, helpful messages

### Code Quality
8. **Path traversal protection** - Always validate user-controlled paths
9. **CORS handling** - OPTIONS preflight required for cross-origin
10. **Health checks** - Include version and environment info

### Documentation
11. **Verify platform claims** - Test real behavior, don't trust docs blindly
12. **Single source of truth** - One doc per topic, delete obsolete content
13. **Living documentation** - Update as you learn, not just at project end

### Process
14. **Consult docs first** - Official adapters save weeks of work
15. **Test with real clients** - curl isn't enough, use actual ChatGPT
16. **Platform specificity matters** - Different AI platforms have different conventions

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.3.1 | 2025-12-26 | Security best practices (readOnlyHint, additionalProperties, securitySchemes) |
| 2.3.0 | 2025-12-26 | OpenAI Apps SDK best practices (widget resources, outputTemplate, widgetAccessible) |
| 2.2.0 | 2025-12-26 | Unified server (MCP + static files), removed Vercel/Railway |
| 2.1.0 | 2025-12-26 | Cloud Run deployment, persistent server |
| 2.0.0 | 2025-12-26 | Vercel + mcp-handler migration |
| 1.0.0 | 2025-12-26 | Initial MVP |

---

**Built with iteration and learning**
