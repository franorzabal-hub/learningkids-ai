/**
 * Health check endpoint
 */

export default function handler(req, res) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    transport: 'SSE',
    mcp: 'enabled'
  });
}
