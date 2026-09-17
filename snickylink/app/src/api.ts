import AsyncStorage from '@react-native-async-storage/async-storage';

const K_SERVER = 'snickylink.server.v1';
const K_SESSION = 'snickylink.session.v1';

export const DEFAULT_SERVER = 'http://192.168.1.5:3001';

let serverUrl = DEFAULT_SERVER;
let accessToken: string | null = null;
let refreshToken: string | null = null;

export async function loadSession() {
  const [s, sess] = await Promise.all([
    AsyncStorage.getItem(K_SERVER),
    AsyncStorage.getItem(K_SESSION),
  ]);
  if (s) serverUrl = s;
  if (sess) {
    const parsed = JSON.parse(sess);
    accessToken = parsed.accessToken;
    refreshToken = parsed.refreshToken;
    return parsed;
  }
  return null;
}

export const getServer = () => serverUrl;
export async function setServer(url: string) {
  serverUrl = url.replace(/\/+$/, '');
  await AsyncStorage.setItem(K_SERVER, serverUrl);
}

export async function saveSession(s: { accessToken: string; refreshToken?: string; user: any }) {
  accessToken = s.accessToken;
  if (s.refreshToken) refreshToken = s.refreshToken;
  await AsyncStorage.setItem(
    K_SESSION,
    JSON.stringify({ accessToken, refreshToken, user: s.user })
  );
}

export async function clearSession() {
  accessToken = null;
  refreshToken = null;
  await AsyncStorage.removeItem(K_SESSION);
}

async function request(path: string, opts: any = {}, retry = true): Promise<any> {
  const headers: any = { ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(serverUrl + path, {
      ...opts,
      headers,
      body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error(
      'Server tak nahi pahuncha. IP check karo, backend chal raha hai ya nahi, aur phone same Wi-Fi pe hai ya nahi.'
    );
  }

  // One silent refresh attempt before bouncing the user to login.
  if (res.status === 401 && retry && refreshToken) {
    const rr = await fetch(serverUrl + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (rr.ok) {
      const data = await rr.json();
      await saveSession({ accessToken: data.accessToken, user: data.user });
      return request(path, opts, false);
    }
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json.error || `http_${res.status}`);
  return json;
}

export const api = {
  health: () => request('/health'),
  register: (body: any) => request('/auth/register', { method: 'POST', body }),
  login: (body: any) => request('/auth/login', { method: 'POST', body }),
  otpStart: (email: string) => request('/auth/otp/start', { method: 'POST', body: { email } }),
  otpVerify: (body: any) => request('/auth/otp/verify', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => request('/me'),
  coupleStatus: () => request('/couples/status'),
  invite: () =>
    request('/couples/invite', {
      method: 'POST',
      body: { tzOffset: -new Date().getTimezoneOffset() },
    }),
  join: (code: string) => request('/couples/join', { method: 'POST', body: { code } }),
  dailySnicks: () => request('/daily-snicks'),
  snick: (id: string) => request(`/snicks/${id}`),
  submit: (id: string, body: any) => request(`/snicks/${id}/submit`, { method: 'POST', body }),
  confirm: (id: string) => request(`/submissions/${id}/confirm`, { method: 'POST' }),
  stats: () => request('/stats'),
  notifications: () => request('/notifications'),
  leaderboard: () => request('/leaderboard'),
  // chat
  messages: (since = 0) => request(`/messages?since=${since}`),
  sendMessage: (body: any) => request('/messages', { method: 'POST', body }),
  markRead: () => request('/messages/read', { method: 'POST' }),

  // memories
  memories: () => request('/memories'),
  createMemory: (body: any) => request('/memories', { method: 'POST', body }),
  deleteMemory: (id: string) => request(`/memories/${id}`, { method: 'DELETE' }),

  // calendar
  calendar: () => request('/calendar'),
  createEvent: (body: any) => request('/calendar', { method: 'POST', body }),
  deleteEvent: (id: string) => request(`/calendar/${id}`, { method: 'DELETE' }),

  // community + moderation
  feed: () => request('/community/feed'),
  ourWall: () => request('/community/ours'),
  createPost: (body: any) => request('/community/posts', { method: 'POST', body }),
  reactToPost: (id: string, emoji: string | null) =>
    request(`/community/posts/${id}/react`, { method: 'POST', body: { emoji } }),
  deletePost: (id: string) => request(`/community/posts/${id}`, { method: 'DELETE' }),
  report: (body: any) => request('/reports', { method: 'POST', body }),

  // search + emoji
  search: (q: string, scope = 'all') =>
    request(`/search?q=${encodeURIComponent(q)}&scope=${scope}`),
  emojis: () => request('/emojis'),

  uploadPhoto: async (uri: string) => {
    const fd = new FormData();
    fd.append('file', { uri, name: 'snick.jpg', type: 'image/jpeg' } as any);
    return request('/media', { method: 'POST', body: fd });
  },
  mediaUrl: (id: string) => `${serverUrl}/media/${id}`,
};
