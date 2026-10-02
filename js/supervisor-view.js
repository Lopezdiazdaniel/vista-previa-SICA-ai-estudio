// SICA - Módulo de Supervisión Operativa (Supervisor View)
window.SupervisorView = {
  pollingInterval: null,
  activeTab: 'monitoreo',

  async render(container) {
    container.innerHTML = `
      <div class="nav-tabs">
        <button class="nav-tab-btn active" data-tab="monitoreo" onclick="SupervisorView.switchTab('monitoreo')">
          🚨 Monitoreo de Zona en Vivo
        </button>
        <button class="nav-tab-btn" data-tab="bitacora" onclick="SupervisorView.switchTab('bitacora')">
          📝 Validación de Incidencias
        </button>
        <button class="nav-tab-btn" data-tab="accesos" onclick="SupervisorView.switchTab('accesos')">
          🚪 Accesos de Caseta
        </button>
        <button class="nav-tab-btn" data-tab="personal" onclick="SupervisorView.switchTab('personal')">
          👮 Personal en Turno
        </button>
      </div>

      <div id="supervisor-content" style="padding: 1.5rem; max-width: 1300px; margin: 0 auto; width: 100%;">
        <!-- Dynamic Content -->
      </div>
    `;

    await this.renderCurrentTab();
    this.startEmergencyPolling();
  },

  switchTab(tab) {
    if (this.activeTab !== tab) {
      if (window.App && window.App.pushHistory) {
        window.App.pushHistory({ type: 'supervisor-tab', tab: this.activeTab });
      }
    }
    this.activeTab = tab;
    const btns = document.querySelectorAll('.nav-tabs .nav-tab-btn');
    btns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    this.renderCurrentTab();
  },

  async renderCurrentTab() {
    const cont = document.getElementById('supervisor-content');
    if (!cont) return;

    if (this.activeTab === 'monitoreo') {
      await this.renderMonitoreo(cont);
    } else if (this.activeTab === 'bitacora') {
      await this.renderValidacionBitacora(cont);
    } else if (this.activeTab === 'accesos') {
      await this.renderAccesosZona(cont);
    } else if (this.activeTab === 'personal') {
      await this.renderPersonalZona(cont);
    }
  },

  // ==========================================
  // TAB 1: MONITOREO DE ZONA EN VIVO
  // ==========================================
  async renderMonitoreo(container) {
    try {
      const emergenciesRes = await window.SICA_API.getActiveEmergencies();
      const metrics = await window.SICA_API.getDashboardMetrics();

      let emergencyHtml = '';
      if (emergenciesRes.hayEmergencias) {
        // Trigger emergency sound effect!
        window.App.playEmergencyTone();

        emergencyHtml = `
          <div style="background: rgba(239, 68, 68, 0.2); border: 2px solid #ef4444; border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 2rem;">🚨</span>
                <h3 style="color: #f87171; font-size: 1.3rem; font-weight: 900; text-transform: uppercase;">
                  ¡ATENCIÓN: ${emergenciesRes.total} ALERTA(S) DE EMERGENCIA PENDIENTE(S)!
                </h3>
              </div>
              <span class="badge badge-danger">Prioridad Crítica</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${emergenciesRes.emergencias.map(e => `
                <div style="background: #1e1b2e; border: 1px solid #ef4444; border-radius: var(--radius-md); padding: 1rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;">
                  <div>
                    <div style="font-weight: 800; font-size: 1.05rem; color: #fff;">🏢 ${e.nombre_servicio}</div>
                    <div style="font-size: 0.85rem; color: #fca5a5; margin: 4px 0;"><strong>Reportó:</strong> ${e.nombre_guardia} (Tel: ${e.telefono_guardia || 'N/A'}) - ${e.fecha_hora_registro}</div>
                    <div style="color: #fff; font-size: 0.95rem; margin-top: 4px;">"${e.descripcion}"</div>
                    ${e.fotografia_adjunta ? `<div style="margin-top: 6px;"><a href="/uploads/evidencias/${e.fotografia_adjunta}" target="_blank" style="color: #38bdf8; text-decoration: underline; font-size: 0.85rem;">📸 Ver Evidencia Fotográfica</a></div>` : ''}
                  </div>
                  <div>
                    <button class="btn-danger" style="padding: 10px 18px; font-size: 0.95rem;" onclick="SupervisorView.abrirModalAtenderEmergencia(${e.id_bitacora}, '${e.nombre_servicio.replace(/'/g, "\\'")}')">
                      ⚡ Atender Emergencia
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      container.innerHTML = `
        ${emergencyHtml}

        <div class="metrics-grid">
          <div class="metric-card ${emergenciesRes.hayEmergencias ? 'alert' : ''}">
            <span class="metric-label">Emergencias Activas</span>
            <span class="metric-value" style="color: ${emergenciesRes.hayEmergencias ? '#ef4444' : '#fff'};">${emergenciesRes.total}</span>
            <span class="metric-sub">Monitoreo 24/7 en campo</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Accesos en Caseta Hoy</span>
            <span class="metric-value">${metrics.resumen.accesosHoy}</span>
            <span class="metric-sub">Entradas y salidas validadas</span>
          </div>
          <div class="metric-card success">
            <span class="metric-label">Personal Activo</span>
            <span class="metric-value">${metrics.resumen.guardiasActivos}</span>
            <span class="metric-sub">Oficiales cubriendo casetas</span>
          </div>
        </div>

        <!-- Gráfico de Líneas Chart.js: Flujo de Entradas y Salidas (Últimos 7 Días) -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; margin-top: 1.5rem; box-shadow: var(--shadow-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.25rem;">📈</span>
                <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff;">Tendencia de Accesos (Últimos 7 Días)</h3>
              </div>
              <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 2px;">
                Comparativa diaria de flujo vehicular y peatonal: Entradas vs. Salidas registradas en casetas
              </p>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <select id="supervisor-chart-service-filter" onchange="window.SupervisorView.loadChartData(this.value)" style="background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600; cursor: pointer; outline: none;">
                <option value="">Todos los Inmuebles / Casetas</option>
              </select>
              <button onclick="window.SupervisorView.loadChartData(document.getElementById('supervisor-chart-service-filter')?.value)" class="btn-secondary" style="font-size: 0.8rem; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;" title="Actualizar datos del gráfico">
                <span>🔄</span> Actualizar
              </button>
            </div>
          </div>

          <!-- Resumen de Totales del Gráfico (Clean metadata, Anti-slop) -->
          <div id="chart-summary-stats" style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background: #10b981;"></span>
              <span style="color: var(--text-muted);">Total Entradas:</span>
              <strong id="stat-total-entradas" style="color: #34d399; font-size: 1rem;">--</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background: #0284c7;"></span>
              <span style="color: var(--text-muted);">Total Salidas:</span>
              <strong id="stat-total-salidas" style="color: #38bdf8; font-size: 1rem;">--</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--text-muted);">Flujo Neto Total:</span>
              <strong id="stat-total-movimientos" style="color: #fff; font-size: 1rem;">--</strong>
            </div>
          </div>

          <!-- Canvas del Gráfico Chart.js -->
          <div style="position: relative; height: 280px; width: 100%;">
            <canvas id="chart-accesos-semana"></canvas>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
          <!-- Últimos eventos de bitácora -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-size: 1.1rem; color: #fff;">📝 Novedades e Incidencias Recientes</h3>
              <button class="btn-secondary" style="font-size: 0.75rem; padding: 4px 8px;" onclick="SupervisorView.switchTab('bitacora')">Ver Todo</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${(metrics.ultimasBitacoras || []).slice(0, 5).map(b => `
                <div style="padding: 10px; background: var(--bg-surface); border-radius: var(--radius-sm); border-left: 3px solid ${b.nivel_prioridad === 'Emergencia' ? '#ef4444' : b.nivel_prioridad === 'Alta' ? '#f59e0b' : '#38bdf8'};">
                  <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-dim);">
                    <span>${b.nombre_servicio || 'Caseta'}</span>
                    <span>${b.fecha_hora_registro}</span>
                  </div>
                  <div style="font-weight: 700; font-size: 0.85rem; margin: 2px 0;">${b.tipo_evento} - ${b.nombre_guardia}</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">${b.descripcion}</div>
                </div>
              `).join('') || '<div style="color: var(--text-dim);">Sin novedades registradas</div>'}
            </div>
          </div>

          <!-- Últimos accesos de la zona -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-size: 1.1rem; color: #fff;">🚪 Control de Accesos en Vivo</h3>
              <button class="btn-secondary" style="font-size: 0.75rem; padding: 4px 8px;" onclick="SupervisorView.switchTab('accesos')">Ver Todo</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${(metrics.ultimosAccesos || []).slice(0, 5).map(a => `
                <div style="padding: 10px; background: var(--bg-surface); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 700; font-size: 0.85rem;">${a.nombre_visitante}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${a.tipo_visitante} ${a.placas ? `(Placas: ${a.placas})` : ''} ➔ ${a.motivo_o_destino || 'Acceso'}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">${a.nombre_servicio} | ${a.fecha_hora}</div>
                  </div>
                  <span class="badge ${a.tipo_movimiento === 'Entrada' ? 'badge-success' : 'badge-primary'}">${a.tipo_movimiento}</span>
                </div>
              `).join('') || '<div style="color: var(--text-dim);">Sin accesos registrados</div>'}
            </div>
          </div>
        </div>
      `;

      // Initialize Chart.js line chart for 7-day access trend
      await this.initChart();
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar monitoreo: ${err.message}</div>`;
    }
  },

  // ==========================================
  // GRÁFICO CHART.JS: TENDENCIA DE 7 DÍAS
  // ==========================================
  accesosChart: null,

  async initChart(serviceId = null) {
    await this.populateServiceFilter();
    await this.loadChartData(serviceId);
  },

  async populateServiceFilter() {
    const select = document.getElementById('supervisor-chart-service-filter');
    if (!select) return;
    try {
      const res = await window.SICA_API.getServices();
      const services = res.services || [];
      const currentVal = select.value;
      select.innerHTML = '<option value="">Todos los Inmuebles / Casetas</option>' +
        services.map(s => `<option value="${s.id_servicio}">${s.nombre_cliente_o_lugar}</option>`).join('');
      if (currentVal) select.value = currentVal;
    } catch (e) {
      console.warn('Error al cargar servicios para filtro de gráfico:', e);
    }
  },

  async loadChartData(serviceId = null) {
    const canvas = document.getElementById('chart-accesos-semana');
    if (!canvas) return;

    try {
      const data = await window.SICA_API.getAccessTrend7Days(serviceId);

      const elEntradas = document.getElementById('stat-total-entradas');
      const elSalidas = document.getElementById('stat-total-salidas');
      const elTotal = document.getElementById('stat-total-movimientos');
      if (elEntradas) elEntradas.innerText = (data.totales?.entradas || 0).toLocaleString();
      if (elSalidas) elSalidas.innerText = (data.totales?.salidas || 0).toLocaleString();
      if (elTotal) elTotal.innerText = `${(data.totales?.total || 0).toLocaleString()} movimientos`;

      if (typeof Chart === 'undefined') {
        console.warn('Chart.js no está disponible en window.Chart');
        return;
      }

      if (this.accesosChart) {
        this.accesosChart.destroy();
        this.accesosChart = null;
      }

      const ctx = canvas.getContext('2d');

      const gradEntradas = ctx.createLinearGradient(0, 0, 0, 260);
      gradEntradas.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
      gradEntradas.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      const gradSalidas = ctx.createLinearGradient(0, 0, 0, 260);
      gradSalidas.addColorStop(0, 'rgba(2, 132, 199, 0.28)');
      gradSalidas.addColorStop(1, 'rgba(2, 132, 199, 0.0)');

      this.accesosChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [
            {
              label: 'Entradas (Ingresos)',
              data: data.entradas,
              borderColor: '#10b981',
              backgroundColor: gradEntradas,
              borderWidth: 3,
              fill: true,
              tension: 0.35,
              pointBackgroundColor: '#10b981',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 7,
              pointHoverBackgroundColor: '#10b981',
              pointHoverBorderColor: '#ffffff',
              pointHoverBorderWidth: 3
            },
            {
              label: 'Salidas (Egresos)',
              data: data.salidas,
              borderColor: '#0284c7',
              backgroundColor: gradSalidas,
              borderWidth: 3,
              fill: true,
              tension: 0.35,
              pointBackgroundColor: '#0284c7',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 7,
              pointHoverBackgroundColor: '#0284c7',
              pointHoverBorderColor: '#ffffff',
              pointHoverBorderWidth: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: {
                color: '#f8fafc',
                boxWidth: 14,
                boxHeight: 14,
                usePointStyle: true,
                pointStyle: 'circle',
                font: {
                  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  size: 12,
                  weight: '600'
                }
              }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#f8fafc',
              bodyColor: '#cbd5e1',
              borderColor: '#334155',
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8,
              boxPadding: 4,
              usePointStyle: true,
              callbacks: {
                footer: (tooltipItems) => {
                  let sum = 0;
                  tooltipItems.forEach(item => { sum += item.parsed.y; });
                  return `Total día: ${sum} registros`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.05)',
                drawBorder: false
              },
              ticks: {
                color: '#94a3b8',
                font: {
                  size: 11,
                  weight: '500'
                }
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(255, 255, 255, 0.06)',
                drawBorder: false
              },
              ticks: {
                color: '#94a3b8',
                precision: 0,
                font: {
                  size: 11
                }
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('Error al cargar datos del gráfico de accesos:', err);
    }
  },

  // ==========================================
  // TAB 2: VALIDACIÓN DE INCIDENCIAS
  // ==========================================
  async renderValidacionBitacora(container) {
    try {
      const res = await window.SICA_API.getBitacoras({ limit: 50 });

      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 800;">Validación de Bitácoras e Incidencias</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Revisión, confirmación y dictamen de supervisión operativa para eventos de caseta.</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn-secondary" onclick="SupervisorView.exportarExcel()">📊 Exportar a Excel</button>
            <button class="btn-secondary" onclick="SupervisorView.imprimirPDFBitacoras()" title="Generar y descargar documento PDF de incidencias">🖨️ Imprimir / PDF</button>
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
                <th>Estatus</th>
                <th>Acción Supervisor</th>
              </tr>
            </thead>
            <tbody>
              ${res.bitacoras.map(b => `
                <tr style="${b.nivel_prioridad === 'Emergencia' && !b.atendida_supervisor ? 'background: rgba(239, 68, 68, 0.1);' : ''}">
                  <td><strong>#${b.id_bitacora}</strong></td>
                  <td>${b.fecha_hora_registro}</td>
                  <td>${b.nombre_servicio || 'N/A'}</td>
                  <td><span class="badge ${b.tipo_evento === 'Emergencia' ? 'badge-danger' : 'badge-neutral'}">${b.tipo_evento}</span></td>
                  <td><span class="badge ${b.nivel_prioridad === 'Emergencia' ? 'badge-danger' : b.nivel_prioridad === 'Alta' ? 'badge-warning' : 'badge-neutral'}">${b.nivel_prioridad}</span></td>
                  <td>
                    ${b.descripcion}
                    ${b.fotografia_adjunta ? `<br><a href="/uploads/evidencias/${b.fotografia_adjunta}" target="_blank" style="color: var(--primary); font-size: 0.75rem;">Ver Foto Adjunta</a>` : ''}
                  </td>
                  <td>${b.nombre_guardia || 'N/A'}</td>
                  <td>
                    ${b.atendida_supervisor
                      ? `<span class="badge badge-success">Atendida</span><br><small style="color:var(--text-dim);">${b.notas_supervisor || ''}</small>`
                      : '<span class="badge badge-warning">Sin validar</span>'}
                  </td>
                  <td>
                    ${!b.atendida_supervisor ? `
                      <button class="btn-primary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="SupervisorView.abrirModalAtenderEmergencia(${b.id_bitacora}, '${(b.nombre_servicio||'').replace(/'/g, "\\'")}')">
                        Validar
                      </button>
                    ` : '<span style="color: var(--text-dim); font-size: 0.8rem;">✓ Concluida</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar bitácoras: ${err.message}</div>`;
    }
  },

  // ==========================================
  // TAB 3: ACCESOS DE LA ZONA
  // ==========================================
  async renderAccesosZona(container) {
    try {
      const res = await window.SICA_API.getAccesos({ limit: 50 });
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 12px;">
          <h2 style="font-size: 1.3rem; font-weight: 800;">Registro de Accesos de Zona</h2>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn-secondary" onclick="SupervisorView.exportarExcel()">📊 Exportar Excel</button>
            <button class="btn-secondary" onclick="SupervisorView.imprimirPDFAccesos()" title="Generar y descargar documento PDF de accesos">🖨️ Imprimir / PDF</button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha/Hora</th>
                <th>Caseta</th>
                <th>Movimiento</th>
                <th>Tipo</th>
                <th>Nombre</th>
                <th>Placas / ID</th>
                <th>Destino</th>
                <th>Guardia</th>
              </tr>
            </thead>
            <tbody>
              ${res.accesos.map(a => `
                <tr>
                  <td><strong>#${a.id_acceso}</strong></td>
                  <td>${a.fecha_hora}</td>
                  <td>${a.nombre_servicio || 'N/A'}</td>
                  <td><span class="badge ${a.tipo_movimiento === 'Entrada' ? 'badge-success' : 'badge-primary'}">${a.tipo_movimiento}</span></td>
                  <td>${a.tipo_visitante}</td>
                  <td><strong>${a.nombre_visitante}</strong></td>
                  <td>${a.placas || a.identificacion_num || '-'}</td>
                  <td>${a.motivo_o_destino || '-'}</td>
                  <td>${a.nombre_guardia || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar accesos: ${err.message}</div>`;
    }
  },

  // ==========================================
  // TAB 4: PERSONAL EN TURNO
  // ==========================================
  async renderPersonalZona(container) {
    try {
      const shiftsRes = await window.SICA_API.getShifts({ activos: 'true' });
      const consignasRes = await window.SICA_API.getConsignas({ vigentes: 'true' });

      container.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.3rem; font-weight: 800;">Personal Operativo y Consignas en Vigencia</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Verificación de cobertura de casetas y consignas activas.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem;">
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 1rem;">👮 Oficiales Cubriendo Turno Actualmente</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${shiftsRes.shifts.map(s => `
                <div style="padding: 10px; background: var(--bg-surface); border-radius: var(--radius-sm);">
                  <div style="font-weight: 700;">${s.nombre_guardia} (${s.num_empleado_placa || 'GDA'})</div>
                  <div style="font-size: 0.8rem; color: var(--primary);">🏢 ${s.nombre_servicio}</div>
                  <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;">Horario: ${s.fecha_inicio_turno} a ${s.fecha_fin_turno}</div>
                </div>
              `).join('') || '<div style="color: var(--text-dim);">No hay turnos activos en este momento</div>'}
            </div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 1rem;">📋 Consignas de Caseta Vigentes</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${consignasRes.consignas.map(c => `
                <div style="padding: 10px; background: var(--bg-surface); border-radius: var(--radius-sm); border-left: 3px solid #0284c7;">
                  <div style="font-weight: 700; font-size: 0.9rem;">${c.titulo}</div>
                  <div style="font-size: 0.8rem; color: var(--primary);">🏢 ${c.nombre_servicio}</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">${c.contenido}</div>
                </div>
              `).join('') || '<div style="color: var(--text-dim);">No hay consignas vigentes</div>'}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="toast error">Error al cargar datos de personal: ${err.message}</div>`;
    }
  },

  // ==========================================
  // MODAL ATENDER EMERGENCIA / VALIDAR
  // ==========================================
  abrirModalAtenderEmergencia(id_bitacora, servicio) {
    const modalHtml = `
      <div class="modal-overlay active" id="modal-atender-emergencia">
        <div class="modal-content">
          <div class="modal-header" style="background: #1e1b2e;">
            <h3 style="color: #f87171;">⚡ Atención y Validación de Supervisión (#${id_bitacora})</h3>
            <button class="modal-close" onclick="SupervisorView.cerrarModal()">&times;</button>
          </div>
          <form onsubmit="SupervisorView.guardarAtencionEmergencia(event, ${id_bitacora})">
            <div class="modal-body">
              <div style="margin-bottom: 12px; font-weight: 600; font-size: 0.95rem;">
                Inmueble / Caseta: <span style="color: #38bdf8;">${servicio}</span>
              </div>
              <div class="form-group">
                <label>Notas de Supervisión y Medidas Tomadas en Campo *</label>
                <textarea name="notas_supervisor" class="form-textarea" rows="4" required placeholder="Especifique las acciones realizadas: arribo de patrulla, llamada a servicios de emergencia, comunicación con cliente..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="SupervisorView.cerrarModal()">Cancelar</button>
              <button type="submit" class="btn-danger">Confirmar Atención y Resolver Alerta</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);
  },

  async guardarAtencionEmergencia(e, id) {
    e.preventDefault();
    const form = e.target;
    const notas = form.notas_supervisor.value;

    try {
      await window.SICA_API.atenderBitacora(id, notas);
      window.App.showToast('Emergencia/Incidencia marcada como atendida exitosamente', 'success');
      this.cerrarModal();
      this.renderCurrentTab();
    } catch (err) {
      window.App.showToast(err.message, 'error');
    }
  },

  cerrarModal() {
    const m = document.getElementById('modal-atender-emergencia');
    if (m) m.remove();
  },

  async exportarExcel() {
    try {
      window.App.showToast('Generando libro de Excel...', 'info');
      const url = window.SICA_API.getExcelExportUrl();
      const fn = await window.SICA_API.downloadExport(url, 'Reporte_Supervision_SICA.xlsx');
      window.App.showToast(`Archivo ${fn} descargado exitosamente`, 'success');
    } catch (e) {
      window.App.showToast(e.message, 'error');
    }
  },

  async imprimirPDFAccesos() {
    try {
      window.App.showToast('Generando documento PDF oficial de accesos...', 'info');
      const res = await window.SICA_API.getAccesos({ limit: 200 });
      if (!res.accesos || res.accesos.length === 0) {
        window.App.showToast('No hay registros de acceso para generar el PDF', 'warning');
        return;
      }
      const fn = await window.SICA_PDF.exportarAccesosPDF(res.accesos, {
        titulo: 'SUPERVISIÓN OPERATIVA · CONTROL DE ACCESOS'
      });
      window.App.showToast(`Documento PDF ${fn} descargado exitosamente`, 'success');
    } catch (e) {
      console.error('Error al generar PDF de accesos:', e);
      window.App.showToast('Error al generar PDF: ' + e.message, 'error');
    }
  },

  async imprimirPDFBitacoras() {
    try {
      window.App.showToast('Generando documento PDF de incidencias...', 'info');
      const res = await window.SICA_API.getBitacoras({ limit: 200 });
      if (!res.bitacoras || res.bitacoras.length === 0) {
        window.App.showToast('No hay registros de bitácora para generar el PDF', 'warning');
        return;
      }
      const fn = await window.SICA_PDF.exportarBitacorasPDF(res.bitacoras, {
        titulo: 'SUPERVISIÓN OPERATIVA · VALIDACIÓN DE INCIDENCIAS'
      });
      window.App.showToast(`Documento PDF ${fn} descargado exitosamente`, 'success');
    } catch (e) {
      console.error('Error al generar PDF de bitácoras:', e);
      window.App.showToast('Error al generar PDF: ' + e.message, 'error');
    }
  },

  // ==========================================
  // REAL-TIME EMERGENCY POLLING (RF-03 & 6)
  // ==========================================
  startEmergencyPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    // Poll every 8 seconds for new active emergencies
    this.pollingInterval = setInterval(async () => {
      // Check if user is still supervisor and on page
      const user = window.SICA_API.getStoredUser();
      if (!user || user.rol !== 'Supervisor') {
        clearInterval(this.pollingInterval);
        return;
      }

      try {
        const res = await window.SICA_API.getActiveEmergencies();
        const banner = document.getElementById('emergency-banner');

        if (res.hayEmergencias) {
          if (banner) {
            banner.classList.add('active');
            banner.innerHTML = `
              <span>🚨 ¡ALERTA CRÍTICA: ${res.total} EMERGENCIA(S) REPORTADA(S) EN CASETA!</span>
              <button class="btn-secondary" style="background:#fff; color:#991b1b; font-weight:800;" onclick="SupervisorView.switchTab('monitoreo')">VER AHORA</button>
            `;
          }
          window.App.playEmergencyTone();
        } else {
          if (banner) banner.classList.remove('active');
        }
      } catch (e) {
        // network silent in background
      }
    }, 8000);
  }
};
