/**
 * LearnKids AI - Main API endpoint
 * Returns API information
 */

export default function handler(req, res) {
  res.status(200).json({
    name: 'LearnKids AI',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      mcp: '/api/mcp',
      test: '/api/test',
      web: '/'
    },
    documentation: 'https://github.com/franorzabal-hub/learningkids-ai'
  });
}
