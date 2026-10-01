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

module.exports = router;
