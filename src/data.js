/* SmartBus shared API data layer. */

export const API_BASE = window.SMARTBUS_API_BASE || 'http://localhost:8000/api';

const resourcePaths = {
  active_trips: 'active_trips',
  announcements: 'announcements',
  bookings: 'bookings',
  buses: 'buses',
  complaints: 'complaints',
  notifications: 'notifications',
  routes: 'routes',
  seat_data: 'seat-data',
  tickets: 'tickets',
  trips: 'trips',
  users: 'users',
};

const cache = Object.fromEntries(Object.keys(resourcePaths).map(key => [key, key === 'seat_data' ? {} : []]));

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const cacheBuster = method === 'GET'
    ? `${path.includes('?') ? '&' : '?'}_=${Date.now()}`
    : '';

  const response = await fetch(`${API_BASE}${path}${cacheBuster}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store',
    ...options,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
  }
  return data;
}

function syncResource(key) {
  const path = resourcePaths[key];
  if (!path || key === 'seat_data') return;
  request(`/${path}/sync`, { method: 'POST', body: JSON.stringify(cache[key]) }).catch(console.error);
}

export const DB = {
  ready: null,

  init() {
    if (!this.ready) {
      this.ready = this.load();
    }
    return this.ready;
  },

  async load() {
    const entries = await Promise.all(
      Object.entries(resourcePaths).map(async ([key, path]) => {
        try {
          return [key, await request(`/${path}`)];
        } catch (error) {
          console.error(`Failed to load ${key}`, error);
          return [key, key === 'seat_data' ? {} : []];
        }
      }),
    );

    for (const [key, value] of entries) {
      cache[key] = value;
    }
  },

  async reload(keys = Object.keys(resourcePaths)) {
    const selectedKeys = Array.isArray(keys) ? keys : [keys];
    await Promise.all(selectedKeys.map(async key => {
      const path = resourcePaths[key];
      if (!path) return;
      try {
        cache[key] = await request(`/${path}`);
      } catch (error) {
        console.error(`Failed to reload ${key}`, error);
      }
    }));
  },

  getAll(key) {
    const data = cache[key];
    if (Array.isArray(data)) return data;
    return data && typeof data === 'object' ? data : [];
  },

  save(key, data) {
    cache[key] = data;
    if (key === 'seat_data') {
      request('/seat-data/sync', { method: 'POST', body: JSON.stringify(data) }).catch(console.error);
    } else {
      syncResource(key);
    }
  },

  getById(key, id) {
    return this.getAll(key).find(item => item.id == id) || null;
  },

  add(key, item) {
    if (!item.id && key !== 'tickets') item.id = this.nextId(key);
    cache[key] = [...this.getAll(key), item];
    const path = resourcePaths[key];
    if (path) {
      request(`/${path}`, { method: 'POST', body: JSON.stringify(item) }).catch(console.error);
    }
    return item;
  },

  async create(key, item) {
    const path = resourcePaths[key];
    if (!path) {
      return this.add(key, item);
    }

    const saved = await request(`/${path}`, {
      method: 'POST',
      body: JSON.stringify(item),
    });

    cache[key] = [...this.getAll(key).filter(existing => existing.id != saved.id), saved];
    return saved;
  },

  update(key, id, updates) {
    const list = this.getAll(key);
    const idx = list.findIndex(i => i.id == id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    cache[key] = list;
    const path = resourcePaths[key];
    if (path) {
      request(`/${path}/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }).catch(console.error);
    }
    return list[idx];
  },

  delete(key, id) {
    cache[key] = this.getAll(key).filter(i => i.id != id);
    const path = resourcePaths[key];
    if (path) {
      request(`/${path}/${id}`, { method: 'DELETE' }).catch(console.error);
    }
  },

  nextId(key) {
    const list = this.getAll(key);
    if (list.length === 0) return 1;
    return Math.max(...list.map(i => Number(i.id) || 0)) + 1;
  },

  getChatKey(driverId, passengerId) {
    return `${driverId}_${passengerId}`;
  },

  getChat(driverId, passengerId) {
    return cache[`chat_${this.getChatKey(driverId, passengerId)}`] || [];
  },

  async loadChat(driverId, passengerId) {
    const messages = await request(`/chats/${driverId}/${passengerId}`);
    cache[`chat_${this.getChatKey(driverId, passengerId)}`] = messages;
    return messages;
  },

  saveChat(driverId, passengerId, messages) {
    cache[`chat_${this.getChatKey(driverId, passengerId)}`] = messages;
  },

  sendChat(driverId, passengerId, from, message) {
    const msgs = this.getChat(driverId, passengerId);
    const msg = { from, message, time: timeNow(), date: dateToday(), read: false };
    msgs.push(msg);
    this.saveChat(driverId, passengerId, msgs);
    request(`/chats/${driverId}/${passengerId}`, { method: 'POST', body: JSON.stringify(msg) }).catch(console.error);
    return msgs;
  },

  markChatRead(driverId, passengerId, reader) {
    const msgs = this.getChat(driverId, passengerId).map(m =>
      m.from !== reader ? { ...m, read: true } : m
    );
    this.saveChat(driverId, passengerId, msgs);
  },

  unreadChatCount(driverId, passengerId, reader) {
    return this.getChat(driverId, passengerId).filter(m => !m.read && m.from !== reader).length;
  },

  async login(email, password) {
    const result = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return result.user || null;
  },

  getSession() {
    try { return JSON.parse(sessionStorage.getItem('sb_user')); }
    catch(e) { return null; }
  },

  setSession(user) {
    const safe = { ...user };
    delete safe.password;
    sessionStorage.setItem('sb_user', JSON.stringify(safe));
  },

  clearSession() {
    sessionStorage.removeItem('sb_user');
  },

  requireAuth(role) {
    const user = this.getSession();
    if (!user) { window.location.href = './index.html'; return null; }
    if (role && user.role !== role) { window.location.href = './index.html'; return null; }
    return user;
  }
};

await DB.init();

export function showToast(message, type = 'info') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const icons = { success: 'OK', error: 'Error', info: 'Info', warning: 'Warning' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || 'Info'}</span><span>${message}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeNow() {
  const d = new Date();
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

export function dateToday() {
  return new Date().toISOString().split('T')[0];
}
