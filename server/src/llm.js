function requireEnv(name) {
  const value = process.env[name];
  if (!value || value === 'your-api-key-here' || value === 'paste-your-groq-api-key-here') {
    throw Object.assign(new Error(`Missing ${name}. Add it to server/.env and restart.`), {
      status: 500,
    });
  }
  return value;
}

function stripJsonFences(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function friendlyLlmError(status, errText) {
  if (status === 401 || status === 403) {
    return 'LLM rejected the API key. Check LLM_API_KEY in server/.env.';
  }
  if (status === 429) {
    return 'LLM rate limit hit. Wait a moment and try again.';
  }
  if (status >= 500) {
    return 'LLM provider is having issues. Try again shortly.';
  }
  const short = String(errText || '').slice(0, 240);
  return `LLM request failed (${status})${short ? `: ${short}` : ''}`;
}

export async function chatCompletion({ messages, json = false, temperature = 0.4 }) {
  const apiKey = requireEnv('LLM_API_KEY');
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  const body = {
    model,
    messages,
    temperature,
  };

  if (json) {
    body.response_format = { type: 'json_object' };
  }

  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw Object.assign(new Error(`Could not reach LLM provider: ${err.message}`), {
      status: 502,
    });
  }

  if (!res.ok) {
    const errText = await res.text();
    throw Object.assign(new Error(friendlyLlmError(res.status, errText)), { status: 502 });
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw Object.assign(new Error('LLM returned an empty response. Try again.'), { status: 502 });
  }

  return content.trim();
}

export async function chatJson(options) {
  const content = await chatCompletion({ ...options, json: true });
  try {
    return JSON.parse(stripJsonFences(content));
  } catch (err) {
    throw Object.assign(
      new Error('LLM returned invalid JSON. Try submitting again.'),
      { status: 502 },
    );
  }
}

/**
 * Stream chat completion tokens. Calls onToken(delta) for each piece.
 * Returns the full assembled text.
 */
export async function chatCompletionStream({ messages, temperature = 0.4, onToken }) {
  const apiKey = requireEnv('LLM_API_KEY');
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: true,
      }),
    });
  } catch (err) {
    throw Object.assign(new Error(`Could not reach LLM provider: ${err.message}`), {
      status: 502,
    });
  }

  if (!res.ok) {
    const errText = await res.text();
    throw Object.assign(new Error(friendlyLlmError(res.status, errText)), { status: 502 });
  }

  if (!res.body) {
    // Provider did not return a stream — fall back to non-streaming.
    const data = await res.json();
    const content = String(data.choices?.[0]?.message?.content || '').trim();
    if (content && typeof onToken === 'function') onToken(content);
    return content;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          if (typeof onToken === 'function') onToken(delta);
        }
      } catch {
        // ignore partial JSON lines
      }
    }
  }

  return full.trim();
}
