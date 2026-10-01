// SICA - Módulo de Caseta para Guardia de Seguridad (Guardia View)
window.GuardiaView = {
  cameraStream: null,
  capturedPhotoBase64: null,

  async render(container) {
    const user = window.SICA_API.getStoredUser();

    container.innerHTML = `
      <div class="caseta-container">
        <!-- Banner superior de la Caseta -->
        <div class="caseta-top-banner">
          <div class="caseta-title">
            <span style="font-size: 2rem;">🛡️</span>
            <div>
              <h2>${user.nombre_servicio || 'Caseta Principal'}</h2>
              <p style="font-size: 0.85rem; color: var(--text-muted);">
                Oficial en Turno: <strong>${user.nombre_completo}</strong> (${user.num_empleado_placa || 'GDA'})
              </p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div id="guardia-network-status" class="badge badge-success" style="font-size: 0.85rem; padding: 6px 12px;">
              🟢 En Línea
            </div>
            <button class="btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="GuardiaView.sincronizarManual()">
              🔄 Sincronizar (<span id="guardia-offline-count">0</span>)
            </button>
          </div>
        </div>

        <!-- Botones de Acción Táctil Rápida -->
        <div class="quick-action-grid">
          <button class="quick-action-btn entrada" onclick="GuardiaView.abrirRegistroAcceso('Entrada')">
            <span style="font-size: 2.2rem;">🟢</span>
            <span>REGISTRAR ENTRADA</span>
            <small style="font-size: 0.75rem; opacity: 0.9;">Peatón o Vehículo</small>
          </button>

          <button class="quick-action-btn salida" onclick="GuardiaView.abrirRegistroAcceso('Salida')">
            <span style="font-size: 2.2rem;">🔴</span>
            <span>REGISTRAR SALIDA</span>
            <small style="font-size: 0.75rem; opacity: 0.9;">Cierre de Visita</small>
          </button>

          <button class="quick-action-btn bitacora" onclick="GuardiaView.abrirRegistroBitacora('Rondín')">
            <span style="font-size: 2.2rem;">📝</span>
            <span>BITÁCORA / RONDÍN</span>
            <small style="font-size: 0.75rem; opacity: 0.9;">Novedad de Turno</small>
          </button>

          <button class="quick-action-btn emergencia" onclick="GuardiaView.abrirBotonEmergencia()">
            <span style="font-size: 2.2rem;">🚨</span>
            <span>BOTÓN DE EMERGENCIA</span>
            <small style="font-size: 0.75rem; opacity: 0.9;">Alerta Inmediata a Supervisión</small>
          </button>
        </div>

        <!-- Consignas Activas de la Caseta -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.15rem; color: #fff; display: flex; align-items: center; gap: 8px;">
              📋 Consignas Operativas para esta Caseta
            </h3>
            <span class="badge badge-primary">Lectura Obligatoria</span>
          </div>
          <div id="consignas-caseta-list">
            <div style="color: var(--text-dim);">Consultando consignas vigentes...</div>
          </div>
        </div>

        <!-- Movimientos Recientes de la Caseta -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.15rem; color: #fff;">🕒 Movimientos Recientes en Mi Caseta</h3>
            <button class="btn-secondary" style="font-size: 0.8rem; padding: 4px 10px;" onclick="GuardiaView.cargarMovimientosRecientes()">
              Actualizar
            </button>
          </div>
          <div class="table-responsive">
            <table class="data-table" id="tabla-recientes-guardia">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Movimiento</th>
                  <th>Visitante / Conductor</th>
                  <th>Tipo</th>
                  <th>Placas</th>
                  <th>Destino</th>
                  <th>Foto</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="7" style="text-align: center;">Cargando registros...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.actualizarEstatusConexion();
    this.cargarConsignasCaseta();
    this.cargarMovimientosRecientes();
    this.suscribirEventosOffline();
  },

  actualizarEstatusConexion() {
    const statusEl = document.getElementById('guardia-network-status');
    if (!statusEl) return;

    if (navigator.onLine) {
      statusEl.className = 'badge badge-success';
      statusEl.innerHTML = '🟢 En Línea';
    } else {
      statusEl.className = 'badge badge-warning';
      statusEl.innerHTML = '🟠 Fuera de Línea (Offline)';
    }

    window.SICA_OFFLINE.getOfflineCount().then(counts => {
      const badge = document.getElementById('guardia-offline-count');
      if (badge) badge.innerText = counts.total;
    });
  },

  suscribirEventosOffline() {
    window.addEventListener('online', () => {
      this.actualizarEstatusConexion();
      this.sincronizarManual();
    });
    window.addEventListener('offline', () => {
      this.actualizarEstatusConexion();
    });
    window.addEventListener('sica:offline-count-updated', (e) => {
      const badge = document.getElementById('guardia-offline-count');
      if (badge && e.detail) badge.innerText = e.detail.total;
    });
  },

  async sincronizarManual() {
    window.App.showToast('Sincronizando registros offline con el servidor...', 'success');
    const res = await window.SICA_OFFLINE.syncAllOfflineRecords();
    window.App.showToast(res.message, res.synced > 0 ? 'success' : 'info');
    this.actualizarEstatusConexion();
    this.cargarMovimientosRecientes();
  },

  async cargarConsignasCaseta() {
    const cont = document.getElementById('consignas-caseta-list');
    if (!cont) return;

    try {
      const res = await window.SICA_API.getConsignas({ vigentes: 'true' });
      if (!res.consignas || res.consignas.length === 0) {
        cont.innerHTML = `<div style="color: var(--text-dim); padding: 1rem 0;">No hay consignas especiales vigentes en este momento. Siga los protocolos estándar de vigilancia.</div>`;
        return;
      }

      cont.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${res.consignas.map(c => `
            <div style="padding: 12px; background: var(--bg-surface); border-radius: var(--radius-md); border-left: 4px solid ${c.prioridad === 'Urgente' ? '#ef4444' : '#0284c7'};">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 0.95rem; color: #fff;">${c.titulo}</strong>
                <span class="badge ${c.prioridad === 'Urgente' ? 'badge-danger' : 'badge-primary'}">${c.prioridad}</span>
              </div>
              <p style="font-size: 0.85rem; color: #cbd5e1; margin-top: 6px; white-space: pre-line;">${c.contenido}</p>
              <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 6px;">Vigencia: ${c.fecha_vigencia_inicio} al ${c.fecha_vigencia_fin}</div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      cont.innerHTML = `<div style="color: var(--text-dim);">Sin conexión al servidor para sincronizar consignas.</div>`;
    }
  },

  async cargarMovimientosRecientes() {
    const tbody = document.querySelector('#tabla-recientes-guardia tbody');
    if (!tbody) return;

    try {
      const res = await window.SICA_API.getAccesos({ limit: 10 });
      if (!res.accesos || res.accesos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1.5rem;">No hay registros de accesos hoy en esta caseta</td></tr>`;
        return;
      }

      tbody.innerHTML = res.accesos.map(a => `
        <tr>
          <td>${a.fecha_hora.slice(11, 16)}</td>
          <td><span class="badge ${a.tipo_movimiento === 'Entrada' ? 'badge-success' : 'badge-primary'}">${a.tipo_movimiento}</span></td>
          <td><strong>${a.nombre_visitante}</strong></td>
          <td>${a.tipo_visitante}</td>
          <td>${a.placas ? `<span class="badge badge-warning">${a.placas}</span>` : '-'}</td>
          <td>${a.motivo_o_destino || '-'}</td>
          <td>
            ${a.fotografia_evidencia
              ? `<a href="/uploads/evidencias/${a.fotografia_evidencia}" target="_blank" style="color:var(--primary); font-size:0.75rem;">Ver Foto</a>`
              : '-'}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim);">Registros disponibles localmente en modo Offline</td></tr>`;
    }
  },

  // ==========================================
  // MODAL REGISTRO DE ACCESO (Peatón / Vehículo)
  // ==========================================
  abrirRegistroAcceso(tipoMovimiento = 'Entrada') {
    this.capturedPhotoBase64 = null;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const modalHtml = `
      <div class="modal-overlay active" id="modal-registro-acceso">
        <div class="modal-content" style="max-width: 650px;">
          <div class="modal-header" style="background: ${tipoMovimiento === 'Entrada' ? '#064e3b' : '#1e3a8a'};">
            <h3>${tipoMovimiento === 'Entrada' ? '🟢 Registrar Nueva Entrada' : '🔴 Registrar Salida'} (Hora: ${nowTime})</h3>
            <button class="modal-close" onclick="GuardiaView.cerrarModalAcceso()">&times;</button>
          </div>
          <form id="form-acceso-caseta" onsubmit="GuardiaView.guardarAcceso(event, '${tipoMovimiento}')">
            <div class="modal-body">
              <!-- Selector Rápido Peatón / Vehículo -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 1.25rem;">
                <label style="background: var(--bg-surface); border: 2px solid var(--border-color); padding: 12px; border-radius: var(--radius-md); text-align: center; cursor: pointer;">
                  <input type="radio" name="tipo_visitante_radio" value="Peatón" checked onchange="GuardiaView.toggleCamposVehiculo(false)">
                  <strong style="display: block; font-size: 1rem; margin-top: 4px;">🚶 Peatonal</strong>
                </label>
                <label style="background: var(--bg-surface); border: 2px solid var(--border-color); padding: 12px; border-radius: var(--radius-md); text-align: center; cursor: pointer;">
                  <input type="radio" name="tipo_visitante_radio" value="Vehículo" onchange="GuardiaView.toggleCamposVehiculo(true)">
                  <strong style="display: block; font-size: 1rem; margin-top: 4px;">🚗 Vehicular</strong>
                </label>
              </div>

              <!-- Tipo de Visitante -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Clasificación del Visitante *</label>
                  <select name="tipo_visitante" id="acceso-clasificacion" class="form-select" required>
                    <option value="Visita">Visita Particular</option>
                    <option value="Proveedor">Proveedor / Paquetería</option>
                    <option value="Residente">Residente / Inquilino</option>
                    <option value="Empleado">Empleado / Contratista</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Nombre Completo del Visitante / Conductor *</label>
                  <input type="text" name="nombre_visitante" class="form-input" required placeholder="Ej. Roberto Sánchez" autofocus>
                </div>
              </div>

              <!-- Identificación -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Tipo de Identificación Presentada</label>
                  <select name="identificacion_tipo" class="form-select">
                    <option value="INE">INE / IFE</option>
                    <option value="Licencia">Licencia de Manejar</option>
                    <option value="Gafete">Gafete de Empresa</option>
                    <option value="Pasaporte">Pasaporte</option>
                    <option value="Sin ID">No presenta identificación</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Folio / Número de ID</label>
                  <input type="text" name="identificacion_num" class="form-input" placeholder="Ej. Folio INE / Licencia">
                </div>
              </div>

              <!-- Campos Vehiculares (Se ocultan si es Peatonal) -->
              <div id="seccion-vehiculo" style="display: none; background: #0f2238; border: 1px solid #1e3a8a; padding: 12px; border-radius: var(--radius-md); margin-bottom: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px;">
                  <div class="form-group">
                    <label style="color: #60a5fa;">Placas del Vehículo *</label>
                    <input type="text" name="placas" id="input-placas" class="form-input" placeholder="ABC-123-X" style="text-transform: uppercase; font-weight: 700; font-size: 1.1rem; letter-spacing: 0.1em;">
                  </div>
                  <div class="form-group">
                    <label style="color: #60a5fa;">Marca / Modelo / Color</label>
                    <input type="text" name="datos_vehiculo" class="form-input" placeholder="Ej. Nissan Versa Blanco, Camión Freightliner">
                  </div>
                </div>
              </div>

              <!-- Motivo o Destino -->
              <div class="form-group">
                <label>Motivo de la Visita o Destino (Casa / Lote / Oficina / Andén) *</label>
                <input type="text" name="motivo_o_destino" class="form-input" required placeholder="Ej. Casa 42 (Familia Reyes), Bodega 3, Mantenimiento">
              </div>

              <!-- Observaciones -->
              <div class="form-group">
                <label>Observaciones Adicionales</label>
                <input type="text" name="observaciones" class="form-input" placeholder="Revisión de cajuela sin novedades, deja gafete en garantía...">
              </div>

              <!-- Evidencia Fotográfica / Cámara -->
              <div style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                <label style="font-weight: 700; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 8px;">
                  📸 Evidencia Fotográfica (Opcional - Rostro, Placas o Identificación)
                </label>
                <div id="camera-container" style="display: none;" class="camera-box">
                  <video id="camera-preview" class="camera-video" autoplay playsinline></video>
                </div>
                <div id="photo-preview-container" style="display: none; text-align: center; margin-bottom: 10px;">
                  <img id="photo-preview-img" class="camera-captured-img" src="" alt="Captura">
                  <button type="button" class="btn-secondary" style="font-size: 0.8rem; margin-top: 6px;" onclick="GuardiaView.reiniciarCamara()">Tomar otra foto</button>
                </div>
                <div style="display: flex; gap: 10px;">
                  <button type="button" id="btn-activar-camara" class="btn-secondary" onclick="GuardiaView.iniciarCamara()">
                    📷 Activar Cámara Web / Celular
                  </button>
                  <button type="button" id="btn-capturar-foto" class="btn-primary" style="display: none;" onclick="GuardiaView.capturarFoto()">
                    🔘 Capturar Foto
                  </button>
                  <input type="file" id="input-archivo-foto" accept="image/*" style="display: none;" onchange="GuardiaView.cargarFotoArchivo(event)">
                  <button type="button" class="btn-secondary" onclick="document.getElementById('input-archivo-foto').click()">
                    📁 Seleccionar Archivo
                  </button>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="GuardiaView.cerrarModalAcceso()">Cancelar</button>
              <button type="submit" class="btn-primary" style="padding: 12px 24px; font-size: 1.05rem;">
                💾 Guardar Acceso
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);
  },

  toggleCamposVehiculo(esVehiculo) {
    const sec = document.getElementById('seccion-vehiculo');
    const clasif = document.getElementById('acceso-clasificacion');
    if (sec) {
      sec.style.display = esVehiculo ? 'block' : 'none';
      if (esVehiculo) {
        document.getElementById('input-placas').focus();
      }
    }
  },

  // ==========================================
  // MANEJO DE CÁMARA WEB / DISPOSITIVO
  // ==========================================
  async iniciarCamara() {
    try {
      const video = document.getElementById('camera-preview');
      const box = document.getElementById('camera-container');
      const btnActivar = document.getElementById('btn-activar-camara');
      const btnCapturar = document.getElementById('btn-capturar-foto');

      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      video.srcObject = this.cameraStream;
      box.style.display = 'flex';
      btnActivar.style.display = 'none';
      btnCapturar.style.display = 'inline-flex';
    } catch (err) {
      window.App.showToast('No se pudo acceder a la cámara: ' + err.message + '. Puede seleccionar una foto desde su galería.', 'error');
    }
  },

  capturarFoto() {
    const video = document.getElementById('camera-preview');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    this.capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.8);

    // Stop stream
    this.detenerCamara();

    // Show preview
    document.getElementById('camera-container').style.display = 'none';
    document.getElementById('btn-capturar-foto').style.display = 'none';
    document.getElementById('photo-preview-container').style.display = 'block';
    document.getElementById('photo-preview-img').src = this.capturedPhotoBase64;
  },

  detenerCamara() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
  },

  reiniciarCamara() {
    this.capturedPhotoBase64 = null;
    document.getElementById('photo-preview-container').style.display = 'none';
    this.iniciarCamara();
  },

  cargarFotoArchivo(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      this.capturedPhotoBase64 = event.target.result;
      document.getElementById('camera-container').style.display = 'none';
      document.getElementById('btn-activar-camara').style.display = 'none';
      document.getElementById('photo-preview-container').style.display = 'block';
      document.getElementById('photo-preview-img').src = this.capturedPhotoBase64;
    };
    reader.readAsDataURL(file);
  },

  cerrarModalAcceso() {
    this.detenerCamara();
    const m = document.getElementById('modal-registro-acceso');
    if (m) m.remove();
  },

  async guardarAcceso(e, tipoMovimiento) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const esVehiculo = formData.get('tipo_visitante_radio') === 'Vehículo';

    const payload = {
      tipo_movimiento: tipoMovimiento,
      tipo_visitante: esVehiculo ? 'Vehículo' : formData.get('tipo_visitante'),
      nombre_visitante: formData.get('nombre_visitante'),
      identificacion_tipo: formData.get('identificacion_tipo'),
      identificacion_num: formData.get('identificacion_num'),
      datos_vehiculo: formData.get('datos_vehiculo'),
      placas: formData.get('placas'),
      motivo_o_destino: formData.get('motivo_o_destino'),
      observaciones: formData.get('observaciones'),
      foto_base64: this.capturedPhotoBase64
    };

    try {
      const res = await window.SICA_API.createAcceso(payload);
      if (res.offline) {
        window.App.showToast(res.message, 'warning');
      } else {
        window.App.showToast('Acceso guardado correctamente', 'success');
      }
      this.cerrarModalAcceso();
      this.cargarMovimientosRecientes();
      this.actualizarEstatusConexion();
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // MODAL REGISTRO DE BITÁCORA / RONDÍN
  // ==========================================
  abrirRegistroBitacora(tipoEvento = 'Rondín') {
    this.capturedPhotoBase64 = null;
    const modalHtml = `
      <div class="modal-overlay active" id="modal-registro-bitacora">
        <div class="modal-content">
          <div class="modal-header">
            <h3>📝 Registrar en Bitácora Digital</h3>
            <button class="modal-close" onclick="GuardiaView.cerrarModalBitacora()">&times;</button>
          </div>
          <form onsubmit="GuardiaView.guardarBitacora(event)">
            <div class="modal-body">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>Tipo de Evento *</label>
                  <select name="tipo_evento" class="form-select" required>
                    <option value="Rondín" ${tipoEvento === 'Rondín' ? 'selected' : ''}>Rondín Perimetral</option>
                    <option value="Relevo de Turno">Relevo de Turno / Inventario</option>
                    <option value="Novedad Menor">Novedad Menor</option>
                    <option value="Incidencia Operativa">Incidencia Operativa</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Nivel de Prioridad *</label>
                  <select name="nivel_prioridad" class="form-select" required>
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>Descripción Detallada del Evento *</label>
                <textarea name="descripcion" class="form-textarea" rows="4" required placeholder="Detalle novedades encontradas, puntos revisados, estado de cerraduras, plumas vehiculares..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="GuardiaView.cerrarModalBitacora()">Cancelar</button>
              <button type="submit" class="btn-primary">Guardar en Bitácora</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);
  },

  cerrarModalBitacora() {
    const m = document.getElementById('modal-registro-bitacora');
    if (m) m.remove();
  },

  async guardarBitacora(e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      tipo_evento: form.tipo_evento.value,
      nivel_prioridad: form.nivel_prioridad.value,
      descripcion: form.descripcion.value
    };

    try {
      const res = await window.SICA_API.createBitacora(payload);
      if (res.offline) {
        window.App.showToast(res.message, 'warning');
      } else {
        window.App.showToast('Bitácora guardada exitosamente', 'success');
      }
      this.cerrarModalBitacora();
      this.actualizarEstatusConexion();
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // BOTÓN DE EMERGENCIA INMEDIATO (RF-03 & 6)
  // ==========================================
  abrirBotonEmergencia() {
    const modalHtml = `
      <div class="modal-overlay active" id="modal-boton-emergencia">
        <div class="modal-content" style="border: 2px solid #ef4444;">
          <div class="modal-header" style="background: #991b1b;">
            <h3 style="color: #fff;">🚨 ACTIVACIÓN DE ALERTA DE EMERGENCIA</h3>
            <button class="modal-close" onclick="GuardiaView.cerrarModalEmergencia()">&times;</button>
          </div>
          <form onsubmit="GuardiaView.activarEmergencia(event)">
            <div class="modal-body">
              <div style="background: rgba(239, 68, 68, 0.15); padding: 12px; border-radius: var(--radius-md); border: 1px solid #ef4444; margin-bottom: 12px;">
                <strong style="color: #f87171;">⚠️ ATENCIÓN:</strong>
                <p style="font-size: 0.85rem; color: #fff; margin-top: 4px;">
                  Al presionar este botón, se emitirá una alerta sonora y visual en tiempo real a todos los Supervisores y al Centro de Control de SICA.
                </p>
              </div>
              <div class="form-group">
                <label style="color: #fca5a5;">Motivo de la Emergencia *</label>
                <select name="motivo_emergencia" class="form-select" required>
                  <option value="Intrusión No Autorizada / Allanamiento">Intrusión No Autorizada / Allanamiento</option>
                  <option value="Agresión Física / Amenaza Armada">Agresión Física / Amenaza Armada</option>
                  <option value="Conato de Incendio / Fuga de Gas">Conato de Incendio / Fuga de Gas</option>
                  <option value="Urgencia Médica / Accidente Grave">Urgencia Médica / Accidente Grave</option>
                  <option value="Falla Masiva de Suministro / Pluma Bloqueada">Falla Masiva de Suministro / Pluma Bloqueada</option>
                  <option value="Otra Emergencia Crítica">Otra Emergencia Crítica</option>
                </select>
              </div>
              <div class="form-group">
                <label>Detalle Inmediato de la Situación *</label>
                <textarea name="detalle_emergencia" class="form-textarea" rows="3" required placeholder="Indique ubicación exacta, número de involucrados y si ya se solicitó apoyo de patrulla / ambulancia (911)..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="GuardiaView.cerrarModalEmergencia()">Cancelar</button>
              <button type="submit" class="btn-danger" style="padding: 12px 24px; font-size: 1.05rem;">
                🚨 DISPARAR ALERTA INMEDIATA
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);
  },

  cerrarModalEmergencia() {
    const m = document.getElementById('modal-boton-emergencia');
    if (m) m.remove();
  },

  async activarEmergencia(e) {
    e.preventDefault();
    const form = e.target;
    const motivo = form.motivo_emergencia.value;
    const detalle = form.detalle_emergencia.value;

    const payload = {
      tipo_evento: 'Emergencia',
      nivel_prioridad: 'Emergencia',
      descripcion: `[EMERGENCIA ACTIVADA EN CASETA]: ${motivo} - ${detalle}`
    };

    try {
      const res = await window.SICA_API.createBitacora(payload);
      this.cerrarModalEmergencia();
      window.App.playEmergencyTone();
      alert('¡ALERTA DE EMERGENCIA TRANSMITIDA! Notificando a Supervisores en tiempo real.');
      this.actualizarEstatusConexion();
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  }
};
