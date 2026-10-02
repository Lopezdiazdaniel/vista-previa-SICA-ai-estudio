// SICA - Core Application, Router, Web Audio Synthesizer, and PWA Lifecycle
window.App = {
  audioCtx: null,
  navHistory: [],
  currentHash: null,
  isGoingBack: false,

  pushHistory(entry) {
    if (this.isGoingBack) return;
    const last = this.navHistory[this.navHistory.length - 1];
    if (last && last.type === entry.type && last.tab === entry.tab && last.hash === entry.hash) {
      return;
    }
    this.navHistory.push(entry);
    if (this.navHistory.length > 50) this.navHistory.shift();
  },

  async init() {
    console.log('[SICA] Inicializando plataforma...');

    // 1. Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        console.log('[SICA] Service Worker registrado exitosamente con scope:', reg.scope);
      } catch (err) {
        console.warn('[SICA] No se pudo registrar Service Worker:', err);
      }
    }

    // 2. Setup Offline Network Listeners
    this.setupNetworkMonitoring();

    // 3. Setup Hash Router
    window.addEventListener('hashchange', () => this.handleRoute());

    // 4. Initial Route Dispatch
    await this.handleRoute();
  },

  setupNetworkMonitoring() {
    const banner = document.getElementById('offline-banner');
    const updateBanner = () => {
      if (!navigator.onLine) {
        if (banner) banner.classList.add('active');
      } else {
        if (banner) banner.classList.remove('active');
      }
    };

    window.addEventListener('online', () => {
      this.showToast('Conexión a internet restablecida', 'success');
      updateBanner();
      // Auto-sync pending records
      window.SICA_OFFLINE.syncAllOfflineRecords().then(r => {
        if (r.synced > 0) this.showToast(r.message, 'success');
      });
    });

    window.addEventListener('offline', () => {
      this.showToast('Sin conexión a internet. Modo Offline activo.', 'warning');
      updateBanner();
    });

    updateBanner();
  },

  async handleRoute() {
    const hash = window.location.hash || '#';
    const mainContainer = document.getElementById('app-main');
    const headerContainer = document.getElementById('app-header');
    const token = window.SICA_API.getToken();
    const storedUser = window.SICA_API.getStoredUser();

    // If not authenticated
    if (!token || !storedUser) {
      headerContainer.style.display = 'none';
      this.renderLoginScreen(mainContainer);
      return;
    }

    if (!this.isGoingBack && this.currentHash && this.currentHash !== hash) {
      this.pushHistory({ type: 'route', hash: this.currentHash });
    }
    this.currentHash = hash;

    // Show header with user profile badge
    headerContainer.style.display = 'flex';
    this.renderHeader(headerContainer, storedUser);

    // Role-based routing guard
    if (hash === '#' || hash === '#login') {
      if (storedUser.rol === 'Administrador') {
        window.location.hash = '#admin';
        return;
      } else if (storedUser.rol === 'Supervisor') {
        window.location.hash = '#supervisor';
        return;
      } else {
        window.location.hash = '#guardia';
        return;
      }
    }

    // Route dispatch
    if (hash.startsWith('#admin')) {
      if (storedUser.rol !== 'Administrador') {
        this.showToast('No tiene permisos para acceder al panel de administración', 'error');
        window.location.hash = storedUser.rol === 'Supervisor' ? '#supervisor' : '#guardia';
        return;
      }
      await window.AdminView.render(mainContainer);
    } else if (hash.startsWith('#supervisor')) {
      if (storedUser.rol !== 'Supervisor' && storedUser.rol !== 'Administrador') {
        this.showToast('No tiene permisos para acceder al módulo de supervisión', 'error');
        window.location.hash = '#guardia';
        return;
      }
      await window.SupervisorView.render(mainContainer);
    } else if (hash.startsWith('#guardia')) {
      await window.GuardiaView.render(mainContainer);
    } else if (hash.startsWith('#firestore')) {
      if (window.FirestoreView) {
        window.FirestoreView.render();
      }
    } else {
      window.location.hash = storedUser.rol === 'Administrador' ? '#admin' : storedUser.rol === 'Supervisor' ? '#supervisor' : '#guardia';
    }
  },

  renderHeader(container, user) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <button id="btn-header-back" class="btn-back" onclick="window.App.irAtras()" title="Regresar a la pantalla o sección anterior">
          <span style="font-size: 1.15rem; line-height: 1;">⬅️</span>
          <span>Atrás</span>
        </button>

        <div class="brand-wrapper" onclick="window.App.irAlInicio()">
          <div class="brand-logo">🛡️</div>
          <div class="brand-text">
            <h1>SICA</h1>
            <span>Seguridad Privada</span>
          </div>
        </div>
      </div>

      <div class="user-status-bar">
        <button class="btn-firestore" onclick="window.location.hash='#firestore'" title="Explorar y sincronizar base de datos en Cloud Firestore" style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #fbbf24; padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <span>🔥</span> Base Firestore
        </button>

        <div class="user-badge">
          <div class="user-avatar">${(user.nombre_completo || 'U').charAt(0)}</div>
          <div class="user-info-text">
            <span class="user-name">${user.nombre_completo}</span>
            <span class="user-role-tag">${user.rol}</span>
          </div>
        </div>

        <button class="btn-logout" onclick="window.SICA_API.logout()">
          Cerrar Sesión ➔
        </button>
      </div>
    `;
  },

  async irAtras() {
    const user = window.SICA_API.getStoredUser();
    if (!user) {
      window.location.hash = '#login';
      return;
    }

    // 1. If any modal dialog is open, close it immediately
    const openModals = document.querySelectorAll('.modal-overlay, .modal-backdrop');
    if (openModals.length > 0) {
      openModals.forEach(m => m.remove());
      return;
    }

    // 2. If currently viewing the Firestore module
    const isFirestore = window.location.hash === '#firestore' ||
      (window.AdminView && window.AdminView.activeTab === 'firestore') ||
      document.getElementById('firestore-info-card') !== null;

    if (isFirestore) {
      if (user.rol === 'Administrador') {
        window.location.hash = '#admin';
        if (window.AdminView) {
          window.AdminView.activeTab = 'dashboard';
          const mainContainer = document.getElementById('app-main');
          if (mainContainer) await window.AdminView.render(mainContainer);
        }
        return;
      } else if (user.rol === 'Supervisor') {
        window.location.hash = '#supervisor';
        if (window.SupervisorView) {
          window.SupervisorView.switchTab('monitoreo');
        }
        return;
      } else {
        window.location.hash = '#guardia';
        const mainContainer = document.getElementById('app-main');
        if (mainContainer && window.GuardiaView) await window.GuardiaView.render(mainContainer);
        return;
      }
    }

    // 3. Pop from navigation history stack if available
    if (this.navHistory.length > 0) {
      const prev = this.navHistory.pop();
      this.isGoingBack = true;
      try {
        if (prev.type === 'admin-tab' && user.rol === 'Administrador') {
          if (window.AdminView) {
            window.AdminView.activeTab = prev.tab;
            const mainContainer = document.getElementById('app-main');
            const tabBtn = document.querySelector(`.nav-tab-btn[data-tab="${prev.tab}"]`);
            if (tabBtn) {
              tabBtn.click();
            } else if (mainContainer) {
              await window.AdminView.render(mainContainer);
            }
          }
          return;
        } else if (prev.type === 'supervisor-tab' && (user.rol === 'Supervisor' || user.rol === 'Administrador')) {
          if (window.SupervisorView) {
            window.SupervisorView.switchTab(prev.tab);
          }
          return;
        } else if (prev.type === 'route' && prev.hash) {
          window.location.hash = prev.hash;
          return;
        }
      } finally {
        setTimeout(() => { this.isGoingBack = false; }, 100);
      }
    }

    // 4. If inside Admin view and not on dashboard tab, go to dashboard tab
    if (window.AdminView && window.AdminView.activeTab && window.AdminView.activeTab !== 'dashboard') {
      window.AdminView.activeTab = 'dashboard';
      const mainContainer = document.getElementById('app-main');
      const dashboardBtn = document.querySelector('.nav-tab-btn[data-tab="dashboard"]');
      if (dashboardBtn) {
        dashboardBtn.click();
      } else if (mainContainer) {
        await window.AdminView.render(mainContainer);
      }
      return;
    }

    // 5. If inside Supervisor view and not on monitoreo, go to monitoreo
    if (window.SupervisorView && window.SupervisorView.activeTab && window.SupervisorView.activeTab !== 'monitoreo') {
      window.SupervisorView.switchTab('monitoreo');
      return;
    }

    // 6. Native browser history fallback if available
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    // 7. Default: Return to home dashboard for current role (forced)
    this.irAlInicio(true);
  },

  irAlInicio(force = false) {
    const user = window.SICA_API.getStoredUser();
    if (!user) {
      window.location.hash = '#login';
      return;
    }
    const targetHash = user.rol === 'Administrador' ? '#admin' : user.rol === 'Supervisor' ? '#supervisor' : '#guardia';
    if (window.location.hash === targetHash) {
      if (force) this.handleRoute();
    } else {
      window.location.hash = targetHash;
      if (force) this.handleRoute();
    }
  },

  renderLoginScreen(container) {
    container.innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-header">
            <div class="shield-icon">🛡️</div>
            <h2>Plataforma SICA</h2>
            <p>Sistema de Gestión y Control de Acceso para Seguridad Privada</p>
          </div>

          <form id="login-form" onsubmit="window.App.procesarLogin(event)">
            <div class="form-group">
              <label>Correo Electrónico Institucional</label>
              <input type="email" id="login-email" class="form-input" required placeholder="usuario@sica.com" value="admin@sica.com">
            </div>

            <div class="form-group">
              <label>Contraseña Cifrada</label>
              <input type="password" id="login-password" class="form-input" required placeholder="••••••••" value="admin123">
            </div>

            <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">
              🔑 Iniciar Sesión Segura
            </button>
          </form>

          <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color); font-size: 0.8rem; color: var(--text-dim);">
            <strong style="color: var(--text-muted); display: block; margin-bottom: 6px;">Accesos Rápidos Demo:</strong>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn-secondary" style="font-size: 0.75rem; padding: 4px 8px;" onclick="window.App.fillDemo('admin@sica.com', 'admin123')">
                Administrador
              </button>
              <button class="btn-secondary" style="font-size: 0.75rem; padding: 4px 8px;" onclick="window.App.fillDemo('supervisor@sica.com', 'supervisor123')">
                Supervisor
              </button>
              <button class="btn-secondary" style="font-size: 0.75rem; padding: 4px 8px;" onclick="window.App.fillDemo('guardia@sica.com', 'guardia123')">
                Guardia Caseta
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  fillDemo(email, pass) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = pass;
  },

  async procesarLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    try {
      const res = await window.SICA_API.login(email, pass);
      this.showToast(`Bienvenido(a), ${res.user.nombre_completo}`, 'success');
      
      // Conditional redirect based on role (Section 6)
      if (res.user.rol === 'Administrador') {
        window.location.hash = '#admin';
      } else if (res.user.rol === 'Supervisor') {
        window.location.hash = '#supervisor';
      } else {
        window.location.hash = '#guardia';
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Web Audio Synthesizer for Emergency Audio Alerting (100% offline, zero dependencies)
  playEmergencyTone() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) this.audioCtx = new AudioContext();

      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.7);
    } catch (e) {
      // Audio autoplay policy
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
