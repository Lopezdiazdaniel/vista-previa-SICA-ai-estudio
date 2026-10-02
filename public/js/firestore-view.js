/**
 * SICA - Vista y Administrador de Firestore
 * Permite explorar colecciones, sincronizar datos y monitorear documentos en tiempo real
 */

window.FirestoreView = {
  activeCollection: 'servicios',
  isSyncing: false,

  render() {
    const main = document.getElementById('app-main');
    if (!main) return;

    const user = window.SICA_FIRESTORE ? window.SICA_FIRESTORE.getCurrentUser() : null;

    main.innerHTML = `
      <div class="view-container">
        <!-- Encabezado de la Vista Firestore -->
        <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span>🔥</span> Base de Datos en la Nube: Cloud Firestore
            </h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Base de datos privada y exclusiva para <strong>lopzcecy@gmail.com</strong>
            </p>
          </div>
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            ${user ? `
              <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; color: #34d399; display: flex; align-items: center; gap: 6px;">
                <span>🟢 Propietario Conectado: <strong>${user.email}</strong></span>
                <button onclick="window.FirestoreView.handleLogout()" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 0.8rem; margin-left: 8px; text-decoration: underline;">Desconectar</button>
              </div>
            ` : `
              <button onclick="window.FirestoreView.handleGoogleLogin()" class="btn-primary" style="background: #ffffff; color: #1e293b; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer;" title="Conectar exclusivamente con la cuenta lopzcecy@gmail.com">
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                Conectar mi Cuenta (lopzcecy@gmail.com)
              </button>
            `}
            <button onclick="window.FirestoreView.syncDatabase()" id="btn-sync-firestore" class="btn-primary" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; padding: 8px 16px; border-radius: var(--radius-sm); border: none; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <span>⚡</span> Sincronizar Todo a Firestore
            </button>
          </div>
        </div>

        <!-- Banner de Diagnóstico y Métricas de Conexión -->
        <div id="firestore-info-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 44px; height: 44px; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                🔥
              </div>
              <div>
                <div style="font-weight: 800; font-size: 1.05rem; color: #fff; display: flex; align-items: center; gap: 8px;">
                  Firestore Provisionado & Activo
                  <span style="background: #065f46; color: #34d399; font-size: 0.75rem; padding: 2px 8px; border-radius: 9999px;">Conectado</span>
                </div>
                <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 2px;">
                  Base de datos ID: <code style="color: #38bdf8; background: #0f172a; padding: 2px 6px; border-radius: 4px;">ai-studio-vistapreviasicaa-c2db510c-ef2c-45ac-b317-3c25be3b8921</code>
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button onclick="window.FirestoreView.testConnection()" style="background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-color); padding: 6px 14px; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                Comprobar Conexión
              </button>
              <button onclick="window.FirestoreView.loadStats()" style="background: var(--bg-surface); color: #38bdf8; border: 1px solid #0284c7; padding: 6px 14px; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                Actualizar Métricas
              </button>
            </div>
          </div>
          <div id="sync-progress-msg" style="margin-top: 12px; font-size: 0.85rem; color: #f59e0b; display: none;"></div>
        </div>

        <!-- Tarjetas de Colecciones en Firestore -->
        <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 12px;">Colecciones de SICA en Firestore</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 24px;">
          ${this.renderCollectionCard('servicios', '🏢 Inmuebles / Casetas', 'Colección de servicios custodiados')}
          ${this.renderCollectionCard('usuarios', '👮 Personal y Guardias', 'Perfiles y asignaciones de seguridad')}
          ${this.renderCollectionCard('accesos', '🚗 Accesos Vehiculares', 'Bitácora vehicular y peatonal')}
          ${this.renderCollectionCard('bitacoras', '🚨 Bitácora y Emergencias', 'Eventos, rondines e incidencias')}
          ${this.renderCollectionCard('consignas', '📋 Consignas Operativas', 'Órdenes de servicio y consignas')}
          ${this.renderCollectionCard('asignaciones_turno', '⏰ Turnos y Cuadrantes', 'Asignación de turnos operativos')}
        </div>

        <!-- Visor y Explorador de Documentos de Firestore -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                <span>📂</span> Documentos en Colección: <span id="current-collection-title" style="color: #38bdf8;">/${this.activeCollection}</span>
              </h3>
              <p style="color: var(--text-muted); font-size: 0.8rem;">Consulta los documentos persistidos en la base de datos de Google Cloud Firestore</p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button onclick="window.FirestoreView.createTestDocument()" style="background: #10b981; color: #fff; border: none; padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                + Agregar Documento de Prueba
              </button>
              <button onclick="window.FirestoreView.fetchCurrentCollection()" style="background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; cursor: pointer;">
                Recargar
              </button>
            </div>
          </div>

          <div id="firestore-docs-container" style="min-height: 200px;">
            <div style="display: flex; align-items: center; justify-content: center; height: 180px; color: var(--text-muted);">
              Cargando documentos de Firestore...
            </div>
          </div>
        </div>
      </div>
    `;

    // Automatically load docs for active collection
    this.fetchCurrentCollection();
  },

  renderCollectionCard(colName, label, description) {
    const isActive = this.activeCollection === colName;
    return `
      <div onclick="window.FirestoreView.selectCollection('${colName}')" style="background: ${isActive ? 'var(--bg-surface)' : 'var(--bg-card)'}; border: 1.5px solid ${isActive ? '#0284c7' : 'var(--border-color)'}; border-radius: var(--radius-md); padding: 14px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor='${isActive ? '#0284c7' : 'var(--border-color)'}'">
        <div style="font-weight: 800; color: #fff; font-size: 0.95rem; margin-bottom: 4px;">${label}</div>
        <div style="color: var(--text-muted); font-size: 0.75rem; margin-bottom: 8px;">${description}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;">
          <span style="color: #38bdf8;">/${colName}</span>
          <span style="color: #10b981; font-weight: 700;">Ver docs →</span>
        </div>
      </div>
    `;
  },

  selectCollection(colName) {
    this.activeCollection = colName;
    const titleEl = document.getElementById('current-collection-title');
    if (titleEl) titleEl.innerText = `/${colName}`;
    this.render();
  },

  async handleGoogleLogin() {
    if (!window.SICA_FIRESTORE) {
      window.App.showToast('El módulo de Firestore aún se está inicializando', 'warning');
      return;
    }
    try {
      window.App.showToast('Iniciando ventana de autenticación con Google...', 'info');
      const user = await window.SICA_FIRESTORE.loginWithGoogle();
      window.App.showToast(`¡Bienvenido, ${user.displayName || user.email}!`, 'success');
      this.render();
    } catch (err) {
      window.App.showToast(`Error al iniciar sesión: ${err.message}`, 'danger');
    }
  },

  async handleLogout() {
    if (window.SICA_FIRESTORE) {
      await window.SICA_FIRESTORE.logoutGoogle();
      window.App.showToast('Sesión de Google cerrada', 'info');
      this.render();
    }
  },

  async testConnection() {
    try {
      window.App.showToast('Comprobando conexión con Firestore...', 'info');
      const ok = await window.SICA_FIRESTORE.testConnection();
      if (ok) {
        window.App.showToast('¡Conexión verificada exitosamente con Firestore!', 'success');
      } else {
        window.App.showToast('No se pudo establecer conexión con Firestore', 'danger');
      }
    } catch (e) {
      window.App.showToast(`Error de prueba: ${e.message}`, 'danger');
    }
  },

  async syncDatabase() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    const btn = document.getElementById('btn-sync-firestore');
    const msg = document.getElementById('sync-progress-msg');

    if (btn) btn.disabled = true;
    if (msg) {
      msg.style.display = 'block';
      msg.innerText = 'Iniciando sincronización con Firestore...';
    }

    try {
      // Check if user is logged in
      const currentUser = window.SICA_FIRESTORE.getCurrentUser();
      if (!currentUser) {
        window.App.showToast('Se requiere autenticación con Google para escribir en Firestore según las reglas de seguridad.', 'warning');
        await this.handleGoogleLogin();
      }

      const res = await window.SICA_FIRESTORE.seedAllToFirestore((status) => {
        if (msg) msg.innerText = status;
      });

      if (res && res.ok) {
        window.App.showToast('¡Base de datos en Firestore sincronizada con éxito!', 'success');
        if (msg) {
          msg.innerHTML = `✅ Sincronización exitosa: ${res.summary.servicios} servicios, ${res.summary.consignas} consignas, ${res.summary.accesos} accesos, ${res.summary.bitacoras} bitácoras.`;
        }
        this.fetchCurrentCollection();
      }
    } catch (err) {
      console.error('Error al sincronizar:', err);
      window.App.showToast(`Error de sincronización: ${err.message}`, 'danger');
      if (msg) msg.innerText = `❌ Error: ${err.message}`;
    } finally {
      this.isSyncing = false;
      if (btn) btn.disabled = false;
    }
  },

  async fetchCurrentCollection() {
    const container = document.getElementById('firestore-docs-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 160px; color: var(--text-muted);">
        <div style="text-align: center;">
          <div style="font-size: 1.5rem; margin-bottom: 8px;">⏳</div>
          <div>Consultando documentos de Firestore en tiempo real...</div>
        </div>
      </div>
    `;

    try {
      const docs = await window.SICA_FIRESTORE.getCollectionDocs(this.activeCollection);

      if (!docs || docs.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-sm);">
            <div style="font-size: 2rem; margin-bottom: 8px;">📭</div>
            <div style="font-weight: 700; color: #fff; margin-bottom: 4px;">Colección vacía en Firestore</div>
            <div style="font-size: 0.85rem; margin-bottom: 16px;">Aún no hay documentos en <code>/${this.activeCollection}</code></div>
            <button onclick="window.FirestoreView.syncDatabase()" style="background: #0284c7; color: #fff; border: none; padding: 8px 16px; border-radius: var(--radius-sm); font-weight: 700; cursor: pointer;">
              Sincronizar Datos Iniciales Ahora
            </button>
          </div>
        `;
        return;
      }

      let html = `
        <div style="margin-bottom: 12px; font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between;">
          <span>Total documentos encontrados: <strong>${docs.length}</strong></span>
          <span style="color: #10b981;">● Datos en vivo</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
      `;

      docs.forEach((d) => {
        const docId = d._id;
        const keys = Object.keys(d).filter(k => k !== '_id');
        html += `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
              <span style="font-weight: 800; font-family: monospace; color: #38bdf8;">Documento ID: ${docId}</span>
              <span style="font-size: 0.75rem; background: #0f172a; padding: 2px 8px; border-radius: 4px; color: var(--text-muted);">${keys.length} campos</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; font-size: 0.85rem;">
              ${keys.slice(0, 6).map(k => `
                <div>
                  <span style="color: var(--text-muted); font-size: 0.75rem;">${k}:</span>
                  <div style="color: #fff; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${typeof d[k] === 'object' ? JSON.stringify(d[k]) : d[k]}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 20px; border-radius: var(--radius-sm); color: #f87171;">
          <div style="font-weight: 700; margin-bottom: 6px;">Error al consultar Firestore:</div>
          <div style="font-size: 0.85rem; font-family: monospace;">${err.message}</div>
          <div style="margin-top: 12px; font-size: 0.8rem; color: var(--text-muted);">
            Sugerencia: Inicia sesión con Google usando el botón superior para autorizar lectura/escritura conforme a las reglas de seguridad.
          </div>
        </div>
      `;
    }
  },

  async createTestDocument() {
    try {
      const currentUser = window.SICA_FIRESTORE.getCurrentUser();
      if (!currentUser) {
        window.App.showToast('Iniciando sesión con Google para crear documento...', 'info');
        await this.handleGoogleLogin();
      }

      if (this.activeCollection === 'accesos') {
        await window.SICA_FIRESTORE.addAccessToFirestore({
          id_servicio: 1,
          id_guardia: 1,
          tipo_movimiento: 'Entrada',
          tipo_visitante: 'Vehículo',
          nombre_visitante: 'Prueba Firestore en Vivo ' + new Date().toLocaleTimeString(),
          placas: 'FS-2026-LIVE',
          motivo_o_destino: 'Inspección de base de datos Firestore',
          fecha_hora: new Date().toISOString()
        });
      } else if (this.activeCollection === 'bitacoras') {
        await window.SICA_FIRESTORE.addLogbookToFirestore({
          id_servicio: 1,
          id_guardia: 1,
          tipo_evento: 'Rondín',
          descripcion: 'Rondín de verificación registrado directamente en Firestore a las ' + new Date().toLocaleTimeString(),
          nivel_prioridad: 'Baja',
          atendida_supervisor: 0,
          fecha_hora_registro: new Date().toISOString()
        });
      } else {
        const testId = `test_${Date.now()}`;
        const db = window.SICA_FIRESTORE.getDb();
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        await setDoc(doc(db, this.activeCollection, testId), {
          nombre_cliente_o_lugar: 'Inmueble de Prueba Firestore ' + testId,
          tipo_servicio: 'Corporativo',
          estatus: 'Activo',
          fecha_creacion: new Date().toISOString()
        });
      }

      window.App.showToast(`¡Documento de prueba añadido exitosamente a /${this.activeCollection}!`, 'success');
      this.fetchCurrentCollection();
    } catch (err) {
      window.App.showToast(`Error al crear documento: ${err.message}`, 'danger');
    }
  },

  loadStats() {
    this.fetchCurrentCollection();
  }
};
