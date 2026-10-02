const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/reports/dashboard - Global dashboard statistics
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const { id_servicio } = req.query;
    let serviceFilter = '';
    const params = [];

    if (id_servicio) {
      serviceFilter = ' AND id_servicio = ?';
      params.push(Number(id_servicio));
    }

    // Today's total accesses
    const totalAccesosHoy = await db.get(
      `SELECT COUNT(*) as total FROM accesos WHERE date(fecha_hora) = date('now', 'localtime')${serviceFilter}`,
      params
    );

    // Today's entries vs exits
    const entradasHoy = await db.get(
      `SELECT COUNT(*) as total FROM accesos WHERE tipo_movimiento = 'Entrada' AND date(fecha_hora) = date('now', 'localtime')${serviceFilter}`,
      params
    );

    const salidasHoy = await db.get(
      `SELECT COUNT(*) as total FROM accesos WHERE tipo_movimiento = 'Salida' AND date(fecha_hora) = date('now', 'localtime')${serviceFilter}`,
      params
    );

    // Access breakdown by visitor type
    const porTipoVisitante = await db.query(
      `SELECT tipo_visitante, COUNT(*) as cantidad
       FROM accesos
       WHERE date(fecha_hora) = date('now', 'localtime')${serviceFilter}
       GROUP BY tipo_visitante`,
      params
    );

    // Total active services
    const totalServicios = await db.get("SELECT COUNT(*) as total FROM servicios WHERE estatus = 'Activo'");

    // Total guards active
    const guardiasActivos = await db.get("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'Guardia' AND estatus = 'Activo'");

    // Active unhandled emergencies
    const emergenciasActivas = await db.get(
      `SELECT COUNT(*) as total FROM bitacoras
       WHERE (tipo_evento = 'Emergencia' OR nivel_prioridad = 'Emergencia') AND atendida_supervisor = 0${serviceFilter}`,
      params
    );

    // Total incidents today
    const incidenciasHoy = await db.get(
      `SELECT COUNT(*) as total FROM bitacoras
       WHERE tipo_evento IN ('Incidencia Operativa', 'Emergencia') AND date(fecha_hora_registro) = date('now', 'localtime')${serviceFilter}`,
      params
    );

    // Recent 10 accesses
    const ultimosAccesos = await db.query(
      `SELECT a.*, s.nombre_cliente_o_lugar as nombre_servicio, u.nombre_completo as nombre_guardia
       FROM accesos a
       LEFT JOIN servicios s ON a.id_servicio = s.id_servicio
       LEFT JOIN usuarios u ON a.id_guardia = u.id_usuario
       WHERE 1=1 ${serviceFilter}
       ORDER BY a.fecha_hora DESC LIMIT 10`,
      params
    );

    // Recent 10 logbook entries
    const ultimasBitacoras = await db.query(
      `SELECT b.*, s.nombre_cliente_o_lugar as nombre_servicio, u.nombre_completo as nombre_guardia
       FROM bitacoras b
       LEFT JOIN servicios s ON b.id_servicio = s.id_servicio
       LEFT JOIN usuarios u ON b.id_guardia = u.id_usuario
       WHERE 1=1 ${serviceFilter}
       ORDER BY b.fecha_hora_registro DESC LIMIT 10`,
      params
    );

    return res.json({
      resumen: {
        accesosHoy: totalAccesosHoy ? totalAccesosHoy.total : 0,
        entradasHoy: entradasHoy ? entradasHoy.total : 0,
        salidasHoy: salidasHoy ? salidasHoy.total : 0,
        totalServicios: totalServicios ? totalServicios.total : 0,
        guardiasActivos: guardiasActivos ? guardiasActivos.total : 0,
        emergenciasActivas: emergenciasActivas ? emergenciasActivas.total : 0,
        incidenciasHoy: incidenciasHoy ? incidenciasHoy.total : 0
      },
      porTipoVisitante,
      ultimosAccesos,
      ultimasBitacoras
    });
  } catch (error) {
    console.error('Error al generar métricas del dashboard:', error);
    return res.status(500).json({ error: 'Error al generar el resumen gerencial' });
  }
});

// GET /api/reports/access-trend-7days - 7-day trend of entries and exits for line chart
router.get('/access-trend-7days', verifyToken, async (req, res) => {
  try {
    const { id_servicio } = req.query;
    let serviceFilter = '';
    const params = [];

    if (id_servicio) {
      serviceFilter = ' AND id_servicio = ?';
      params.push(Number(id_servicio));
    }

    // Generate last 7 dates in YYYY-MM-DD
    const days = [];
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const labels = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const isoDate = `${year}-${month}-${dayNum}`;
      days.push(isoDate);

      const dayName = diasSemana[d.getDay()];
      labels.push(`${dayName} ${dayNum}/${month}`);
    }

    const startDate = days[0];
    const endDate = days[days.length - 1];

    const rows = await db.query(
      `SELECT date(fecha_hora) as fecha, tipo_movimiento, COUNT(*) as total
       FROM accesos
       WHERE date(fecha_hora) >= ? AND date(fecha_hora) <= ?
       ${serviceFilter}
       GROUP BY date(fecha_hora), tipo_movimiento
       ORDER BY fecha ASC`,
      [startDate, endDate, ...params]
    );

    const entradas = [];
    const salidas = [];

    for (const day of days) {
      const entradaRow = rows.find(r => r.fecha === day && r.tipo_movimiento === 'Entrada');
      const salidaRow = rows.find(r => r.fecha === day && r.tipo_movimiento === 'Salida');

      entradas.push(entradaRow ? entradaRow.total : 0);
      salidas.push(salidaRow ? salidaRow.total : 0);
    }

    const totalEntradas = entradas.reduce((a, b) => a + b, 0);
    const totalSalidas = salidas.reduce((a, b) => a + b, 0);

    return res.json({
      days,
      labels,
      entradas,
      salidas,
      totales: {
        entradas: totalEntradas,
        salidas: totalSalidas,
        total: totalEntradas + totalSalidas
      }
    });
  } catch (error) {
    console.error('Error al calcular tendencia de 7 días:', error);
    return res.status(500).json({ error: 'Error al obtener la tendencia de accesos de 7 días' });
  }
});

// GET /api/reports/export/excel - Generate and download native Excel file
router.get('/export/excel', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const { id_servicio, fecha_inicio, fecha_fin } = req.query;

    let filterAccesos = ' WHERE 1=1';
    let filterBitacoras = ' WHERE 1=1';
    const paramsAccesos = [];
    const paramsBitacoras = [];

    if (id_servicio) {
      filterAccesos += ' AND a.id_servicio = ?';
      paramsAccesos.push(Number(id_servicio));
      filterBitacoras += ' AND b.id_servicio = ?';
      paramsBitacoras.push(Number(id_servicio));
    }

    if (fecha_inicio) {
      filterAccesos += ' AND a.fecha_hora >= ?';
      paramsAccesos.push(`${fecha_inicio} 00:00:00`);
      filterBitacoras += ' AND b.fecha_hora_registro >= ?';
      paramsBitacoras.push(`${fecha_inicio} 00:00:00`);
    }

    if (fecha_fin) {
      filterAccesos += ' AND a.fecha_hora <= ?';
      paramsAccesos.push(`${fecha_fin} 23:59:59`);
      filterBitacoras += ' AND b.fecha_hora_registro <= ?';
      paramsBitacoras.push(`${fecha_fin} 23:59:59`);
    }

    // 1. Accesos data
    const accesos = await db.query(
      `SELECT a.id_acceso as 'Folio',
              s.nombre_cliente_o_lugar as 'Servicio / Caseta',
              a.fecha_hora as 'Fecha y Hora',
              u.nombre_completo as 'Oficial en Turno',
              a.tipo_movimiento as 'Movimiento',
              a.tipo_visitante as 'Tipo Visitante',
              a.nombre_visitante as 'Nombre Visitante',
              a.identificacion_tipo as 'Tipo ID',
              a.identificacion_num as 'Num ID',
              a.placas as 'Placas',
              a.datos_vehiculo as 'Vehículo',
              a.motivo_o_destino as 'Destino / Motivo',
              a.observaciones as 'Observaciones',
              CASE WHEN a.sincronizado_offline = 1 THEN 'Sí' ELSE 'No' END as 'Modo Offline'
       FROM accesos a
       LEFT JOIN servicios s ON a.id_servicio = s.id_servicio
       LEFT JOIN usuarios u ON a.id_guardia = u.id_usuario
       ${filterAccesos}
       ORDER BY a.fecha_hora DESC`,
      paramsAccesos
    );

    // 2. Bitácora data
    const bitacoras = await db.query(
      `SELECT b.id_bitacora as 'Folio',
              s.nombre_cliente_o_lugar as 'Servicio / Caseta',
              b.fecha_hora_registro as 'Fecha y Hora',
              u.nombre_completo as 'Oficial',
              b.tipo_evento as 'Tipo de Evento',
              b.nivel_prioridad as 'Prioridad',
              b.descripcion as 'Descripción',
              CASE WHEN b.atendida_supervisor = 1 THEN 'Atendida' ELSE 'Pendiente' END as 'Estatus Supervisión',
              b.fecha_atencion as 'Fecha Atención',
              b.notas_supervisor as 'Notas de Supervisión'
       FROM bitacoras b
       LEFT JOIN servicios s ON b.id_servicio = s.id_servicio
       LEFT JOIN usuarios u ON b.id_guardia = u.id_usuario
       ${filterBitacoras}
       ORDER BY b.fecha_hora_registro DESC`,
      paramsBitacoras
    );

    // Create workbook
    const wb = XLSX.utils.book_new();

    const wsAccesos = XLSX.utils.json_to_sheet(accesos.length > 0 ? accesos : [{ Aviso: 'Sin registros de accesos en el periodo seleccionado' }]);
    const wsBitacoras = XLSX.utils.json_to_sheet(bitacoras.length > 0 ? bitacoras : [{ Aviso: 'Sin registros de bitácora en el periodo seleccionado' }]);

    XLSX.utils.book_append_sheet(wb, wsAccesos, 'Control de Accesos');
    XLSX.utils.book_append_sheet(wb, wsBitacoras, 'Bitacora y Novedades');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `Reporte_SICA_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    console.error('Error al exportar Excel:', error);
    return res.status(500).json({ error: 'Error al generar el archivo Excel' });
  }
});

// GET /api/reports/export/csv - CSV format export
router.get('/export/csv', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const { tipo = 'accesos', id_servicio, fecha_inicio, fecha_fin } = req.query;

    if (tipo === 'bitacora') {
      let filter = ' WHERE 1=1';
      const params = [];
      if (id_servicio) {
        filter += ' AND b.id_servicio = ?';
        params.push(Number(id_servicio));
      }
      if (fecha_inicio) {
        filter += ' AND b.fecha_hora_registro >= ?';
        params.push(`${fecha_inicio} 00:00:00`);
      }
      if (fecha_fin) {
        filter += ' AND b.fecha_hora_registro <= ?';
        params.push(`${fecha_fin} 23:59:59`);
      }

      const rows = await db.query(
        `SELECT b.id_bitacora, s.nombre_cliente_o_lugar, b.fecha_hora_registro, u.nombre_completo,
                b.tipo_evento, b.nivel_prioridad, b.descripcion, b.atendida_supervisor
         FROM bitacoras b
         LEFT JOIN servicios s ON b.id_servicio = s.id_servicio
         LEFT JOIN usuarios u ON b.id_guardia = u.id_usuario
         ${filter} ORDER BY b.fecha_hora_registro DESC`,
        params
      );

      let csv = 'Folio,Servicio,Fecha_Hora,Guardia,Tipo_Evento,Prioridad,Descripcion,Atendida\n';
      rows.forEach(r => {
        csv += `"${r.id_bitacora}","${(r.nombre_cliente_o_lugar||'').replace(/"/g, '""')}","${r.fecha_hora_registro}","${(r.nombre_completo||'').replace(/"/g, '""')}","${r.tipo_evento}","${r.nivel_prioridad}","${(r.descripcion||'').replace(/"/g, '""')}",${r.atendida_supervisor}\n`;
      });

      res.setHeader('Content-Disposition', 'attachment; filename="Bitacora_SICA.csv"');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send('\uFEFF' + csv);
    } else {
      let filter = ' WHERE 1=1';
      const params = [];
      if (id_servicio) {
        filter += ' AND a.id_servicio = ?';
        params.push(Number(id_servicio));
      }
      if (fecha_inicio) {
        filter += ' AND a.fecha_hora >= ?';
        params.push(`${fecha_inicio} 00:00:00`);
      }
      if (fecha_fin) {
        filter += ' AND a.fecha_hora <= ?';
        params.push(`${fecha_fin} 23:59:59`);
      }

      const rows = await db.query(
        `SELECT a.id_acceso, s.nombre_cliente_o_lugar, a.fecha_hora, u.nombre_completo,
                a.tipo_movimiento, a.tipo_visitante, a.nombre_visitante, a.placas, a.datos_vehiculo, a.motivo_o_destino
         FROM accesos a
         LEFT JOIN servicios s ON a.id_servicio = s.id_servicio
         LEFT JOIN usuarios u ON a.id_guardia = u.id_usuario
         ${filter} ORDER BY a.fecha_hora DESC`,
        params
      );

      let csv = 'Folio,Servicio,Fecha_Hora,Guardia,Movimiento,Tipo_Visitante,Nombre_Visitante,Placas,Vehiculo,Destino\n';
      rows.forEach(r => {
        csv += `"${r.id_acceso}","${(r.nombre_cliente_o_lugar||'').replace(/"/g, '""')}","${r.fecha_hora}","${(r.nombre_completo||'').replace(/"/g, '""')}","${r.tipo_movimiento}","${r.tipo_visitante}","${(r.nombre_visitante||'').replace(/"/g, '""')}","${r.placas||''}","${(r.datos_vehiculo||'').replace(/"/g, '""')}","${(r.motivo_o_destino||'').replace(/"/g, '""')}"\n`;
      });

      res.setHeader('Content-Disposition', 'attachment; filename="Accesos_SICA.csv"');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send('\uFEFF' + csv);
    }
  } catch (error) {
    console.error('Error al exportar CSV:', error);
    return res.status(500).json({ error: 'Error al exportar CSV' });
  }
});

// GET /api/reports/export/pdf - Server-side PDF export
router.get('/export/pdf', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const { jsPDF } = require('jspdf');
    const autoTablePlugin = require('jspdf-autotable');
    const runAutoTable = (docInstance, options) => {
      if (typeof docInstance.autoTable === 'function') {
        return docInstance.autoTable(options);
      } else if (typeof autoTablePlugin.default === 'function') {
        return autoTablePlugin.default(docInstance, options);
      } else if (typeof autoTablePlugin === 'function') {
        return autoTablePlugin(docInstance, options);
      }
    };

    const { tipo = 'accesos', id_servicio, fecha_inicio, fecha_fin } = req.query;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    // Top Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 28, pageWidth, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('SICA · SEGURIDAD PRIVADA', 14, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(186, 230, 253);
    doc.text('DOCUMENTO OFICIAL DE AUDITORÍA PATRIMONIAL', 14, 21);

    const nowStr = new Date().toLocaleString('es-MX');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`FECHA EMISIÓN: ${nowStr}`, pageWidth - 14, 15, { align: 'right' });

    let filter = ' WHERE 1=1';
    const params = [];
    if (id_servicio) {
      filter += ' AND a.id_servicio = ?';
      params.push(Number(id_servicio));
    }
    if (fecha_inicio) {
      filter += ' AND a.fecha_hora >= ?';
      params.push(`${fecha_inicio} 00:00:00`);
    }
    if (fecha_fin) {
      filter += ' AND a.fecha_hora <= ?';
      params.push(`${fecha_fin} 23:59:59`);
    }

    if (tipo === 'bitacora') {
      let bFilter = ' WHERE 1=1';
      const bParams = [];
      if (id_servicio) { bFilter += ' AND b.id_servicio = ?'; bParams.push(Number(id_servicio)); }
      if (fecha_inicio) { bFilter += ' AND b.fecha_hora_registro >= ?'; bParams.push(`${fecha_inicio} 00:00:00`); }
      if (fecha_fin) { bFilter += ' AND b.fecha_hora_registro <= ?'; bParams.push(`${fecha_fin} 23:59:59`); }

      const rows = await db.query(
        `SELECT b.id_bitacora, s.nombre_cliente_o_lugar, b.fecha_hora_registro, u.nombre_completo,
                b.tipo_evento, b.nivel_prioridad, b.descripcion, b.atendida_supervisor
         FROM bitacoras b
         LEFT JOIN servicios s ON b.id_servicio = s.id_servicio
         LEFT JOIN usuarios u ON b.id_guardia = u.id_usuario
         ${bFilter} ORDER BY b.fecha_hora_registro DESC LIMIT 200`,
        bParams
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text('REPORTE OFICIAL DE BITÁCORA OPERATIVA E INCIDENCIAS', 14, 38);

      const tableBody = rows.map(r => [
        `#${r.id_bitacora}`,
        r.fecha_hora_registro || '-',
        r.nombre_cliente_o_lugar || 'Caseta',
        r.tipo_evento,
        r.nivel_prioridad,
        r.descripcion || '-',
        r.nombre_completo || '-',
        r.atendida_supervisor ? 'Atendida' : 'Pendiente'
      ]);

      runAutoTable(doc, {
        startY: 44,
        head: [['FOLIO', 'FECHA/HORA', 'CASETA', 'EVENTO', 'PRIORIDAD', 'DESCRIPCIÓN', 'OFICIAL', 'SUPERVISIÓN']],
        body: tableBody.length ? tableBody : [['-', '-', '-', 'Sin registros', '-', '-', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }
      });
    } else {
      const rows = await db.query(
        `SELECT a.id_acceso, s.nombre_cliente_o_lugar, a.fecha_hora, u.nombre_completo,
                a.tipo_movimiento, a.tipo_visitante, a.nombre_visitante, a.placas, a.motivo_o_destino
         FROM accesos a
         LEFT JOIN servicios s ON a.id_servicio = s.id_servicio
         LEFT JOIN usuarios u ON a.id_guardia = u.id_usuario
         ${filter} ORDER BY a.fecha_hora DESC LIMIT 200`,
        params
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text('REPORTE OFICIAL DE CONTROL DE ACCESOS (ENTRADAS Y SALIDAS)', 14, 38);

      const tableBody = rows.map(r => [
        `#${r.id_acceso}`,
        r.fecha_hora || '-',
        r.nombre_cliente_o_lugar || 'Caseta',
        r.tipo_movimiento,
        r.tipo_visitante,
        r.nombre_visitante || '-',
        r.placas || '-',
        r.motivo_o_destino || '-',
        r.nombre_completo || '-'
      ]);

      runAutoTable(doc, {
        startY: 44,
        head: [['FOLIO', 'FECHA/HORA', 'CASETA', 'MOVIMIENTO', 'TIPO', 'VISITANTE', 'PLACAS', 'DESTINO', 'OFICIAL']],
        body: tableBody.length ? tableBody : [['-', '-', '-', 'Sin registros', '-', '-', '-', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }
      });
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const filename = `Reporte_${tipo}_SICA_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al exportar PDF en servidor:', error);
    return res.status(500).json({ error: 'Error al generar el documento PDF' });
  }
});

module.exports = router;
