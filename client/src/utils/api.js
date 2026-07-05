// Helper to make API requests with Authorization token
const API_URL = ''; // Proxied via Vite dev server, in prod it is same host

let token = localStorage.getItem('token') || '';
let user = null;
try {
  user = JSON.parse(localStorage.getItem('user') || 'null');
} catch (e) {
  // Ignore
}

export function setAuth(newToken, newUser) {
  token = newToken;
  user = newUser;
  if (newToken) {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

export function getAuthToken() {
  return token;
}

export function getAuthUser() {
  return user;
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Bir hata oluştu.');
  }

  return data;
}

export const api = {
  auth: {
    login: async (email, password) => {
      const data = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setAuth(data.token, data.user);
      return data;
    },
    logout: () => {
      setAuth('', null);
    },
    me: async () => {
      try {
        const data = await request('/api/auth/me');
        setAuth(token, data.user); // update user info
        return data.user;
      } catch (error) {
        setAuth('', null);
        throw error;
      }
    }
  },
  users: {
    list: () => request('/api/users'),
    getDashboardStats: () => request('/api/users/dashboard-stats'),
    create: (userData) => request('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    toggleStatus: (id, currentStatus) => {
      const newStatus = currentStatus === 'ACTIVE' ? 'PASSIVE' : 'ACTIVE';
      return request(`/api/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
    },
    delete: (id) => request(`/api/users/${id}`, {
      method: 'DELETE'
    }),
    downloadDatabase: async () => {
      const response = await fetch('/api/users/download-db', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Veritabanı yedeği indirilemedi.');
      }
      return response.blob();
    },
    getAuditLogs: () => request('/api/users/audit-logs')
  },
  members: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.district) query.append('district', params.district);
      if (params.role) query.append('role', params.role);
      if (params.search) query.append('search', params.search);
      return request(`/api/members?${query.toString()}`);
    },
    create: (memberData) => request('/api/members', {
      method: 'POST',
      body: JSON.stringify(memberData)
    }),
    update: (id, memberData) => request(`/api/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(memberData)
    }),
    delete: (id) => request(`/api/members/${id}`, {
      method: 'DELETE'
    }),
    getTimeline: (id) => request(`/api/members/${id}/timeline`),
    addTimeline: (id, eventData) => request(`/api/members/${id}/timeline`, {
      method: 'POST',
      body: JSON.stringify(eventData)
    })
  },
  uploads: {
    upload: async (file, district) => {
      const formData = new FormData();
      formData.append('excel', file);
      formData.append('district', district);

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/uploads`, {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Excel yüklenemedi.');
      }
      return data;
    },
    status: (id) => request(`/api/uploads/status?id=${id}`),
    list: () => request('/api/uploads/status'),
    analyze: async (file) => {
      const formData = new FormData();
      formData.append('excel', file);

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/uploads/analyze`, {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Excel dosyası analiz edilemedi.');
      }
      return data;
    },
    import: (tempFileId, district, mapping) => request('/api/uploads/import', {
      method: 'POST',
      body: JSON.stringify({ tempFileId, district, mapping })
    })
  }
};
