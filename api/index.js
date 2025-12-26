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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    transport: 'HTTP'
  });
});

// Simple test endpoint
app.get('/api', (req, res) => {
  res.json({ message: 'LearnKids AI API is running!' });
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'web-component')));

// Catch all for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web-component', 'index.html'));
});

export default app;
