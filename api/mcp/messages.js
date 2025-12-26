/**
 * LearnKids AI - MCP Messages Endpoint (ChatGPT Compatible)
 *
 * This endpoint handles POST requests for MCP messages from ChatGPT.
 * ChatGPT expects exactly: POST /mcp/messages
 *
 * Based on OpenAI's official example.
 *
 * @version 2.0.1
 */

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST to send messages.' });
  }

  try {
    console.log('[LearnKids MCP Messages] Received message:', {
      sessionId: req.query.sessionId,
      body: req.body,
    });

    // In a stateless serverless environment, we can't maintain SSE sessions
    // This is a limitation - the client needs to handle this differently
    // or we need a different architecture (Redis for session state)

    return res.status(501).json({
      error: 'Message posting not yet implemented in serverless environment',
      message: 'SSE sessions require stateful connection management',
    });
  } catch (error) {
    console.error('[LearnKids MCP Messages] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
