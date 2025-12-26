/**
 * Minimal test serverless function
 */

import express from 'express';

const app = express();

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Test successful' });
});

export default app;
