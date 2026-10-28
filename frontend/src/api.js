// NIM Dashboard API Client
// Points directly at http://localhost:8000 (also proxied via Vite at :5173)
export const API_BASE_URL = 'http://localhost:8000';

/**
 * Sends a message and processes the streamed SSE response.
 * @param {Object} options
 * @param {string} [options.conversationId]
 * @param {string} options.message
 * @param {function(string): void} options.onToken
 * @param {function(Object): void} options.onComplete
 * @param {function(Error): void} options.onError
 */
export async function sendChatMessage({
  conversationId,
  message,
  onToken,
  onComplete,
  onError,
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null or streaming not supported');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const data = JSON.parse(jsonStr);
            if (data.token) {
              onToken(data.token);
            }
            if (data.done && onComplete) {
              onComplete(data);
            }
          } catch (err) {
            console.error('Error parsing SSE payload:', err, jsonStr);
          }
        }
      }
    }
  } catch (error) {
    if (onError) {
      onError(error);
    } else {
      console.error('Failed to send chat message:', error);
    }
  }
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return await response.json();
}
