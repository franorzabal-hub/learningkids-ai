# LearnKids AI - Educational Platform for Children

> A 100% automated learning management system (LMS) built with OpenAI's Apps SDK, designed for elementary school children (ages 7-12).

## Project Overview

**LearnKids AI** is a ChatGPT-native learning platform that provides:
- Interactive, visually-rich courses designed for children
- AI tutor available 24/7 for personalized help
- Automatic progress tracking
- Gamification with stars and badges
- Zero-friction onboarding (no login required)

### Core Value Proposition
Children can install the app, browse available courses, choose one, and start learning immediately - all within ChatGPT, with an AI tutor that understands their progress and adapts explanations to their level.

## Architecture

**Version 2.2.0 - Cloud Run Unified Server**

```
┌──────────────────────────────────────┐
│  CHATGPT APPS SDK                    │
│  (User Interface Layer)              │
├──────────────────────────────────────┤
│  Web Component (React)               │
│  ├─ Course Catalog (Inline)          │
│  ├─ Lesson Viewer (Fullscreen)       │
│  ├─ Interactive Exercises            │
│  └─ Progress Dashboard               │
└──────────────────────────────────────┘
              ↕ HTTPS/SSE
┌──────────────────────────────────────┐
│  GOOGLE CLOUD RUN                    │
│  (Unified Server)                    │
├──────────────────────────────────────┤
│  Node.js HTTP Server                 │
│  ├─ / (Widget - index.html)          │
│  ├─ /styles.css (static)             │
│  ├─ /assets/* (static)               │
│  ├─ /mcp (SSE endpoint)              │
│  ├─ /mcp/messages (POST)             │
│  ├─ /health (health check)           │
│  └─ /api (server info)               │
└──────────────────────────────────────┘
              ↕
┌──────────────────────────────────────┐
│  MCP SERVER (SSE Transport)          │
├──────────────────────────────────────┤
│  Tools:                              │
│  ├─ get-courses                      │
│  ├─ view-course-details              │
│  ├─ start-lesson                     │
│  └─ check-student-work               │
└──────────────────────────────────────┘
              ↕
┌──────────────────────────────────────┐
│  STORAGE                             │
├──────────────────────────────────────┤
│  Static JSON files (content)         │
│  ChatGPT Widget State (progress)     │
└──────────────────────────────────────┘
```

## Project Structure

```
learningkids-ai/
├── server.js                   # Main HTTP server (MCP + static files)
├── Dockerfile                  # Cloud Run container config
├── package.json                # Node.js dependencies
├── mcp-server/
│   └── data/
│       ├── courses.json        # Course catalog
│       └── lessons/
│           └── python-kids.json
├── web-component/
│   ├── index.html              # Main UI (React)
│   ├── styles.css              # Kid-friendly styles
│   └── assets/                 # Images and icons
└── docs/
    ├── ARCHITECTURE.md         # System design
    ├── APPS_SDK_GUIDE.md       # Apps SDK best practices
    ├── CHATGPT_CONFIGURATION.md # ChatGPT setup
    ├── CONTENT_GUIDE.md        # Educational content guidelines
    └── TESTING.md              # Testing strategy
```

## MVP Features

### Included
- 1 complete course: "Python for Kids" (5 lessons)
- Course catalog with visual cards
- Interactive lesson viewer
- Code exercises with validation
- Progress tracking (ChatGPT Widget State)
- Kid-friendly UI with emojis and colors
- AI tutor integration (ChatGPT context-aware)

### Planned for v2
- Multiple courses
- Badges/achievements system
- Parent dashboard

## Quick Start

### Deploy to Google Cloud Run

**Prerequisites:**
- Google Cloud account (free tier available)
- `gcloud` CLI installed ([install guide](https://cloud.google.com/sdk/docs/install))

**Steps:**
```bash
# 1. Authenticate with Google Cloud
gcloud auth login

# 2. Create a new project (or use existing)
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

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/franorzabal-hub/learningkids-ai.git
cd learningkids-ai

# 2. Install dependencies
npm install

# 3. Start server
npm start

# 4. Test locally at http://localhost:8000
#    - Widget: http://localhost:8000/
#    - Health: http://localhost:8000/health
#    - MCP: http://localhost:8000/mcp
```

## Production URLs

| Endpoint | URL |
|----------|-----|
| Widget | https://learningkids-ai-470541916594.us-central1.run.app/ |
| MCP Endpoint | https://learningkids-ai-470541916594.us-central1.run.app/mcp |
| Health Check | https://learningkids-ai-470541916594.us-central1.run.app/health |
| API Info | https://learningkids-ai-470541916594.us-central1.run.app/api |

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and technical decisions |
| [APPS_SDK_GUIDE.md](docs/APPS_SDK_GUIDE.md) | Apps SDK best practices |
| [CHATGPT_CONFIGURATION.md](docs/CHATGPT_CONFIGURATION.md) | How to connect ChatGPT to the MCP server |
| [CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | Creating age-appropriate content |
| [TESTING.md](docs/TESTING.md) | Testing strategy and QA checklist |

## Design Principles

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

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 (CDN), HTML5, CSS3 |
| Backend | Node.js 20+, MCP SDK |
| Transport | SSE (Server-Sent Events) |
| Storage | JSON files (content), ChatGPT Widget State (progress) |
| Hosting | Google Cloud Run |
| Version | 2.2.0 |

## Project Status

**Current Phase**: Production Ready - MVP Complete

**Version**: 2.2.0 (Cloud Run Unified Server)

**Live URL**: https://learningkids-ai-470541916594.us-central1.run.app

**GitHub**: https://github.com/franorzabal-hub/learningkids-ai

## Contributing

This is a learning project built for educational purposes. Contributions welcome!

## License

MIT License - feel free to use this as a template for your own educational apps.

---

**Built with love for young learners everywhere**
