/**
 * LearnKids AI - Main API endpoint
 * Returns API information
 */

export default function handler(req, res) {
  res.status(200).json({
    name: 'LearnKids AI',
    version: '2.0.0',
    description: 'Interactive learning platform for kids',
    mcp: {
      endpoint: '/api',
      transport: 'SSE',
      tools: ['getCourses', 'getCourse', 'getLesson', 'checkAnswer']
    },
    endpoints: {
      health: '/api/health',
      mcp: '/api (dynamic routing with [transport] pattern)',
      web: '/'
    },
    documentation: 'https://github.com/franorzabal-hub/learningkids-ai'
  });
}
