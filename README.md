# 🎓 LearnKids AI - Educational Platform for Children

> A 100% automated learning management system (LMS) built with OpenAI's Apps SDK, designed for elementary school children (ages 7-12).

## 📋 Project Overview

**LearnKids AI** is a ChatGPT-native learning platform that provides:
- 🎨 Interactive, visually-rich courses designed for children
- 🤖 AI tutor available 24/7 for personalized help
- 📊 Automatic progress tracking
- ⭐ Gamification with stars and badges
- 🚀 Zero-friction onboarding (no login required)

### Core Value Proposition
Children can install the app, browse available courses, choose one, and start learning immediately - all within ChatGPT, with an AI tutor that understands their progress and adapts explanations to their level.

## 🏗️ Architecture

**Version 2.0 - Vercel Deployment with SSE Transport**

```
┌──────────────────────────────────────┐
│  CHATGPT APPS SDK                    │
│  (User Interface Layer)              │
├──────────────────────────────────────┤
│  📱 Web Component (React)            │
│  ├─ Course Catalog (Inline)         │
│  ├─ Lesson Viewer (Fullscreen)      │
│  ├─ Interactive Exercises           │
│  └─ Progress Dashboard              │
└──────────────────────────────────────┘
              ↕️ HTTPS/SSE
┌──────────────────────────────────────┐
│  VERCEL (Serverless Functions)       │
├──────────────────────────────────────┤
│  🚀 HTTP Server (Express)            │
│  ├─ /api/mcp (SSE endpoint)         │
│  ├─ /health (health check)          │
│  └─ /* (static files)               │
└──────────────────────────────────────┘
              ↕️
┌──────────────────────────────────────┐
│  MCP SERVER (SSE Transport)          │
├──────────────────────────────────────┤
│  🛠️ Tools:                           │
│  ├─ getCourses()                    │
│  ├─ getCourse(id)                   │
│  ├─ getLesson(courseId, lessonId)  │
│  └─ checkAnswer(lessonId, answer)  │
└──────────────────────────────────────┘
              ↕️
┌──────────────────────────────────────┐
│  STORAGE                             │
├──────────────────────────────────────┤
│  📚 Static JSON files (content)      │
│  💾 ChatGPT Widget State (progress)  │
└──────────────────────────────────────┘
```

## 📁 Project Structure

```
learningkids-ai/
├── README.md                    # This file
├── docs/
│   ├── ARCHITECTURE.md          # Detailed architecture documentation
│   ├── APPS_SDK_GUIDE.md        # Apps SDK best practices & patterns
│   ├── CHATGPT_CONFIGURATION.md # ChatGPT setup instructions
│   ├── CONTENT_GUIDE.md         # Guidelines for creating educational content
│   ├── DEPLOYMENT_VERCEL.md     # Vercel deployment instructions
│   ├── LEARNINGS.md             # Knowledge base and lessons learned
│   └── TESTING.md               # Testing strategy and checklist
├── mcp-server/
│   ├── index.js                 # MCP server implementation
│   ├── package.json             # Node.js dependencies
│   ├── data/
│   │   ├── courses.json         # Course catalog
│   │   └── lessons/             # Lesson content by course
│   │       └── python-kids.json
│   └── README.md                # MCP server documentation
├── web-component/
│   ├── index.html               # Main UI entry point
│   ├── app.js                   # React application logic
│   ├── styles.css               # Styles optimized for children
│   ├── assets/
│   │   └── images/              # Illustrations and icons
│   └── README.md                # Web component documentation
└── .gitignore
```

## 🎯 MVP Scope (Week 1)

### Included Features
- ✅ 1 complete course: "Python for Kids" (5 lessons)
- ✅ Course catalog with visual cards
- ✅ Interactive lesson viewer
- ✅ Code exercises with validation
- ✅ Progress tracking (localStorage)
- ✅ Kid-friendly UI with emojis and colors
- ✅ AI tutor integration (ChatGPT context-aware)

### Not Included in MVP
- ❌ Multiple courses (coming in v2)
- ❌ Badges/achievements system (coming in v2)
- ❌ Parent dashboard (coming in v3)
- ❌ User authentication (not needed - ChatGPT handles identity)
- ❌ Video content (text + code for MVP)

## 🚀 Quick Start

### Deploy to Google Cloud Run ⭐ (Recommended)

**Why Cloud Run?** Production-grade persistent container platform with:
- ✅ No timeout limits (3600s configured) - perfect for SSE connections
- ✅ Generous free tier (180,000 vCPU-seconds/month)
- ✅ Auto-scaling from 0 to millions of requests
- ✅ Full CLI control with `gcloud` for deployment and debugging

**Prerequisites:**
- Google Cloud account (free tier available)
- `gcloud` CLI installed ([install guide](https://cloud.google.com/sdk/docs/install))

**Steps:**
```bash
# 1. Authenticate with Google Cloud
gcloud auth login

# 2. Create a new project
gcloud projects create learningkids-ai --name="LearnKids AI"

# 3. Enable billing (required for Cloud Run free tier)
# Visit: https://console.cloud.google.com/billing

# 4. Enable required APIs
gcloud services enable run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project=learningkids-ai

# 5. Deploy to Cloud Run
gcloud run deploy learningkids-ai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project learningkids-ai
```

**Live deployment**: `https://learningkids-ai-470541916594.us-central1.run.app`

**ChatGPT Configuration URL**: `https://learningkids-ai-470541916594.us-central1.run.app/mcp`

---

### Alternative: Deploy to Railway

**Why Railway?** Simplest deployment with zero configuration.

**Steps:**
1. Go to [railway.app/new](https://railway.app/new)
2. Click "Deploy from GitHub repo"
3. Select `learningkids-ai`
4. Click "Deploy" (Railway auto-detects Node.js)
5. Go to Settings → Networking → "Generate Domain"
6. Copy your URL and use `https://your-url.railway.app/mcp` for ChatGPT

---

### Prerequisites
- Node.js 20+ installed
- ChatGPT Plus or higher (MCP confirmed working on Plus, Business, Enterprise, Education)
- GitHub account (for deployment)
- Railway account (free tier: $5/month credit) OR Vercel account

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/franorzabal-hub/learningkids-ai.git
cd learningkids-ai

# 2. Install MCP server dependencies
cd mcp-server
npm install

# 3. Start HTTP server with SSE transport
npm start

# 4. Test locally
# Server runs on http://localhost:3000
# - Health check: http://localhost:3000/health
# - Web UI: http://localhost:3000
# - MCP endpoint: http://localhost:3000/api/mcp
```

### Production Deployment (Vercel)

**Quick Deploy:**
1. Fork this repo on GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your forked repo
4. Click "Deploy"
5. Done! Get your URL and configure in ChatGPT

See [docs/DEPLOYMENT_VERCEL.md](docs/DEPLOYMENT_VERCEL.md) for detailed deployment instructions.

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, and technical decisions |
| [APPS_SDK_GUIDE.md](docs/APPS_SDK_GUIDE.md) | Apps SDK best practices from official docs |
| [CHATGPT_CONFIGURATION.md](docs/CHATGPT_CONFIGURATION.md) | **⭐ How to connect ChatGPT to your deployed MCP server** |
| [CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | How to create age-appropriate educational content |
| [DEPLOYMENT_VERCEL.md](docs/DEPLOYMENT_VERCEL.md) | Vercel deployment guide (v2.0 with SSE transport) |
| [LEARNINGS.md](docs/LEARNINGS.md) | **🧠 Knowledge base: errors solved, decisions made, lessons learned** |
| [TESTING.md](docs/TESTING.md) | Testing strategy and QA checklist |

## 🎨 Design Principles

### For Children (Ages 7-12)
1. **Visual First**: Use emojis, large fonts, bright colors
2. **Simple Language**: Short sentences, no jargon
3. **Immediate Feedback**: Celebrate success, encourage on failure
4. **Short Lessons**: 5 minutes max per lesson
5. **One Concept at a Time**: Don't overwhelm

### Technical Principles
1. **Zero Configuration**: Works immediately after installation
2. **Stateless Backend**: All user state in ChatGPT widget state
3. **Static Content**: No database needed for MVP
4. **Fail Gracefully**: Friendly error messages
5. **Fast Loading**: Optimize for quick response times

## 🛠️ Technology Stack

- **Frontend**: Vanilla React 18 (via CDN), HTML5, CSS3
- **Backend**: Node.js 20+, Express 4.19+, MCP SDK (@modelcontextprotocol/sdk)
- **Transport**: SSE (Server-Sent Events) for Vercel compatibility
- **Storage**: JSON files (content), ChatGPT Widget State (user progress)
- **Hosting**: Vercel (serverless, free tier)
- **Distribution**: ChatGPT App Store (when submitted)
- **Version**: 2.0.0 (SSE Transport)

## 📊 Project Status

**Current Phase**: ✅ Production Ready - MVP Complete

**Version**: 2.1.0 (Cloud Run Persistent Server)

**Live Production URL**: https://learningkids-ai-470541916594.us-central1.run.app

**Deployment Options**:
- ⭐ **Google Cloud Run** (Production): Persistent containers, 3600s timeout, full CLI control
- 🚂 **Railway**: Simple deployment, persistent connections
- 🔧 **Vercel**: Serverless (60s timeout - not recommended for ChatGPT)

**GitHub**: https://github.com/franorzabal-hub/learningkids-ai

See [docs/LEARNINGS.md](docs/LEARNINGS.md) for technical decisions and troubleshooting.

## 🤝 Contributing

This is a learning project built for educational purposes. Contributions welcome!

## 📄 License

MIT License - feel free to use this as a template for your own educational apps.

## 🙏 Acknowledgments

- Built with OpenAI's Apps SDK
- Uses Model Context Protocol (MCP)
- Inspired by Digital House and other coding bootcamps

---

**Built with ❤️ for young learners everywhere**
