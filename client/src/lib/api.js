const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || 'Ошибка запроса');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Auth API
export const auth = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
};

// Quiz API
export const quizzes = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/quizzes${qs ? `?${qs}` : ''}`);
  },
  get: (id) => request(`/quizzes/${id}`),
  create: (body) => request('/quizzes', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => request(`/quizzes/${id}`, { method: 'DELETE' }),
  addQuestion: (quizId, body) =>
    request(`/quizzes/${quizId}/questions`, { method: 'POST', body: JSON.stringify(body) }),
  updateQuestion: (quizId, qid, body) =>
    request(`/quizzes/${quizId}/questions/${qid}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteQuestion: (quizId, qid) =>
    request(`/quizzes/${quizId}/questions/${qid}`, { method: 'DELETE' }),
};

// Session API
export const sessions = {
  create: (body) => request('/sessions', { method: 'POST', body: JSON.stringify(body) }),
  get: (roomCode) => request(`/sessions/${roomCode}`),
  join: (roomCode, body = {}) =>
    request(`/sessions/${roomCode}/join`, { method: 'POST', body: JSON.stringify(body) }),
  results: (roomCode) => request(`/sessions/${roomCode}/results`),
};

// User API
export const users = {
  history: () => request('/users/me/history'),
  stats: () => request('/users/me/stats'),
};

export default { auth, quizzes, sessions, users };
