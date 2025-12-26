# 🚀 Deployment Guide

Complete guide for deploying LearnKids AI to production.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Option 1: Railway Deployment](#option-1-railway-deployment-recommended)
- [Option 2: Render Deployment](#option-2-render-deployment)
- [Option 3: Local Development](#option-3-local-development)
- [ChatGPT Configuration](#chatgpt-configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ Node.js 20+ installed locally
- ✅ Git repository set up
- ✅ ChatGPT Plus subscription (required for Apps SDK)
- ✅ GitHub account (for Railway/Render)

---

## Option 1: Railway Deployment (Recommended)

Railway is the easiest option for deploying both the MCP server and serving static files.

### Step 1: Prepare Your Repository

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: LearnKids AI MVP"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/learningkids-ai.git
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"
4. Choose "Deploy from GitHub repo"
5. Select your `learningkids-ai` repository
6. Railway will auto-detect Node.js

### Step 3: Configure Railway

Add the following environment variables:

```
NODE_ENV=production
PORT=3000
```

### Step 4: Add Start Script

Railway needs to know how to start your server. Edit `mcp-server/package.json`:

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  }
}
```

### Step 5: Configure Build

Create `railway.toml` in the project root:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "cd mcp-server && npm install"

[deploy]
startCommand = "cd mcp-server && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### Step 6: Deploy

Railway will automatically deploy. You'll get a URL like:
```
https://learningkids-ai-production.up.railway.app
```

### Step 7: Serve Web Component

Railway can also serve static files. Add to `mcp-server/index.js`:

```javascript
import express from 'express';
import path from 'path';

const app = express();

// Serve static web component
app.use(express.static(path.join(__dirname, '..', 'web-component')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

Update `package.json`:
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.2",
    "zod": "^3.22.4"
  }
}
```

---

## Option 2: Render Deployment

Render is another excellent free option.

### Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Create Web Service

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `learningkids-ai`
   - **Environment**: `Node`
   - **Build Command**: `cd mcp-server && npm install`
   - **Start Command**: `cd mcp-server && npm start`
   - **Instance Type**: `Free`

### Step 3: Environment Variables

Add in Render dashboard:
```
NODE_ENV=production
PORT=10000
```

### Step 4: Deploy

Click "Create Web Service". Render will deploy and give you a URL:
```
https://learningkids-ai.onrender.com
```

### Step 5: Serve Static Files

Same as Railway - add Express to serve web component.

---

## Option 3: Local Development

For testing locally before deployment.

### Step 1: Install Dependencies

```bash
cd mcp-server
npm install
```

### Step 2: Start MCP Server

```bash
npm start
```

Server will run on `http://localhost:3000`

### Step 3: Expose with ngrok

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Expose local server
ngrok http 3000
```

You'll get a public URL:
```
https://abc123.ngrok.io
```

**Note**: ngrok URLs change on restart. Use for development only.

### Step 4: Serve Web Component Locally

```bash
cd web-component
python3 -m http.server 8000
```

Or use any static file server.

---

## ChatGPT Configuration

Once your MCP server is deployed, configure it in ChatGPT.

### Step 1: Enable Developer Mode

1. Open ChatGPT
2. Go to Settings → Beta Features
3. Enable "Developer Mode"

### Step 2: Add MCP Connector

1. Go to Settings → Developer Mode
2. Click "Add MCP Connector"
3. Fill in:
   - **Name**: LearnKids AI
   - **Description**: Educational platform for children
   - **MCP Server URL**: Your deployed URL (e.g., `https://your-app.railway.app`)

### Step 3: Configure Web Component

In the MCP connector config, add:

```json
{
  "name": "LearnKids AI",
  "description": "Interactive learning platform for children",
  "mcpServerUrl": "https://your-app.railway.app",
  "uiUrl": "https://your-app.railway.app/index.html",
  "icon": "🎓"
}
```

### Step 4: Test Connection

1. Start a new ChatGPT conversation
2. Type: "Show me available courses"
3. ChatGPT should invoke your app

---

## Testing

### 1. Health Check

Verify server is running:

```bash
curl https://your-app.railway.app/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-12-26T10:30:00Z"
}
```

### 2. MCP Tools Test

Use MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node mcp-server/index.js
```

Test each tool:
- `getCourses()`
- `getLesson(courseId: 'python-kids', lessonId: 'lesson-1')`
- `checkAnswer(courseId: 'python-kids', lessonId: 'lesson-1', answer: 'test')`

### 3. Web Component Test

Open in browser:
```
https://your-app.railway.app/index.html
```

Should see the course catalog.

### 4. End-to-End Test in ChatGPT

1. Open ChatGPT
2. Say: "I want to learn Python"
3. App should appear with course catalog
4. Click "Start Learning"
5. Complete a lesson
6. Verify progress is saved

---

## Monitoring

### Railway Dashboard

- View logs: Railway Dashboard → Logs
- Check metrics: Railway Dashboard → Metrics
- Set up alerts: Railway Dashboard → Settings

### Log Monitoring

All logs use `console.error()` for stderr:

```javascript
console.error('[LearnKids] Tool called:', name);
console.error('[LearnKids] Courses loaded:', count);
```

### Error Tracking

For production, consider adding Sentry:

```bash
npm install @sentry/node
```

```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production'
});
```

---

## Scaling

### Free Tier Limits

**Railway:**
- 500 hours/month
- 1GB RAM
- Sufficient for MVP

**Render:**
- Spins down after 15 min inactivity
- Cold start: ~30 seconds
- Free forever tier

### When to Upgrade

Consider paid tier when:
- ❌ > 10,000 requests/month
- ❌ Need 99.9% uptime
- ❌ Need faster cold starts
- ❌ Want custom domain

---

## Custom Domain (Optional)

### Add Domain to Railway

1. Railway Dashboard → Settings → Domains
2. Add custom domain: `learningkids.com`
3. Update DNS records (Railway provides instructions)

### SSL Certificate

Railway automatically provides SSL via Let's Encrypt.

---

## Rollback Strategy

### Railway

1. Go to Deployments
2. Find previous working deployment
3. Click "Redeploy"

### Git-Based Rollback

```bash
# Revert to previous commit
git revert HEAD
git push

# Railway will auto-deploy previous version
```

---

## Environment-Specific Configs

### Development

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

### Production

```bash
NODE_ENV=production
PORT=10000
LOG_LEVEL=info
```

---

## Security Checklist

Before going live:

- [ ] Enable HTTPS (Railway/Render do this automatically)
- [ ] Set Content-Security-Policy headers
- [ ] Validate all user inputs
- [ ] Rate limit API endpoints (optional for MVP)
- [ ] Review CORS settings
- [ ] Check for exposed secrets in logs
- [ ] Enable Railway/Render access logs

---

## Backup Strategy

### Code Backup

- ✅ GitHub repository (primary backup)
- ✅ Railway/Render keep deployment history

### Data Backup

- ✅ Course content in Git
- ✅ No user data stored (ChatGPT handles it)
- ✅ No database to back up

### Recovery Plan

1. Clone repository
2. Deploy to new Railway/Render project
3. Update ChatGPT connector URL
4. Test end-to-end

**Recovery Time**: < 15 minutes

---

## Troubleshooting

### Server won't start

**Check logs:**
```bash
# Railway
railway logs

# Local
cd mcp-server && npm start
```

**Common issues:**
- Missing dependencies: `npm install`
- Wrong Node version: Use Node 20+
- Port already in use: Change PORT in .env

### ChatGPT can't connect

**Verify:**
1. MCP server URL is correct
2. Server is running (check health endpoint)
3. No CORS errors in browser console
4. ChatGPT Developer Mode is enabled

### Web component doesn't load

**Check:**
1. `index.html` is accessible at `/index.html`
2. `styles.css` is loading
3. React/Babel CDN URLs are reachable
4. No CSP blocking scripts

### Tools not responding

**Debug:**
1. Check MCP server logs
2. Use MCP Inspector to test tools
3. Verify JSON responses are valid
4. Check network tab in browser

---

## Post-Deployment Checklist

- [ ] Health check passes
- [ ] All MCP tools work
- [ ] Web component loads
- [ ] Can complete full user journey
- [ ] Progress persists in ChatGPT
- [ ] Error handling works
- [ ] Mobile responsive (test on phone)
- [ ] Logs are clean (no errors)

---

## Next Steps

After successful deployment:

1. **Monitor** for first week
2. **Gather feedback** from beta users
3. **Iterate** based on usage
4. **Plan v0.2** features
5. **Consider** submitting to ChatGPT App Store

---

## Support

If you run into issues:

1. Check [TROUBLESHOOTING](./TROUBLESHOOTING.md)
2. Review Railway/Render logs
3. Test with MCP Inspector
4. Check ChatGPT Developer Console

---

**Deployment Complete!** 🎉

Your app is now live and ready for young learners!
