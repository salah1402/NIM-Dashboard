// NIM Dashboard API Client
export const API_BASE_URL = 'http://localhost:8000';

export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return await response.json();
}

export async function fetchConversations() {
  const response = await fetch(`${API_BASE_URL}/api/conversations`);
  if (!response.ok) {
    throw new Error(`Failed to load conversations: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchMessages(conversationId) {
  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`);
  if (!response.ok) {
    throw new Error(`Failed to load messages: ${response.statusText}`);
  }
  return await response.json();
}

export async function createConversation(title = 'New chat') {
  const response = await fetch(`${API_BASE_URL}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${response.statusText}`);
  }
  return await response.json();
}

export async function deleteConversation(conversationId) {
  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete conversation: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Sends a message and processes the streamed SSE response.
 */
export async function sendChatMessage({
  conversationId,
  message,
  imageB64,
  forceModel,
  mode,
  onToken,
  onToolCall,
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
        conversation_id: conversationId || undefined,
        message,
        image_b64: imageB64 || undefined,
        force_model: forceModel || undefined,
        mode: mode || 'auto',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error('Streaming not supported on this connection');
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
            if (data.event === 'tool_call' && onToolCall) {
              onToolCall(data);
            }
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

export async function fetchDashboardStats() {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/stats`);
  if (!response.ok) {
    throw new Error(`Failed to load dashboard stats: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchDashboardLogs(limit = 50) {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/logs?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to load dashboard logs: ${response.statusText}`);
  }
  return await response.json();
}

