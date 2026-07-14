import { API_BASE, clearToken, getToken } from './config.js';

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Cannot reach the API. Is the server running on port 4000?');
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (res.status === 401) {
    clearToken();
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

/**
 * NDJSON streaming request. onEvent receives parsed objects: status | token | evaluation | session | done | error
 */
async function streamRequest(path, { method = 'POST', body, onEvent } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/x-ndjson',
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify({ ...body, stream: true }) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the API. Is the server running on port 4000?');
  }

  if (res.status === 401) clearToken();

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data?.error || errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Streaming is not supported in this browser response');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (event.type === 'error') {
        throw new Error(event.error || 'Stream failed');
      }
      if (typeof onEvent === 'function') onEvent(event);
      if (event.type === 'done') donePayload = event;
    }
  }

  if (buffer.trim()) {
    try {
      const event = JSON.parse(buffer.trim());
      if (event.type === 'error') throw new Error(event.error || 'Stream failed');
      if (typeof onEvent === 'function') onEvent(event);
      if (event.type === 'done') donePayload = event;
    } catch (err) {
      if (err.message && !err.message.includes('JSON')) throw err;
    }
  }

  if (!donePayload) {
    throw new Error('Stream ended without a result');
  }
  return donePayload;
}

export const api = {
  signup: (body) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  signin: (body) =>
    request('/auth/signin', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  getUser: () => request('/user/me'),
  updateUser: (body) =>
    request('/user/me', { method: 'PUT', body: JSON.stringify(body) }),
  uploadResumePdf: (file) => {
    const form = new FormData();
    form.append('resume', file);
    return request('/user/me/resume-pdf', { method: 'POST', body: form });
  },
  getStats: () => request('/user/me/stats'),
  getCompanyStyles: () => request('/company-styles'),
  listSessions: () => request('/session'),
  startSession: (body, { onEvent } = {}) =>
    onEvent
      ? streamRequest('/session/start', { body, onEvent })
      : request('/session/start', { method: 'POST', body: JSON.stringify(body) }),
  resumeSession: (sessionId) =>
    request(`/session/${sessionId}/resume`, { method: 'POST' }),
  answer: (sessionId, body, { onEvent } = {}) =>
    onEvent
      ? streamRequest(`/session/${sessionId}/answer`, { body, onEvent })
      : request(`/session/${sessionId}/answer`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
  finishSession: (sessionId) =>
    request(`/session/${sessionId}/finish`, { method: 'POST' }),
  getSession: (sessionId) => request(`/session/${sessionId}`),
  runCode: (body) =>
    request('/code/run', { method: 'POST', body: JSON.stringify(body) }),
  transcribeAudio: (blob, language = 'english') => {
    const form = new FormData();
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    form.append('audio', blob, `answer.${ext}`);
    form.append('language', language);
    return request('/voice/transcribe', { method: 'POST', body: form });
  },
  shareReport: (sessionId) =>
    request(`/session/${sessionId}/share`, { method: 'POST' }),
  getSharedReport: (token) => request(`/public/report/${token}`),
};
