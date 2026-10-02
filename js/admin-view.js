// SICA - Módulo de Administración (Admin View)
window.AdminView = {
  activeTab: 'dashboard',
  currentUserIdForDossier: null,

  async render(container) {
    container.innerHTML = `
      <div class="nav-tabs" id="admin-tabs">
        <button class="nav-tab-btn ${this.activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
          📊 Panel de Control
        </button>
        <button class="nav-tab-btn ${this.activeTab === 'accesos' ? 'active' : ''}" data-tab="accesos">
          🚪 Control de Accesos
        </button>
        <button class="nav-tab-btn ${this.activeTab === 'bitacoras' ? 'active' : ''}" data-tab="bitacoras">
          📝 Bitácora de Novedades
        </button>
        <button class="nav-tab-btn ${this.activeTab === 'personal' ? 'active' : ''}" data-tab="personal">
          👮 Personal y Expedientes
        </button>
        <button class="nav-tab-btn ${this.activeTab === 'servicios' ? 'active' : ''}" data-tab="servicios">
          🏢 Inmuebles y Casetas
        </button>
        <button class="nav-tab-btn ${this.activeTab === 'turnos' ? 'active' : ''}" data-tab="turnos">
          ⏱️ Turnos
        </button>
        <button class="nav-tab-btn ${this.activeTab === 'consignas' ? 'active' : ''}" data-tab="consignas">
          📋 Consignas
        </button>
        <button class="nav-tab-btn ${this.activeTab === 'reportes' ? 'active' : ''}" data-tab="reportes">
          📑 Reportes y Auditoría
        </button>
        <button class="nav-tab-btn ${this.activeTab === 'firestore' ? 'active' : ''}" data-tab="firestore" style="color: #fbbf24; font-weight: 700;">
          🔥 Base Firestore
        </button>
      </div>
      <div id="admin-tab-content" style="padding: 1.5rem; max-width: 1400px; margin: 0 auto; width: 100%;">
        <!-- Dynamic Content -->
      </div>
    `;

    // Tab switcher events
    const tabBtns = container.querySelectorAll('.nav-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const newTab = btn.getAttribute('data-tab');
        if (this.activeTab !== newTab) {
          if (window.App && window.App.pushHistory) {
            window.App.pushHistory({ type: 'admin-tab', tab: this.activeTab });
          }
        }
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = newTab;
        this.renderTabContent();
      });
    });

    await this.renderTabContent();
  },

  async renderTabContent() {
    const tabContent = document.getElementById('admin-tab-content');
    if (!tabContent) return;

    tabContent.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-dim);">Cargando módulo...</div>`;

    switch (this.activeTab) {
      case 'dashboard':
        await this.renderDashboardTab(tabContent);
        break;
      case 'accesos':
        await this.renderAccesosTab(tabContent);
        break;
      case 'bitacoras':
        await this.renderBitacorasTab(tabContent);
        break;
      case 'personal':
        await this.renderPersonalTab(tabContent);
        break;
      case 'servicios':
        await this.renderServiciosTab(tabContent);
        break;
      case 'turnos':
        await this.renderTurnosTab(tabContent);
        break;
      case 'consignas':
        await this.renderConsignasTab(tabContent);
        break;
      case 'reportes':
        await this.renderReportesTab(tabContent);
        break;
      case 'firestore':
        if (window.FirestoreView) {
          window.FirestoreView.render();
        }
        break;
    }
  },

  // ==========================================
  // TAB 1: DASHBOARD
  // ==========================================
  async renderDashboardTab(container) {
    try {
      const data = await window.SICA_API.getDashboardMetrics();
      const r = data.resumen;

      let visitorTypesHtml = '';
      if (data.porTipoVisitante && data.porTipoVisitante.length > 0) {
        visitorTypesHtml = data.porTipoVisitante.map(t => `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
            <span style="font-weight: 600;">${t.tipo_visitante}</span>
            <span class="badge badge-primary">${t.cantidad} accesos</span>
          </div>
        `).join('');
      } else {
        visitorTypesHtml = `<div style="color: var(--text-dim); padding: 1rem 0;">No hay movimientos registrados hoy.</div>`;
      }

      container.innerHTML = `
        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Accesos Registrados Hoy</span>
            <span class="metric-value">${r.accesosHoy}</span>
            <span class="metric-sub">Entradas: ${r.entradasHoy} | Salidas: ${r.salidasHoy}</span>
          </div>
          <div class="metric-card success">
            <span class="metric-label">Guardias Activos</span>
            <span class="metric-value">${r.guardiasActivos}</span>
            <span class="metric-sub">Distribuidos en casetas activas</span>
          </div>
          <div class="metric-card ${r.emergenciasActivas > 0 ? 'alert' : ''}">
            <span class="metric-label">Emergencias Activas</span>
            <span class="metric-value" style="color: ${r.emergenciasActivas > 0 ? '#ef4444' : '#fff'};">${r.emergenciasActivas}</span>
            <span class="metric-sub">${r.emergenciasActivas > 0 ? 'Requieren atención inmediata' : 'Sin emergencias pendientes'}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Servicios / Casetas</span>
            <span class="metric-value">${r.totalServicios}</span>
            <span class="metric-sub">Inmuebles bajo custodia</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
          <!-- Desglose por tipo de visitante -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.1rem; margin-bottom: 1rem; color: #fff;">📊 Desglose de Accesos Hoy</h3>
            ${visitorTypesHtml}
          </div>

          <!-- Acciones Rápidas de Gerencia -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
            <h3 style="font-size: 1.1rem; color: #fff;">⚡ Acciones Operativas Inmediatas</h3>
            <button class="btn-primary" onclick="AdminView.openModalNuevoUsuario()">
              ➕ Dar de Alta Nuevo Elemento / Guardia
            </button>
            <button class="btn-secondary" onclick="AdminView.openModalNuevoServicio()">
              🏢 Registrar Nuevo Inmueble / Caseta
            </button>
            <button class="btn-secondary" onclick="AdminView.openModalNuevaConsigna()">
              📋 Publicar Nueva Consigna Operativa
            </button>
            <button class="btn-secondary" onclick="AdminView.exportarExcelCompleto()">
              📥 Descargar Reporte General en Excel
            </button>
          </div>
        </div>

        <!-- Últimos 5 movimientos en vivo -->
        <div style="margin-top: 2rem;">
          <h3 style="font-size: 1.1rem; margin-bottom: 1rem; color: #fff;">🕒 Últimos Accesos Registrados en Tiempo Real</h3>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha/Hora</th>
                  <th>Servicio</th>
                  <th>Tipo</th>
                  <th>Nombre Visitante</th>
                  <th>Placas / Vehículo</th>
                  <th>Motivo / Destino</th>
                  <th>Oficial</th>
                </tr>
              </thead>
              <tbody>
                ${(data.ultimosAccesos || []).map(a => `
                  <tr>
                    <td><strong>#${a.id_acceso}</strong></td>
                    <td>${a.fecha_hora}</td>
                    <td>${a.nombre_servicio || 'N/A'}</td>
                    <td><span class="badge ${a.tipo_movimiento === 'Entrada' ? 'badge-success' : 'badge-primary'}">${a.tipo_movimiento} (${a.tipo_visitante})</span></td>
                    <td><strong>${a.nombre_visitante}</strong></td>
                    <td>${a.placas || a.datos_vehiculo || 'Peatón'}</td>
                    <td>${a.motivo_o_destino || 'Sin especificar'}</td>
                    <td>${a.nombre_guardia || 'Guardia'}</td>
                  </tr>
                `).join('') || '<tr><td colspan="8" style="text-align:center;">Sin accesos recientes</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar datos del dashboard: ${err.message}</div>`;
    }
  },

  // ==========================================
  // TAB 2: CONTROL DE ACCESOS
  // ==========================================
  async renderAccesosTab(container) {
    try {
      const servicesRes = await window.SICA_API.getServices();
      const accesosRes = await window.SICA_API.getAccesos({ limit: 50 });

      container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.3rem; font-weight: 800;">Registro General de Entradas y Salidas</h2>
          <div style="display: flex; gap: 10px;">
            <button class="btn-secondary" onclick="AdminView.exportarExcelAccesos()">📊 Exportar Excel</button>
            <button class="btn-secondary" onclick="AdminView.imprimirPDFAccesos()" title="Generar y descargar documento PDF oficial">🖨️ Imprimir / PDF</button>
          </div>
        </div>

        <!-- Filtros -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
          <div class="form-group">
            <label>Filtrar por Caseta / Servicio</label>
            <select id="filter-acceso-servicio" class="form-select">
              <option value="">Todas las casetas</option>
              ${servicesRes.services.map(s => `<option value="${s.id_servicio}">${s.nombre_cliente_o_lugar}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Tipo Movimiento</label>
            <select id="filter-acceso-mov" class="form-select">
              <option value="">Todos (Entrada y Salida)</option>
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tipo Visitante</label>
            <select id="filter-acceso-tipo" class="form-select">
              <option value="">Todos</option>
              <option value="Peatón">Peatón</option>
              <option value="Vehículo">Vehículo</option>
              <option value="Proveedor">Proveedor</option>
              <option value="Visita">Visita</option>
              <option value="Residente">Residente</option>
            </select>
          </div>
          <div class="form-group">
            <label>Búsqueda (Nombre / Placas)</label>
            <input type="text" id="filter-acceso-search" class="form-input" placeholder="Ej. ABC-123, Juan...">
          </div>
          <div style="display: flex; align-items: flex-end;">
            <button class="btn-primary" style="width: 100%;" onclick="AdminView.aplicarFiltrosAccesos()">Filtrar</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table" id="tabla-accesos-admin">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha y Hora</th>
                <th>Caseta / Inmueble</th>
                <th>Movimiento</th>
                <th>Tipo Visitante</th>
                <th>Nombre</th>
                <th>ID / Placas</th>
                <th>Destino</th>
                <th>Guardia en Turno</th>
                <th>Offline</th>
              </tr>
            </thead>
            <tbody>
              ${this.buildAccesosRows(accesosRes.accesos)}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar accesos: ${err.message}</div>`;
    }
  },

  buildAccesosRows(accesos) {
    if (!accesos || accesos.length === 0) {
      return `<tr><td colspan="10" style="text-align:center; padding: 2rem;">No se encontraron registros de accesos con los criterios indicados.</td></tr>`;
    }
    return accesos.map(a => `
      <tr>
        <td><strong>#${a.id_acceso}</strong></td>
        <td>${a.fecha_hora}</td>
        <td>${a.nombre_servicio || 'N/A'}</td>
        <td>
          <span class="badge ${a.tipo_movimiento === 'Entrada' ? 'badge-success' : 'badge-primary'}">
            ${a.tipo_movimiento}
          </span>
        </td>
        <td>${a.tipo_visitante}</td>
        <td><strong>${a.nombre_visitante}</strong></td>
        <td>
          ${a.placas ? `<span class="badge badge-warning">🚗 ${a.placas}</span><br>` : ''}
          <small style="color: var(--text-dim);">${a.identificacion_tipo || ''} ${a.identificacion_num || ''}</small>
        </td>
        <td>${a.motivo_o_destino || 'N/A'}</td>
        <td>${a.nombre_guardia || 'N/A'}</td>
        <td>
          ${a.sincronizado_offline ? '<span class="badge badge-warning" title="Sincronizado desde modo offline">Offline</span>' : '<span style="color: var(--text-dim);">-</span>'}
        </td>
      </tr>
    `).join('');
  },

  async aplicarFiltrosAccesos() {
    const id_servicio = document.getElementById('filter-acceso-servicio').value;
    const tipo_movimiento = document.getElementById('filter-acceso-mov').value;
    const tipo_visitante = document.getElementById('filter-acceso-tipo').value;
    const search = document.getElementById('filter-acceso-search').value;

    const res = await window.SICA_API.getAccesos({
      id_servicio,
      tipo_movimiento,
      tipo_visitante,
      search,
      limit: 100
    });

    const tbody = document.querySelector('#tabla-accesos-admin tbody');
    if (tbody) {
      tbody.innerHTML = this.buildAccesosRows(res.accesos);
    }
  },

  // ==========================================
  // TAB 3: BITÁCORA DE NOVEDADES E INCIDENCIAS
  // ==========================================
  async renderBitacorasTab(container) {
    try {
      const bitacorasRes = await window.SICA_API.getBitacoras({ limit: 50 });

      container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.3rem; font-weight: 800;">Bitácora Operativa Digital</h2>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn-secondary" onclick="AdminView.exportarExcelBitacora()">📊 Exportar Excel</button>
            <button class="btn-secondary" onclick="AdminView.imprimirPDFBitacoras()" title="Generar y descargar bitácora oficial en PDF">🖨️ Imprimir / PDF</button>
            <button class="btn-primary" onclick="AdminView.openModalNuevaBitacoraAdmin()">➕ Nuevo Registro</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha/Hora</th>
                <th>Caseta</th>
                <th>Evento</th>
                <th>Prioridad</th>
                <th>Descripción</th>
                <th>Oficial</th>
                <th>Estatus Supervisión</th>
                <th>Evidencia</th>
              </tr>
            </thead>
            <tbody>
              ${bitacorasRes.bitacoras.map(b => `
                <tr style="${b.nivel_prioridad === 'Emergencia' && !b.atendida_supervisor ? 'background: rgba(239, 68, 68, 0.1); font-weight: bold;' : ''}">
                  <td><strong>#${b.id_bitacora}</strong></td>
                  <td>${b.fecha_hora_registro}</td>
                  <td>${b.nombre_servicio || 'N/A'}</td>
                  <td><span class="badge ${b.tipo_evento === 'Emergencia' ? 'badge-danger' : 'badge-neutral'}">${b.tipo_evento}</span></td>
                  <td>
                    <span class="badge ${b.nivel_prioridad === 'Emergencia' ? 'badge-danger' : b.nivel_prioridad === 'Alta' ? 'badge-warning' : 'badge-neutral'}">
                      ${b.nivel_prioridad}
                    </span>
                  </td>
                  <td>${b.descripcion}</td>
                  <td>${b.nombre_guardia || 'N/A'}</td>
                  <td>
                    ${b.atendida_supervisor
                      ? '<span class="badge badge-success">✓ Atendida</span>'
                      : '<span class="badge badge-warning">Pendiente</span>'
                    }
                  </td>
                  <td>
                    ${b.fotografia_adjunta
                      ? `<a href="/uploads/evidencias/${b.fotografia_adjunta}" target="_blank" style="color: var(--primary); text-decoration: underline;">Ver Foto</a>`
                      : '<span style="color: var(--text-dim);">-</span>'}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="9" style="text-align:center; padding: 2rem;">Sin eventos en bitácora</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar bitácora: ${err.message}</div>`;
    }
  },

  // ==========================================
  // TAB 4: PERSONAL Y EXPEDIENTES DIGITALES
  // ==========================================
  async renderPersonalTab(container) {
    try {
      const usersRes = await window.SICA_API.getUsers();
      const servicesRes = await window.SICA_API.getServices();

      container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 800;">Catálogo de Personal y Expedientes Digitales</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Control de guardias, supervisores, altas y carga de documentación oficial (INE, antecedentes, comprobantes).</p>
          </div>
          <button class="btn-primary" onclick="AdminView.openModalNuevoUsuario()">
            ➕ Registrar Nuevo Elemento
          </button>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Placa / Num</th>
                <th>Nombre Completo</th>
                <th>Correo (Usuario)</th>
                <th>Rol</th>
                <th>Servicio Asignado</th>
                <th>Estatus</th>
                <th>Expediente Digital</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${usersRes.users.map(u => `
                <tr>
                  <td><strong>${u.num_empleado_placa || 'N/A'}</strong></td>
                  <td>${u.nombre_completo}</td>
                  <td>${u.correo_electronico}</td>
                  <td><span class="badge ${u.rol === 'Administrador' ? 'badge-danger' : u.rol === 'Supervisor' ? 'badge-warning' : 'badge-primary'}">${u.rol}</span></td>
                  <td>${u.nombre_servicio || '<em style="color: var(--text-dim);">Sin asignación</em>'}</td>
                  <td>
                    <span class="badge ${u.estatus === 'Activo' ? 'badge-success' : 'badge-neutral'}">
                      ${u.estatus}
                    </span>
                  </td>
                  <td>
                    <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="AdminView.openExpedienteModal(${u.id_usuario}, '${u.nombre_completo.replace(/'/g, "\\'")}')">
                      📁 Ver Expediente (${u.total_documentos || 0})
                    </button>
                  </td>
                  <td>
                    <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="AdminView.editarUsuario(${u.id_usuario})">✏️</button>
                    ${u.rol !== 'Administrador' ? `<button class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="AdminView.eliminarUsuario(${u.id_usuario})">🗑️</button>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar personal: ${err.message}</div>`;
    }
  },

  // ==========================================
  // TAB 5: INMUEBLES Y CASETAS (SERVICIOS)
  // ==========================================
  async renderServiciosTab(container) {
    try {
      const servicesRes = await window.SICA_API.getServices();

      container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 800;">Inmuebles, Clientes y Casetas (Servicios)</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Control de ubicaciones, contactos de emergencia e instrucciones operativas iniciales.</p>
          </div>
          <button class="btn-primary" onclick="AdminView.openModalNuevoServicio()">
            🏢 Registrar Inmueble / Caseta
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.25rem;">
          ${servicesRes.services.map(s => `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                  <span class="badge badge-primary">${s.tipo_servicio}</span>
                  <span class="badge ${s.estatus === 'Activo' ? 'badge-success' : 'badge-neutral'}">${s.estatus}</span>
                </div>
                <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; margin-bottom: 6px;">${s.nombre_cliente_o_lugar}</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">📍 ${s.direccion || 'Dirección no especificada'}</p>
                
                <div style="font-size: 0.85rem; border-top: 1px solid var(--border-color); padding-top: 10px; margin-bottom: 12px;">
                  <div><strong>Contacto:</strong> ${s.contacto_principal || 'No registrado'} (${s.telefono_directo || 'S/T'})</div>
                  <div><strong>Emergencias:</strong> <span style="color: #f87171;">${s.contacto_emergencia || '911'}</span></div>
                  <div style="margin-top: 6px; font-style: italic; color: #cbd5e1; font-size: 0.8rem;">
                    "${s.instrucciones_iniciales || 'Sin instrucciones adicionales'}"
                  </div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px;">
                <span style="font-size: 0.8rem; color: var(--text-dim);">👮 Guardias: <strong>${s.guardias_asignados || 0}</strong> | Consignas: <strong>${s.consignas_activas || 0}</strong></span>
                <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="AdminView.editarServicio(${s.id_servicio})">Editar</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar servicios: ${err.message}</div>`;
    }
  },

  // ==========================================
  // TAB 6: TURNOS Y ASIGNACIONES
  // ==========================================
  async renderTurnosTab(container) {
    try {
      const shiftsRes = await window.SICA_API.getShifts();
      const usersRes = await window.SICA_API.getUsers({ rol: 'Guardia' });
      const servicesRes = await window.SICA_API.getServices();

      container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.3rem; font-weight: 800;">Programación y Asignación de Turnos</h2>
          <button class="btn-primary" onclick="AdminView.openModalNuevoTurno()">⏱️ Asignar Turno</button>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Oficial / Placa</th>
                <th>Servicio / Caseta Asignada</th>
                <th>Inicio de Turno</th>
                <th>Fin de Turno</th>
                <th>Notas Operativas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${shiftsRes.shifts.map(t => `
                <tr>
                  <td><strong>#${t.id_asignacion}</strong></td>
                  <td><strong>${t.nombre_guardia}</strong> (${t.num_empleado_placa || 'S/P'})</td>
                  <td>${t.nombre_servicio}</td>
                  <td>${t.fecha_inicio_turno}</td>
                  <td>${t.fecha_fin_turno}</td>
                  <td>${t.notas || 'Sin notas'}</td>
                  <td>
                    <button class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="AdminView.cancelarTurno(${t.id_asignacion})">Cancelar</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No hay turnos programados</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar turnos: ${err.message}</div>`;
    }
  },

  // ==========================================
  // TAB 7: CONSIGNAS OPERATIVAS
  // ==========================================
  async renderConsignasTab(container) {
    try {
      const consignasRes = await window.SICA_API.getConsignas();

      container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 800;">Consignas Operativas para Casetas</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Directivas obligatorias que los oficiales de seguridad deben consultar y cumplir en su caseta asignada.</p>
          </div>
          <button class="btn-primary" onclick="AdminView.openModalNuevaConsigna()">📋 Publicar Consigna</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.25rem;">
          ${consignasRes.consignas.map(c => `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span class="badge ${c.prioridad === 'Urgente' ? 'badge-danger' : c.prioridad === 'Alta' ? 'badge-warning' : 'badge-primary'}">${c.prioridad}</span>
                  <span class="badge ${c.estatus === 'Vigente' ? 'badge-success' : 'badge-neutral'}">${c.estatus}</span>
                </div>
                <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; margin-bottom: 4px;">${c.titulo}</h3>
                <div style="font-size: 0.8rem; color: var(--primary); font-weight: 600; margin-bottom: 10px;">🏢 ${c.nombre_servicio}</div>
                <p style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 14px; white-space: pre-line;">${c.contenido}</p>
              </div>

              <div style="font-size: 0.75rem; color: var(--text-dim); border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span>Vigencia: ${c.fecha_vigencia_inicio} al ${c.fecha_vigencia_fin}</span>
                <button class="btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="AdminView.eliminarConsigna(${c.id_consigna})">Eliminar</button>
              </div>
            </div>
          `).join('') || '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No hay consignas registradas</div>'}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar consignas: ${err.message}</div>`;
    }
  },

  // ==========================================
  // TAB 8: REPORTES Y AUDITORÍA
  // ==========================================
  async renderReportesTab(container) {
    try {
      const servicesRes = await window.SICA_API.getServices();

      container.innerHTML = `
        <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 14px;">
          <button class="btn-back" onclick="window.App.irAtras()" title="Regresar al panel principal">
            <span style="font-size: 1.15rem; line-height: 1;">⬅️</span>
            <span>Atrás</span>
          </button>
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 800;">Panel Gerencial de Reportes y Auditoría</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Generación y exportación de bitácoras y registros de acceso en formatos Excel (.xlsx) y CSV.</p>
          </div>
        </div>

        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; max-width: 700px;">
          <h3 style="font-size: 1.1rem; margin-bottom: 1rem;">Parámetros del Reporte</h3>
          
          <div class="form-group">
            <label>Inmueble / Caseta de Seguridad</label>
            <select id="rep-servicio" class="form-select">
              <option value="">Todos los servicios / Toda la empresa</option>
              ${servicesRes.services.map(s => `<option value="${s.id_servicio}">${s.nombre_cliente_o_lugar}</option>`).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label>Fecha Inicio</label>
              <input type="date" id="rep-fecha-inicio" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label>Fecha Fin</label>
              <input type="date" id="rep-fecha-fin" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>

          <div style="display: flex; gap: 12px; margin-top: 1.5rem; flex-wrap: wrap;">
            <button class="btn-primary" onclick="AdminView.descargarPdfReporte()" title="Generar y descargar reporte ejecutivo oficial en PDF">
              📄 Descargar Reporte Oficial en PDF
            </button>
            <button class="btn-secondary" onclick="AdminView.descargarExcelReporte()">
              📊 Descargar Libro de Excel (.XLSX)
            </button>
            <button class="btn-secondary" onclick="AdminView.descargarCsvReporte('accesos')">
              📑 Descargar Accesos en CSV
            </button>
            <button class="btn-secondary" onclick="AdminView.descargarCsvReporte('bitacora')">
              📝 Descargar Bitácora en CSV
            </button>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al preparar reportes: ${err.message}</div>`;
    }
  },

  // ==========================================
  // MODAL: ALTA DE PERSONAL (Sección 4.2)
  // ==========================================
  async openModalNuevoUsuario() {
    const servicesRes = await window.SICA_API.getServices();
    const modalHtml = `
      <div class="modal-overlay active" id="modal-nuevo-usuario">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Registrar Nuevo Personal (Usuario)</h3>
            <button class="modal-close" onclick="AdminView.closeModal('modal-nuevo-usuario')">&times;</button>
          </div>
          <form id="form-nuevo-usuario" onsubmit="AdminView.guardarNuevoUsuario(event)">
            <div class="modal-body">
              <div class="form-group">
                <label>Nombre(s) y Apellidos Completos *</label>
                <input type="text" name="nombre_completo" class="form-input" required placeholder="Ej. Juan Carlos López Morales">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Correo Electrónico (Acceso) *</label>
                  <input type="email" name="correo_electronico" class="form-input" required placeholder="guardia@sica.com">
                </div>
                <div class="form-group">
                  <label>Contraseña *</label>
                  <input type="password" name="contrasena" class="form-input" required placeholder="Mínimo 6 caracteres">
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Rol Asignado *</label>
                  <select name="rol" class="form-select" required>
                    <option value="Guardia">Guardia de Seguridad</option>
                    <option value="Supervisor">Supervisor Operativo</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Estatus Laboral</label>
                  <select name="estatus" class="form-select">
                    <option value="Activo">Activo</option>
                    <option value="En descanso">En descanso</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>CURP / Num Identificación Oficial</label>
                  <input type="text" name="curp" class="form-input" placeholder="18 caracteres">
                </div>
                <div class="form-group">
                  <label>Teléfono Celular</label>
                  <input type="tel" name="telefono" class="form-input" placeholder="811-000-0000">
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Número de Empleado / Placa</label>
                  <input type="text" name="num_empleado_placa" class="form-input" placeholder="GDA-101">
                </div>
                <div class="form-group">
                  <label>Servicio / Caseta Asignada</label>
                  <select name="id_servicio_asignado" class="form-select">
                    <option value="">Sin servicio fijo</option>
                    ${servicesRes.services.map(s => `<option value="${s.id_servicio}">${s.nombre_cliente_o_lugar}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="AdminView.closeModal('modal-nuevo-usuario')">Cancelar</button>
              <button type="submit" class="btn-primary">Guardar Registro</button>
            </div>
          </form>
        </div>
      </div>
    `;
    this.appendModalToBody(modalHtml);
  },

  async guardarNuevoUsuario(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      await window.SICA_API.createUser(payload);
      window.App.showToast('Elemento registrado exitosamente', 'success');
      this.closeModal('modal-nuevo-usuario');
      this.renderPersonalTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // MODAL: ALTA DE SERVICIOS (Sección 4.1)
  // ==========================================
  openModalNuevoServicio() {
    const modalHtml = `
      <div class="modal-overlay active" id="modal-nuevo-servicio">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Registrar Nuevo Inmueble / Caseta (Servicio)</h3>
            <button class="modal-close" onclick="AdminView.closeModal('modal-nuevo-servicio')">&times;</button>
          </div>
          <form id="form-nuevo-servicio" onsubmit="AdminView.guardarNuevoServicio(event)">
            <div class="modal-body">
              <div class="form-group">
                <label>Nombre Comercial del Cliente / Fraccionamiento / Inmueble *</label>
                <input type="text" name="nombre_cliente_o_lugar" class="form-input" required placeholder="Ej. Fraccionamiento Los Olivos - Caseta Norte">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Tipo de Servicio *</label>
                  <select name="tipo_servicio" class="form-select" required>
                    <option value="Residencial">Residencial</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Corporativo">Corporativo</option>
                    <option value="Comercio">Comercio</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Estatus del Contrato</label>
                  <select name="estatus" class="form-select">
                    <option value="Activo">Activo</option>
                    <option value="Suspendido">Suspendido</option>
                    <option value="Finalizado">Finalizado</option>
                  </select>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Calle</label>
                  <input type="text" name="direccion_calle" class="form-input" placeholder="Av. Principal">
                </div>
                <div class="form-group">
                  <label>Número</label>
                  <input type="text" name="direccion_numero" class="form-input" placeholder="100 Ext. / 4B Int.">
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Colonia</label>
                  <input type="text" name="direccion_colonia" class="form-input" placeholder="Centro">
                </div>
                <div class="form-group">
                  <label>Municipio / Alcaldía</label>
                  <input type="text" name="direccion_municipio" class="form-input" placeholder="Monterrey">
                </div>
                <div class="form-group">
                  <label>C.P.</label>
                  <input type="text" name="direccion_cp" class="form-input" placeholder="64000">
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Contacto Principal</label>
                  <input type="text" name="contacto_principal" class="form-input" placeholder="Lic. Roberto Sánchez">
                </div>
                <div class="form-group">
                  <label>Teléfono Directo</label>
                  <input type="tel" name="telefono_directo" class="form-input" placeholder="811-000-0000">
                </div>
              </div>
              <div class="form-group">
                <label>Teléfono / Protocolo de Emergencia Local</label>
                <input type="text" name="contacto_emergencia" class="form-input" placeholder="911 / Seguridad Privada Móvil (811-999-0000)">
              </div>
              <div class="form-group">
                <label>Instrucciones y Restricciones Operativas Iniciales</label>
                <textarea name="instrucciones_iniciales" class="form-textarea" rows="2" placeholder="Revisión obligatoria de cajuela, confirmación de visita por interfón..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="AdminView.closeModal('modal-nuevo-servicio')">Cancelar</button>
              <button type="submit" class="btn-primary">Guardar Inmueble</button>
            </div>
          </form>
        </div>
      </div>
    `;
    this.appendModalToBody(modalHtml);
  },

  async guardarNuevoServicio(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      await window.SICA_API.createService(payload);
      window.App.showToast('Servicio registrado exitosamente', 'success');
      this.closeModal('modal-nuevo-servicio');
      this.renderServiciosTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // MODAL: EXPEDIENTE DIGITAL (Sección 4.3)
  // ==========================================
  async openExpedienteModal(userId, userName) {
    this.currentUserIdForDossier = userId;
    const modalHtml = `
      <div class="modal-overlay active" id="modal-expediente-digital">
        <div class="modal-content" style="max-width: 750px;">
          <div class="modal-header">
            <div>
              <h3>Expediente Digital de Personal</h3>
              <p style="font-size: 0.85rem; color: var(--text-muted);">${userName}</p>
            </div>
            <button class="modal-close" onclick="AdminView.closeModal('modal-expediente-digital')">&times;</button>
          </div>
          <div class="modal-body">
            <!-- Formulario de Subida -->
            <form id="form-upload-expediente" onsubmit="AdminView.subirDocumentoExpediente(event)" style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-md); border: 1px dashed var(--border-color); margin-bottom: 1.5rem;">
              <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 8px;">Subir Documento Oficial Requerido</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                <div class="form-group">
                  <label>Tipo de Documento *</label>
                  <select name="tipo_documento" class="form-select" required>
                    <option value="ine">Identificación Oficial (INE / Pasaporte)</option>
                    <option value="comprobante_domicilio">Comprobante de Domicilio (&lt; 3 meses)</option>
                    <option value="curp_rfc">CURP / RFC Oficial</option>
                    <option value="antecedentes_no_penales">Constancia de Antecedentes No Penales</option>
                    <option value="cartilla_militar">Cartilla Militar Liberada</option>
                    <option value="fotografia_rostro">Fotografía de Rostro (Fondo Blanco)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Archivo (.PDF, .JPG, .PNG, máx. 5MB) *</label>
                  <input type="file" name="archivo" class="form-input" required accept=".pdf, .jpg, .jpeg, .png">
                </div>
              </div>
              <button type="submit" class="btn-primary" style="width: 100%;">
                📤 Cargar al Expediente Seguro
              </button>
            </form>

            <!-- Lista de Documentos Cargados -->
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 8px;">Documentos en el Expediente</h4>
            <div id="lista-documentos-expediente">
              <div style="text-align: center; color: var(--text-dim); padding: 1rem;">Cargando expediente...</div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" onclick="AdminView.closeModal('modal-expediente-digital')">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    this.appendModalToBody(modalHtml);
    await this.cargarListaExpediente(userId);
  },

  async cargarListaExpediente(userId) {
    const cont = document.getElementById('lista-documentos-expediente');
    if (!cont) return;

    try {
      const res = await window.SICA_API.getExpedientes(userId);
      if (!res.expedientes || res.expedientes.length === 0) {
        cont.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 1.5rem; background: var(--bg-surface); border-radius: var(--radius-sm);">No hay documentos cargados en el expediente de este elemento.</div>`;
        return;
      }

      cont.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Archivo</th>
                <th>Tamaño</th>
                <th>Fecha de Carga</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${res.expedientes.map(d => `
                <tr>
                  <td><span class="badge badge-primary">${d.tipo_documento.replace(/_/g, ' ').toUpperCase()}</span></td>
                  <td>${d.nombre_archivo}</td>
                  <td>${Math.round(d.tamano_bytes / 1024)} KB</td>
                  <td>${d.fecha_subida}</td>
                  <td>
                    <a href="/api/users/${userId}/expediente/${d.id_expediente}/download" target="_blank" class="btn-secondary" style="padding: 3px 8px; font-size: 0.75rem;">⬇️ Descargar</a>
                    <button class="btn-danger" style="padding: 3px 8px; font-size: 0.75rem;" onclick="AdminView.eliminarDocumentoExpediente(${userId}, ${d.id_expediente})">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      cont.innerHTML = `<div class="toast error">Error al cargar documentos: ${err.message}</div>`;
    }
  },

  async subirDocumentoExpediente(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
      await window.SICA_API.uploadExpediente(this.currentUserIdForDossier, formData);
      window.App.showToast('Documento cargado al expediente digital correctamente', 'success');
      form.reset();
      await this.cargarListaExpediente(this.currentUserIdForDossier);
      // Update badge in personal list
      this.renderPersonalTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  async eliminarDocumentoExpediente(userId, docId) {
    if (!confirm('¿Confirma que desea eliminar este documento del expediente oficial?')) return;
    try {
      await window.SICA_API.deleteExpediente(userId, docId);
      window.App.showToast('Documento eliminado', 'success');
      await this.cargarListaExpediente(userId);
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // MODAL: NUEVA CONSIGNA (RF-04)
  // ==========================================
  async openModalNuevaConsigna() {
    const servicesRes = await window.SICA_API.getServices();
    const today = new Date().toISOString().split('T')[0];

    const modalHtml = `
      <div class="modal-overlay active" id="modal-nueva-consigna">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Publicar Nueva Consigna Operativa</h3>
            <button class="modal-close" onclick="AdminView.closeModal('modal-nueva-consigna')">&times;</button>
          </div>
          <form id="form-nueva-consigna" onsubmit="AdminView.guardarNuevaConsigna(event)">
            <div class="modal-body">
              <div class="form-group">
                <label>Servicio / Caseta Destino *</label>
                <select name="id_servicio" class="form-select" required>
                  ${servicesRes.services.map(s => `<option value="${s.id_servicio}">${s.nombre_cliente_o_lugar}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Título de la Consigna *</label>
                <input type="text" name="titulo" class="form-input" required placeholder="Ej. Control estricto de proveedores de gas">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Prioridad *</label>
                  <select name="prioridad" class="form-select" required>
                    <option value="Normal">Normal</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Estatus</label>
                  <select name="estatus" class="form-select">
                    <option value="Vigente">Vigente</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Fecha Inicio Vigencia *</label>
                  <input type="date" name="fecha_vigencia_inicio" class="form-input" required value="${today}">
                </div>
                <div class="form-group">
                  <label>Fecha Fin Vigencia *</label>
                  <input type="date" name="fecha_vigencia_fin" class="form-input" required value="2026-12-31">
                </div>
              </div>
              <div class="form-group">
                <label>Contenido Detallado de la Instrucción *</label>
                <textarea name="contenido" class="form-textarea" rows="4" required placeholder="Describa el procedimiento exacto que los oficiales deben acatar..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="AdminView.closeModal('modal-nueva-consigna')">Cancelar</button>
              <button type="submit" class="btn-primary">Publicar Consigna</button>
            </div>
          </form>
        </div>
      </div>
    `;
    this.appendModalToBody(modalHtml);
  },

  async guardarNuevaConsigna(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      await window.SICA_API.createConsigna(payload);
      window.App.showToast('Consigna publicada exitosamente', 'success');
      this.closeModal('modal-nueva-consigna');
      this.renderConsignasTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  async eliminarConsigna(id) {
    if (!confirm('¿Desea eliminar esta consigna?')) return;
    try {
      await window.SICA_API.deleteConsigna(id);
      window.App.showToast('Consigna eliminada', 'success');
      this.renderConsignasTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // MODAL: ASIGNAR TURNO
  // ==========================================
  async openModalNuevoTurno() {
    const guards = await window.SICA_API.getUsers({ rol: 'Guardia', estatus: 'Activo' });
    const services = await window.SICA_API.getServices({ estatus: 'Activo' });

    const now = new Date();
    const startStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const endStr = new Date(now.getTime() + 12 * 3600000 - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const modalHtml = `
      <div class="modal-overlay active" id="modal-nuevo-turno">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Asignar Turno Operativo</h3>
            <button class="modal-close" onclick="AdminView.closeModal('modal-nuevo-turno')">&times;</button>
          </div>
          <form onsubmit="AdminView.guardarNuevoTurno(event)">
            <div class="modal-body">
              <div class="form-group">
                <label>Oficial / Guardia *</label>
                <select name="id_usuario" class="form-select" required>
                  ${guards.users.map(g => `<option value="${g.id_usuario}">${g.nombre_completo} (${g.num_empleado_placa || 'S/P'})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Servicio / Caseta Asignada *</label>
                <select name="id_servicio" class="form-select" required>
                  ${services.services.map(s => `<option value="${s.id_servicio}">${s.nombre_cliente_o_lugar}</option>`).join('')}
                </select>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Inicio de Turno *</label>
                  <input type="datetime-local" name="fecha_inicio_turno" class="form-input" required value="${startStr}">
                </div>
                <div class="form-group">
                  <label>Fin de Turno *</label>
                  <input type="datetime-local" name="fecha_fin_turno" class="form-input" required value="${endStr}">
                </div>
              </div>
              <div class="form-group">
                <label>Notas del Servicio</label>
                <input type="text" name="notas" class="form-input" placeholder="Ej. Turno matutino 12x12 - Caseta vehicular">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="AdminView.closeModal('modal-nuevo-turno')">Cancelar</button>
              <button type="submit" class="btn-primary">Programar Turno</button>
            </div>
          </form>
        </div>
      </div>
    `;
    this.appendModalToBody(modalHtml);
  },

  async guardarNuevoTurno(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      await window.SICA_API.createShift(payload);
      window.App.showToast('Turno asignado exitosamente', 'success');
      this.closeModal('modal-nuevo-turno');
      this.renderTurnosTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  async cancelarTurno(id) {
    if (!confirm('¿Desea cancelar esta asignación de turno?')) return;
    try {
      await window.SICA_API.deleteShift(id);
      window.App.showToast('Turno cancelado', 'success');
      this.renderTurnosTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // EXPORTACIONES Y DESCARGAS (RF-05)
  // ==========================================
  async exportarExcelCompleto() {
    try {
      window.App.showToast('Generando libro de Excel...', 'info');
      const url = window.SICA_API.getExcelExportUrl();
      const fn = await window.SICA_API.downloadExport(url, 'Reporte_General_SICA.xlsx');
      window.App.showToast(`Archivo ${fn} descargado exitosamente`, 'success');
    } catch (e) {
      window.App.showToast(e.message, 'error');
    }
  },

  async exportarExcelAccesos() {
    try {
      const id_servicio = document.getElementById('filter-acceso-servicio') ? document.getElementById('filter-acceso-servicio').value : '';
      window.App.showToast('Generando reporte de accesos en Excel...', 'info');
      const url = window.SICA_API.getExcelExportUrl({ id_servicio });
      const fn = await window.SICA_API.downloadExport(url, 'Reporte_Accesos_SICA.xlsx');
      window.App.showToast(`Archivo ${fn} descargado exitosamente`, 'success');
    } catch (e) {
      window.App.showToast(e.message, 'error');
    }
  },

  async exportarExcelBitacora() {
    try {
      window.App.showToast('Generando reporte de bitácora en Excel...', 'info');
      const url = window.SICA_API.getExcelExportUrl();
      const fn = await window.SICA_API.downloadExport(url, 'Reporte_Bitacora_SICA.xlsx');
      window.App.showToast(`Archivo ${fn} descargado exitosamente`, 'success');
    } catch (e) {
      window.App.showToast(e.message, 'error');
    }
  },

  async descargarExcelReporte() {
    try {
      const id_servicio = document.getElementById('rep-servicio').value;
      const fecha_inicio = document.getElementById('rep-fecha-inicio').value;
      const fecha_fin = document.getElementById('rep-fecha-fin').value;

      window.App.showToast('Generando reporte en Excel...', 'info');
      const url = window.SICA_API.getExcelExportUrl({ id_servicio, fecha_inicio, fecha_fin });
      const fn = await window.SICA_API.downloadExport(url, 'Reporte_Filtrado_SICA.xlsx');
      window.App.showToast(`Archivo ${fn} descargado exitosamente`, 'success');
    } catch (e) {
      window.App.showToast(e.message, 'error');
    }
  },

  async descargarCsvReporte(tipo) {
    try {
      const id_servicio = document.getElementById('rep-servicio').value;
      const fecha_inicio = document.getElementById('rep-fecha-inicio').value;
      const fecha_fin = document.getElementById('rep-fecha-fin').value;

      window.App.showToast(`Generando reporte ${tipo} en CSV...`, 'info');
      const url = window.SICA_API.getCsvExportUrl({ tipo, id_servicio, fecha_inicio, fecha_fin });
      const fn = await window.SICA_API.downloadExport(url, `Reporte_${tipo}_SICA.csv`);
      window.App.showToast(`Archivo ${fn} descargado exitosamente`, 'success');
    } catch (e) {
      window.App.showToast(e.message, 'error');
    }
  },

  async imprimirPDFAccesos() {
    try {
      window.App.showToast('Generando documento PDF oficial de accesos...', 'info');
      const id_servicio = document.getElementById('filter-acceso-servicio') ? document.getElementById('filter-acceso-servicio').value : '';
      const tipo_movimiento = document.getElementById('filter-acceso-mov') ? document.getElementById('filter-acceso-mov').value : '';
      const tipo_visitante = document.getElementById('filter-acceso-tipo') ? document.getElementById('filter-acceso-tipo').value : '';
      const search = document.getElementById('filter-acceso-search') ? document.getElementById('filter-acceso-search').value : '';

      const res = await window.SICA_API.getAccesos({
        id_servicio,
        tipo_movimiento,
        tipo_visitante,
        search,
        limit: 200
      });

      if (!res.accesos || res.accesos.length === 0) {
        window.App.showToast('No hay registros de acceso para generar el PDF', 'warning');
        return;
      }

      const fn = await window.SICA_PDF.exportarAccesosPDF(res.accesos, {
        titulo: 'REPORTE OFICIAL DE CONTROL DE ACCESOS'
      });
      window.App.showToast(`Documento PDF ${fn} generado y descargado exitosamente`, 'success');
    } catch (e) {
      console.error('Error al generar PDF de accesos:', e);
      window.App.showToast('Error al generar PDF: ' + e.message, 'error');
    }
  },

  async imprimirPDFBitacoras() {
    try {
      window.App.showToast('Generando documento PDF oficial de bitácora...', 'info');
      const res = await window.SICA_API.getBitacoras({ limit: 200 });

      if (!res.bitacoras || res.bitacoras.length === 0) {
        window.App.showToast('No hay registros en bitácora para generar el PDF', 'warning');
        return;
      }

      const fn = await window.SICA_PDF.exportarBitacorasPDF(res.bitacoras, {
        titulo: 'REPORTE OFICIAL DE BITÁCORA E INCIDENCIAS'
      });
      window.App.showToast(`Documento PDF ${fn} generado y descargado exitosamente`, 'success');
    } catch (e) {
      console.error('Error al generar PDF de bitácoras:', e);
      window.App.showToast('Error al generar PDF: ' + e.message, 'error');
    }
  },

  async descargarPdfReporte() {
    try {
      window.App.showToast('Generando reporte gerencial consolidado en PDF...', 'info');
      const id_servicio = document.getElementById('rep-servicio')?.value || '';
      const data = await window.SICA_API.getDashboardMetrics(id_servicio);
      const fn = await window.SICA_PDF.exportarReporteGerencialPDF(data);
      window.App.showToast(`Reporte consolidado ${fn} descargado exitosamente`, 'success');
    } catch (e) {
      console.error('Error al generar reporte gerencial PDF:', e);
      window.App.showToast('Error al generar reporte PDF: ' + e.message, 'error');
    }
  },

  // ==========================================
  // EDICIÓN Y ELIMINACIÓN DE USUARIOS
  // ==========================================
  async editarUsuario(id) {
    try {
      const userRes = await window.SICA_API.getUser(id);
      const servicesRes = await window.SICA_API.getServices();
      const u = userRes.user;

      const modalHtml = `
        <div class="modal-overlay active" id="modal-editar-usuario">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Editar Personal / Usuario (#${u.id_usuario})</h3>
              <button class="modal-close" onclick="AdminView.closeModal('modal-editar-usuario')">&times;</button>
            </div>
            <form onsubmit="AdminView.guardarEdicionUsuario(event, ${u.id_usuario})">
              <div class="modal-body">
                <div class="form-group">
                  <label>Nombre(s) y Apellidos Completos *</label>
                  <input type="text" name="nombre_completo" class="form-input" required value="${u.nombre_completo || ''}">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label>Correo Electrónico (Acceso) *</label>
                    <input type="email" name="correo_electronico" class="form-input" required value="${u.correo_electronico || ''}">
                  </div>
                  <div class="form-group">
                    <label>Nueva Contraseña (Opcional)</label>
                    <input type="password" name="contrasena" class="form-input" placeholder="Dejar en blanco para no cambiar">
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label>Rol Asignado *</label>
                    <select name="rol" class="form-select" required>
                      <option value="Guardia" ${u.rol === 'Guardia' ? 'selected' : ''}>Guardia de Seguridad</option>
                      <option value="Supervisor" ${u.rol === 'Supervisor' ? 'selected' : ''}>Supervisor Operativo</option>
                      <option value="Administrador" ${u.rol === 'Administrador' ? 'selected' : ''}>Administrador</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Estatus Laboral</label>
                    <select name="estatus" class="form-select">
                      <option value="Activo" ${u.estatus === 'Activo' ? 'selected' : ''}>Activo</option>
                      <option value="En descanso" ${u.estatus === 'En descanso' ? 'selected' : ''}>En descanso</option>
                      <option value="Baja" ${u.estatus === 'Baja' ? 'selected' : ''}>Baja</option>
                    </select>
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label>CURP / Num Identificación</label>
                    <input type="text" name="curp" class="form-input" value="${u.curp || ''}">
                  </div>
                  <div class="form-group">
                    <label>Teléfono Celular</label>
                    <input type="tel" name="telefono" class="form-input" value="${u.telefono || ''}">
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label>Número de Empleado / Placa</label>
                    <input type="text" name="num_empleado_placa" class="form-input" value="${u.num_empleado_placa || ''}">
                  </div>
                  <div class="form-group">
                    <label>Servicio / Caseta Asignada</label>
                    <select name="id_servicio_asignado" class="form-select">
                      <option value="">Sin servicio fijo</option>
                      ${servicesRes.services.map(s => `<option value="${s.id_servicio}" ${u.id_servicio_asignado === s.id_servicio ? 'selected' : ''}>${s.nombre_cliente_o_lugar}</option>`).join('')}
                    </select>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="AdminView.closeModal('modal-editar-usuario')">Cancelar</button>
                <button type="submit" class="btn-primary">Actualizar Personal</button>
              </div>
            </form>
          </div>
        </div>
      `;
      this.appendModalToBody(modalHtml);
    } catch (err) {
      window.App.showToast('Error al cargar datos del usuario: ' + err.message, 'error');
    }
  },

  async guardarEdicionUsuario(e, id) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      await window.SICA_API.updateUser(id, payload);
      window.App.showToast('Usuario actualizado exitosamente', 'success');
      this.closeModal('modal-editar-usuario');
      this.renderPersonalTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  async eliminarUsuario(id) {
    if (!confirm('¿Confirma que desea eliminar este usuario del sistema?')) return;
    try {
      await window.SICA_API.deleteUser(id);
      window.App.showToast('Usuario eliminado correctamente', 'success');
      this.renderPersonalTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // EDICIÓN DE SERVICIOS / CASETAS
  // ==========================================
  async editarServicio(id) {
    try {
      const res = await window.SICA_API.getService(id);
      const s = res.service;

      const modalHtml = `
        <div class="modal-overlay active" id="modal-editar-servicio">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Editar Inmueble / Caseta (#${s.id_servicio})</h3>
              <button class="modal-close" onclick="AdminView.closeModal('modal-editar-servicio')">&times;</button>
            </div>
            <form onsubmit="AdminView.guardarEdicionServicio(event, ${s.id_servicio})">
              <div class="modal-body">
                <div class="form-group">
                  <label>Nombre Comercial / Lugar *</label>
                  <input type="text" name="nombre_cliente_o_lugar" class="form-input" required value="${s.nombre_cliente_o_lugar || ''}">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label>Tipo de Servicio *</label>
                    <select name="tipo_servicio" class="form-select" required>
                      <option value="Residencial" ${s.tipo_servicio === 'Residencial' ? 'selected' : ''}>Residencial</option>
                      <option value="Industrial" ${s.tipo_servicio === 'Industrial' ? 'selected' : ''}>Industrial</option>
                      <option value="Corporativo" ${s.tipo_servicio === 'Corporativo' ? 'selected' : ''}>Corporativo</option>
                      <option value="Comercio" ${s.tipo_servicio === 'Comercio' ? 'selected' : ''}>Comercio</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Estatus</label>
                    <select name="estatus" class="form-select">
                      <option value="Activo" ${s.estatus === 'Activo' ? 'selected' : ''}>Activo</option>
                      <option value="Suspendido" ${s.estatus === 'Suspendido' ? 'selected' : ''}>Suspendido</option>
                      <option value="Finalizado" ${s.estatus === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
                    </select>
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label>Calle</label>
                    <input type="text" name="direccion_calle" class="form-input" value="${s.direccion_calle || ''}">
                  </div>
                  <div class="form-group">
                    <label>Número</label>
                    <input type="text" name="direccion_numero" class="form-input" value="${s.direccion_numero || ''}">
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label>Colonia</label>
                    <input type="text" name="direccion_colonia" class="form-input" value="${s.direccion_colonia || ''}">
                  </div>
                  <div class="form-group">
                    <label>Municipio</label>
                    <input type="text" name="direccion_municipio" class="form-input" value="${s.direccion_municipio || ''}">
                  </div>
                  <div class="form-group">
                    <label>C.P.</label>
                    <input type="text" name="direccion_cp" class="form-input" value="${s.direccion_cp || ''}">
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label>Contacto Principal</label>
                    <input type="text" name="contacto_principal" class="form-input" value="${s.contacto_principal || ''}">
                  </div>
                  <div class="form-group">
                    <label>Teléfono Directo</label>
                    <input type="tel" name="telefono_directo" class="form-input" value="${s.telefono_directo || ''}">
                  </div>
                </div>
                <div class="form-group">
                  <label>Teléfono / Protocolo de Emergencia</label>
                  <input type="text" name="contacto_emergencia" class="form-input" value="${s.contacto_emergencia || ''}">
                </div>
                <div class="form-group">
                  <label>Instrucciones Iniciales</label>
                  <textarea name="instrucciones_iniciales" class="form-textarea" rows="2">${s.instrucciones_iniciales || ''}</textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="AdminView.closeModal('modal-editar-servicio')">Cancelar</button>
                <button type="submit" class="btn-primary">Actualizar Inmueble</button>
              </div>
            </form>
          </div>
        </div>
      `;
      this.appendModalToBody(modalHtml);
    } catch (err) {
      window.App.showToast('Error al cargar datos del servicio: ' + err.message, 'error');
    }
  },

  async guardarEdicionServicio(e, id) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      await window.SICA_API.updateService(id, payload);
      window.App.showToast('Servicio actualizado exitosamente', 'success');
      this.closeModal('modal-editar-servicio');
      this.renderServiciosTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // NUEVA BITÁCORA DESDE ADMIN
  // ==========================================
  async openModalNuevaBitacoraAdmin() {
    try {
      const servicesRes = await window.SICA_API.getServices();
      const modalHtml = `
        <div class="modal-overlay active" id="modal-nueva-bitacora-admin">
          <div class="modal-content">
            <div class="modal-header">
              <h3>📝 Registrar en Bitácora Operativa</h3>
              <button class="modal-close" onclick="AdminView.closeModal('modal-nueva-bitacora-admin')">&times;</button>
            </div>
            <form onsubmit="AdminView.guardarNuevaBitacoraAdmin(event)">
              <div class="modal-body">
                <div class="form-group">
                  <label>Servicio / Inmueble *</label>
                  <select name="id_servicio" class="form-select" required>
                    ${servicesRes.services.map(s => `<option value="${s.id_servicio}">${s.nombre_cliente_o_lugar}</option>`).join('')}
                  </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label>Tipo de Evento *</label>
                    <select name="tipo_evento" class="form-select" required>
                      <option value="Rondín">Rondín Perimetral</option>
                      <option value="Relevo de Turno">Relevo de Turno</option>
                      <option value="Novedad Menor">Novedad Menor</option>
                      <option value="Incidencia Operativa">Incidencia Operativa</option>
                      <option value="Emergencia">Emergencia</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Prioridad *</label>
                    <select name="nivel_prioridad" class="form-select" required>
                      <option value="Baja">Baja</option>
                      <option value="Media">Media</option>
                      <option value="Alta">Alta</option>
                      <option value="Emergencia">Emergencia</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label>Descripción Detallada *</label>
                  <textarea name="descripcion" class="form-textarea" rows="4" required placeholder="Escriba la descripción del evento u observación operativa..."></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="AdminView.closeModal('modal-nueva-bitacora-admin')">Cancelar</button>
                <button type="submit" class="btn-primary">Guardar en Bitácora</button>
              </div>
            </form>
          </div>
        </div>
      `;
      this.appendModalToBody(modalHtml);
    } catch (err) {
      window.App.showToast('Error al cargar servicios: ' + err.message, 'error');
    }
  },

  async guardarNuevaBitacoraAdmin(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      await window.SICA_API.createBitacora(payload);
      window.App.showToast('Evento registrado en bitácora correctamente', 'success');
      this.closeModal('modal-nueva-bitacora-admin');
      this.renderBitacorasTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  // Helpers
  appendModalToBody(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.remove();
  }
};
