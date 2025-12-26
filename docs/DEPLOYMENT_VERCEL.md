# 🚀 Vercel Deployment Guide

Complete guide for deploying LearnKids AI to Vercel using SSE transport.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Deploy](#quick-deploy)
- [Manual Setup](#manual-setup)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

**Version 2.0.0** - LearnKids AI now supports **Server-Sent Events (SSE)** transport, making it compatible with Vercel's serverless architecture.

### What Changed?

| Component | v1.0 (Railway) | v2.0 (Vercel) |
|-----------|----------------|---------------|
| **Transport** | StdioServerTransport | SSEServerTransport |
| **Server** | Long-running Node process | Serverless functions |
| **Entry Point** | `index.js` | `server.js` |
| **Hosting** | Railway/Render | Vercel |
| **Cost** | Free tier | Free tier |

---

## Prerequisites

Before deploying, ensure you have:

- ✅ Node.js 20+ installed
- ✅ GitHub account with repo created
- ✅ Vercel account (free tier works)
- ✅ Vercel CLI installed (`npm install -g vercel`)
- ✅ ChatGPT Plus subscription (for Apps SDK)

---

## Quick Deploy

The **fastest way** to deploy:

### Option 1: Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit [vercel.com/new](https://vercel.com/new)
   - Sign in with GitHub

2. **Import Repository**
   - Click "Import Project"
   - Select `franorzabal-hub/learningkids-ai`
   - Click "Import"

3. **Configure Build Settings**
   ```
   Framework Preset: Other
   Build Command: (leave empty)
   Output Directory: (leave empty)
   Install Command: cd mcp-server && npm install
   ```

4. **Environment Variables**
   ```
   NODE_ENV=production
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Get your URL: `https://learningkids-ai-xxx.vercel.app`

### Option 2: Vercel CLI

```bash
# 1. Login to Vercel
vercel login

# 2. Deploy
vercel

# 3. Follow prompts:
#    - Link to existing project? No
#    - Project name: learningkids-ai
#    - Which directory? ./
#    - Override settings? No

# 4. Production deploy
vercel --prod
```

**Done!** 🎉 Your app is live at the URL shown.

---

## Manual Setup

Step-by-step manual deployment:

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Authenticate

```bash
vercel login
```

Opens browser for OAuth. Complete authentication.

### 3. Link Project

```bash
# In project root
vercel link

# Answer prompts:
# - Setup and deploy? No (we'll configure first)
# - Which scope? Your Vercel account
# - Link to existing project? No
# - Project name? learningkids-ai
# - Which directory? ./ (current)
```

This creates `.vercel/` folder with project config.

### 4. Configure Environment

```bash
# Set production env vars
vercel env add NODE_ENV production

# Value: production
```

### 5. Deploy to Preview

```bash
vercel
```

Gets a preview URL like: `https://learningkids-ai-git-main-youruser.vercel.app`

### 6. Test Preview

```bash
# Health check
curl https://your-preview-url.vercel.app/health

# Should return:
# {
#   "status": "healthy",
#   "timestamp": "2025-12-26T...",
#   "version": "2.0.0",
#   "transport": "SSE"
# }
```

### 7. Deploy to Production

```bash
vercel --prod
```

Gets production URL: `https://learningkids-ai.vercel.app`

---

## Configuration

### vercel.json

Already configured in the project:

```json
{
  "version": 2,
  "name": "learningkids-ai",
  "builds": [
    {
      "src": "mcp-server/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/health",
      "dest": "mcp-server/server.js"
    },
    {
      "src": "/api/mcp",
      "dest": "mcp-server/server.js",
      "methods": ["GET", "POST"]
    },
    {
      "src": "/(.*)",
      "dest": "mcp-server/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "regions": ["iad1"],
  "functions": {
    "mcp-server/server.js": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

### Key Settings Explained

| Setting | Value | Why |
|---------|-------|-----|
| `builds[].src` | `mcp-server/server.js` | Entry point for serverless function |
| `builds[].use` | `@vercel/node` | Use Node.js runtime |
| `routes[]` | Multiple routes | Route all requests to server.js |
| `functions.memory` | 1024 MB | Enough for MCP operations |
| `functions.maxDuration` | 60 seconds | Max execution time (SSE needs this) |
| `regions` | `["iad1"]` | US East (fastest for most users) |

### Environment Variables

Set in Vercel Dashboard or CLI:

```bash
# Production
vercel env add NODE_ENV
# Value: production

# Optional: Debug logging
vercel env add LOG_LEVEL
# Value: debug
```

---

## Architecture

### SSE Transport Flow

```
ChatGPT Client
      ↓
  [HTTPS Request]
      ↓
Vercel Edge Network
      ↓
/api/mcp endpoint
      ↓
SSEServerTransport
      ↓
MCP Server (server.js)
      ↓
Tools: getCourses, getLesson, etc.
      ↓
[SSE Stream Response]
      ↓
ChatGPT receives data
```

### File Structure

```
learningkids-ai/
├── vercel.json              # Vercel configuration
├── .vercelignore            # Files to ignore
├── mcp-server/
│   ├── server.js            # SSE transport server ⭐ NEW
│   ├── index.js             # Stdio server (legacy)
│   ├── package.json         # Dependencies
│   └── data/                # Course content
└── web-component/           # Frontend (served by server.js)
```

---

## Testing

### 1. Health Check

```bash
curl https://your-app.vercel.app/health
```

**Expected:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-26T12:00:00.000Z",
  "version": "2.0.0",
  "transport": "SSE"
}
```

### 2. Web Component

Open in browser:
```
https://your-app.vercel.app/
```

Should see the course catalog.

### 3. MCP Endpoint

```bash
# SSE connection test
curl -N https://your-app.vercel.app/api/mcp
```

Should establish SSE connection (keeps stream open).

### 4. ChatGPT Integration

1. Go to ChatGPT Settings → Developer Mode
2. Add MCP Connector:
   ```json
   {
     "name": "LearnKids AI",
     "mcpServerUrl": "https://your-app.vercel.app/api/mcp",
     "uiUrl": "https://your-app.vercel.app"
   }
   ```
3. Start conversation: "Show me available courses"
4. Should invoke the app

---

## Monitoring

### Vercel Dashboard

- **Deployments**: https://vercel.com/youruser/learningkids-ai/deployments
- **Logs**: Click on deployment → "View Function Logs"
- **Analytics**: https://vercel.com/youruser/learningkids-ai/analytics

### View Logs

```bash
# Real-time logs
vercel logs --follow

# Recent logs
vercel logs

# Filter by function
vercel logs --query "mcp-server/server.js"
```

### Common Log Messages

```
✅ [LearnKids] Starting HTTP server...
✅ [LearnKids] Loaded 1 courses
✅ [LearnKids] MCP connection established via SSE
✅ [LearnKids] Tool called: getCourses
```

---

## Troubleshooting

### ❌ Error: "Module not found"

**Cause:** Dependencies not installed

**Fix:**
```bash
cd mcp-server
npm install
git add package-lock.json
git commit -m "chore: update package-lock"
git push
```

Vercel will auto-redeploy.

### ❌ Error: "Function timeout"

**Cause:** Function exceeded 60s limit

**Fix:** Increase in `vercel.json`:
```json
{
  "functions": {
    "mcp-server/server.js": {
      "maxDuration": 300
    }
  }
}
```

**Note:** Pro plan allows up to 300s.

### ❌ SSE Connection Drops

**Cause:** Client disconnected or timeout

**Normal behavior** for SSE. Client should reconnect.

**Check logs:**
```bash
vercel logs --follow
```

Look for:
```
[LearnKids] MCP client disconnected
```

### ❌ ChatGPT Can't Connect

**Checklist:**
1. ✅ Health endpoint returns 200?
   ```bash
   curl -I https://your-app.vercel.app/health
   ```
2. ✅ /api/mcp is accessible?
   ```bash
   curl -N https://your-app.vercel.app/api/mcp
   ```
3. ✅ CORS enabled? (should be in server.js)
4. ✅ Correct URL in ChatGPT config?

### ❌ Build Fails

**Check build logs:**
```bash
vercel logs --build
```

**Common issues:**
- Missing dependencies → Run `npm install` locally first
- Wrong Node version → We require Node 20+
- Syntax errors → Check `server.js` for typos

---

## Performance

### Cold Start

- **First request after inactivity**: ~2-3 seconds
- **Subsequent requests**: < 500ms

### Optimization Tips

1. **Keep functions warm** (Pro plan):
   ```json
   {
     "functions": {
       "mcp-server/server.js": {
         "maxDuration": 60,
         "memory": 1024,
         "runtime": "nodejs20.x",
         "includeFiles": "data/**"
       }
     }
   }
   ```

2. **Cache lesson data in memory** (already implemented)

3. **Use CDN for static assets** (Vercel does this automatically)

---

## Scaling

### Free Tier Limits

- ✅ 100 GB bandwidth/month
- ✅ 100 deployments/day
- ✅ Serverless Function Execution: 100 hours/month
- ✅ Unlimited projects

**Sufficient for:**
- 10,000+ students/month
- 100,000+ lesson views

### When to Upgrade

Consider Pro ($20/month) when:
- ❌ Need > 100 GB bandwidth
- ❌ Need > 100 hours execution time
- ❌ Want analytics & monitoring
- ❌ Need team collaboration

---

## Custom Domain

### Add Domain

1. **Vercel Dashboard**
   - Go to project settings
   - Domains → Add
   - Enter: `learningkids.com`

2. **Configure DNS**
   - Add CNAME record:
     ```
     Name: www
     Value: cname.vercel-dns.com
     ```
   - Add A record:
     ```
     Name: @
     Value: 76.76.21.21
     ```

3. **SSL Certificate**
   - Auto-provisioned by Vercel
   - Takes ~1 minute

---

## Rollback

### Via Dashboard

1. Go to Deployments
2. Find working deployment
3. Click "..." → "Promote to Production"

### Via CLI

```bash
# List deployments
vercel list

# Rollback to specific deployment
vercel rollback <deployment-url>
```

---

## Migration from Railway

Already on Railway? Here's how to migrate:

### 1. Keep Railway Running

Don't delete yet. Deploy to Vercel first.

### 2. Deploy to Vercel

Follow [Quick Deploy](#quick-deploy) steps.

### 3. Test Vercel

Verify everything works on Vercel URL.

### 4. Update ChatGPT

Change MCP connector URL from Railway to Vercel.

### 5. Monitor for 24h

Watch Vercel logs, ensure no errors.

### 6. Delete Railway

Once stable, delete Railway project.

---

## Cost Comparison

| Provider | Free Tier | Paid |
|----------|-----------|------|
| **Vercel** | 100 GB bandwidth, 100h execution | $20/month (Pro) |
| **Railway** | $5 credit/month (~500h) | Pay as you go |
| **Render** | Spins down after 15min inactivity | $7/month |

**Recommendation:** Vercel for production, best performance.

---

## Security

### Best Practices

- ✅ HTTPS enabled by default
- ✅ CORS configured in server.js
- ✅ Input validation on all tools
- ✅ No secrets in code (use env vars)
- ✅ Path traversal prevention

### Environment Secrets

```bash
# Add secret (encrypted)
vercel env add SECRET_KEY
```

Access in code:
```javascript
const secret = process.env.SECRET_KEY;
```

---

## Next Steps

After successful deployment:

1. ✅ Test with real users (3-5 kids)
2. ✅ Monitor logs for errors
3. ✅ Gather feedback
4. ✅ Plan v0.2 features
5. ✅ Submit to ChatGPT App Store

---

## Support

If issues persist:

1. Check [Vercel Docs](https://vercel.com/docs)
2. Review [MCP SDK Docs](https://modelcontextprotocol.io)
3. Check GitHub Issues
4. Contact: [your email]

---

**Deployed with ❤️ on Vercel**

**Live URL:** https://learningkids-ai.vercel.app (update after deploy)
**GitHub:** https://github.com/franorzabal-hub/learningkids-ai
**Status:** ✅ Production Ready
