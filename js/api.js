// SICA - Frontend API Client with Offline Interceptor
(function () {
  const API_BASE = '/api';

  function getToken() {
    return localStorage.getItem('sica_token');
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem('sica_token', token);
    } else {
      localStorage.removeItem('sica_token');
    }
  }

  function getStoredUser() {
    try {
      const u = localStorage.getItem('sica_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  }

  function setStoredUser(user) {
    if (user) {
      localStorage.setItem('sica_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sica_user');
    }
  }

  async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = options.headers || {};
    const token = getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, { ...options, headers });

      if (res.status === 401) {
        // Token expired or invalid
        setToken(null);
        setStoredUser(null);
        window.location.hash = '#login';
        throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}: ${res.statusText}`);
      }

      return data;
    } catch (error) {
      // If network failure
      if (error.name === 'TypeError' || error.message.includes('fetch') || !navigator.onLine) {
        error.isNetworkError = true;
      }
      throw error;
    }
  }

  const SICA_API = {
    getToken,
    setToken,
    getStoredUser,
    setStoredUser,

    // Auth
    async login(correo_electronico, contrasena) {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ correo_electronico, contrasena })
      });
      setToken(res.token);
      setStoredUser(res.user);
      return res;
    },

    async getMe() {
      const res = await request('/auth/me');
      setStoredUser(res.user);
      return res.user;
    },

    logout() {
      setToken(null);
      setStoredUser(null);
      window.location.hash = '#login';
    },

    // Users & Digital Dossiers
    getUsers(params = {}) {
      const q = new URLSearchParams(params).toString();
      return request(`/users?${q}`);
    },

    getUser(id) {
      return request(`/users/${id}`);
    },

    createUser(data) {
      return request('/users', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    updateUser(id, data) {
      return request(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    deleteUser(id) {
      return request(`/users/${id}`, { method: 'DELETE' });
    },

    uploadExpediente(userId, formData) {
      return request(`/users/${userId}/expediente`, {
        method: 'POST',
        body: formData
      });
    },

    getExpedientes(userId) {
      return request(`/users/${userId}/expediente`);
    },

    deleteExpediente(userId, docId) {
      return request(`/users/${userId}/expediente/${docId}`, { method: 'DELETE' });
    },

    // Services (Inmuebles / Casetas)
    getServices(params = {}) {
      const q = new URLSearchParams(params).toString();
      return request(`/services?${q}`);
    },

    getService(id) {
      return request(`/services/${id}`);
    },

    createService(data) {
      return request('/services', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    updateService(id, data) {
      return request(`/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    deleteService(id) {
      return request(`/services/${id}`, { method: 'DELETE' });
    },

    // Shifts
    getShifts(params = {}) {
      const q = new URLSearchParams(params).toString();
      return request(`/shifts?${q}`);
    },

    createShift(data) {
      return request('/shifts', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    deleteShift(id) {
      return request(`/shifts/${id}`, { method: 'DELETE' });
    },

    // Access Control with Offline Fallback
    getAccesos(params = {}) {
      const q = new URLSearchParams(params).toString();
      return request(`/access?${q}`);
    },

    async createAcceso(payload) {
      // Check offline status first
      if (!navigator.onLine) {
        const offlineRecord = await window.SICA_OFFLINE.saveOfflineAcceso(payload);
        return {
          offline: true,
          message: 'Registro guardado localmente (Modo Fuera de Línea). Se sincronizará al reconectar.',
          record: offlineRecord
        };
      }

      try {
        let options = { method: 'POST' };
        if (payload instanceof FormData) {
          options.body = payload;
        } else {
          options.body = JSON.stringify(payload);
        }
        return await request('/access', options);
      } catch (err) {
        if (err.isNetworkError) {
          const plainData = payload instanceof FormData ? Object.fromEntries(payload.entries()) : payload;
          const offlineRecord = await window.SICA_OFFLINE.saveOfflineAcceso(plainData);
          return {
            offline: true,
            message: 'Falla de red: Guardado localmente en modo Offline.',
            record: offlineRecord
          };
        }
        throw err;
      }
    },

    syncAccesos(registros) {
      return request('/access/batch-sync', {
        method: 'POST',
        body: JSON.stringify({ registros })
      });
    },

    // Digital Logbook with Offline Fallback & Emergency Alerting
    getBitacoras(params = {}) {
      const q = new URLSearchParams(params).toString();
      return request(`/logbook?${q}`);
    },

    getActiveEmergencies() {
      return request('/logbook/emergencies/active');
    },

    async createBitacora(payload) {
      if (!navigator.onLine) {
        const offlineRecord = await window.SICA_OFFLINE.saveOfflineBitacora(payload);
        return {
          offline: true,
          message: 'Novedad guardada localmente (Modo Fuera de Línea).',
          record: offlineRecord
        };
      }

      try {
        let options = { method: 'POST' };
        if (payload instanceof FormData) {
          options.body = payload;
        } else {
          options.body = JSON.stringify(payload);
        }
        return await request('/logbook', options);
      } catch (err) {
        if (err.isNetworkError) {
          const plainData = payload instanceof FormData ? Object.fromEntries(payload.entries()) : payload;
          const offlineRecord = await window.SICA_OFFLINE.saveOfflineBitacora(plainData);
          return {
            offline: true,
            message: 'Falla de red: Evento guardado localmente en modo Offline.',
            record: offlineRecord
          };
        }
        throw err;
      }
    },

    syncBitacoras(registros) {
      return request('/logbook/batch-sync', {
        method: 'POST',
        body: JSON.stringify({ registros })
      });
    },

    atenderBitacora(id, notas_supervisor) {
      return request(`/logbook/${id}/atender`, {
        method: 'PUT',
        body: JSON.stringify({ notas_supervisor })
      });
    },

    // Consignas
    getConsignas(params = {}) {
      const q = new URLSearchParams(params).toString();
      return request(`/consignas?${q}`);
    },

    createConsigna(data) {
      return request('/consignas', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    updateConsigna(id, data) {
      return request(`/consignas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    deleteConsigna(id) {
      return request(`/consignas/${id}`, { method: 'DELETE' });
    },

    // Reports & Dashboard
    getDashboardMetrics(id_servicio) {
      const q = id_servicio ? `?id_servicio=${id_servicio}` : '';
      return request(`/reports/dashboard${q}`);
    },

    getExcelExportUrl(params = {}) {
      const cleanParams = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== '' && v !== null && v !== undefined) cleanParams[k] = v;
      }
      const token = getToken();
      if (token) cleanParams.token = token;
      const q = new URLSearchParams(cleanParams).toString();
      return `${API_BASE}/reports/export/excel?${q}`;
    },

    getCsvExportUrl(params = {}) {
      const cleanParams = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== '' && v !== null && v !== undefined) cleanParams[k] = v;
      }
      const token = getToken();
      if (token) cleanParams.token = token;
      const q = new URLSearchParams(cleanParams).toString();
      return `${API_BASE}/reports/export/csv?${q}`;
    },

    async downloadExport(url, defaultFilename = 'reporte_sica.xlsx') {
      const token = getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al descargar el archivo de reporte');
      }

      const blob = await res.blob();
      let filename = defaultFilename;
      const disposition = res.headers.get('content-disposition');
      if (disposition) {
        const match = disposition.match(/filename=["']?([^"']+)["']?/);
        if (match && match[1]) filename = match[1];
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      return filename;
    }
  };

  window.SICA_API = SICA_API;
})();
