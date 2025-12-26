/**
 * LearnKids AI - Web Frontend Handler
 *
 * Serves static files and provides API info
 * @version 2.0.0
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    transport: 'SSE',
    mcp: 'enabled'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'LearnKids AI',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      mcp: '/api/mcp',
      web: '/'
    }
  });
});

// Serve static files (web component)
app.use(express.static(path.join(__dirname, '..', 'web-component')));

// Catch-all route for SPA
app.get('*', (req, res) => {
  // Don't intercept API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'web-component', 'index.html'));
});

// Export for Vercel serverless
export default app;
