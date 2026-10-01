const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadEvidencia, evidenciasDir } = require('../middleware/upload');

// Helper to save base64 image if submitted from camera
function saveBase64Image(dataUri) {
  if (!dataUri || !dataUri.startsWith('data:image')) return null;
  const matches = dataUri.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;
  const ext = matches[1].replace('jpeg', 'jpg');
  const filename = `bitacora_${Date.now()}_${Math.round(Math.random() * 1e6)}.${ext}`;
  const filePath = path.join(evidenciasDir, filename);
  fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
  return filename;
}

// GET /api/logbook - Query logbook entries
router.get('/', verifyToken, async (req, res) => {
  try {
    const {
      id_servicio,
      tipo_evento,
      nivel_prioridad,
      solo_emergencias,
      fecha_inicio,
      fecha_fin,
      limit = 100,
      offset = 0
    } = req.query;

    let sql = `
      SELECT b.*,
             s.nombre_cliente_o_lugar as nombre_servicio,
             s.contacto_emergencia,
             u.nombre_completo as nombre_guardia,
             u.num_empleado_placa as placa_guardia
      FROM bitacoras b
      LEFT JOIN servicios s ON b.id_servicio = s.id_servicio
      LEFT JOIN usuarios u ON b.id_guardia = u.id_usuario
      WHERE 1=1
    `;
    const params = [];

    if (req.user.rol === 'Guardia' && req.user.id_servicio_asignado) {
      sql += ' AND b.id_servicio = ?';
      params.push(req.user.id_servicio_asignado);
    } else if (id_servicio) {
      sql += ' AND b.id_servicio = ?';
      params.push(Number(id_servicio));
    }

    if (tipo_evento) {
      sql += ' AND b.tipo_evento = ?';
      params.push(tipo_evento);
    }

    if (nivel_prioridad) {
      sql += ' AND b.nivel_prioridad = ?';
      params.push(nivel_prioridad);
    }

    if (solo_emergencias === 'true') {
      sql += " AND (b.tipo_evento = 'Emergencia' OR b.nivel_prioridad = 'Emergencia')";
    }

    if (fecha_inicio) {
      sql += ' AND b.fecha_hora_registro >= ?';
      params.push(fecha_inicio.length === 10 ? `${fecha_inicio} 00:00:00` : fecha_inicio);
    }

    if (fecha_fin) {
      sql += ' AND b.fecha_hora_registro <= ?';
      params.push(fecha_fin.length === 10 ? `${fecha_fin} 23:59:59` : fecha_fin);
    }

    sql += " ORDER BY (b.tipo_evento = 'Emergencia' AND b.atendida_supervisor = 0) DESC, b.fecha_hora_registro DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const bitacoras = await db.query(sql, params);
    return res.json({ bitacoras });
  } catch (error) {
    console.error('Error al consultar bitácora:', error);
    return res.status(500).json({ error: 'Error al consultar la bitácora operativa' });
  }
});

// GET /api/logbook/emergencies/active - Get unhandled emergencies for real-time supervisor alerts
router.get('/emergencies/active', verifyToken, async (req, res) => {
  try {
    let sql = `
      SELECT b.*,
             s.nombre_cliente_o_lugar as nombre_servicio,
             s.contacto_emergencia,
             u.nombre_completo as nombre_guardia,
             u.telefono as telefono_guardia
      FROM bitacoras b
      LEFT JOIN servicios s ON b.id_servicio = s.id_servicio
      LEFT JOIN usuarios u ON b.id_guardia = u.id_usuario
      WHERE (b.tipo_evento = 'Emergencia' OR b.nivel_prioridad = 'Emergencia')
        AND b.atendida_supervisor = 0
    `;
    const params = [];

    if (req.user.rol === 'Supervisor' && req.user.id_servicio_asignado) {
      sql += ' AND b.id_servicio = ?';
      params.push(req.user.id_servicio_asignado);
    }

    sql += ' ORDER BY b.fecha_hora_registro DESC';

    const emergencias = await db.query(sql, params);
    return res.json({
      hayEmergencias: emergencias.length > 0,
      total: emergencias.length,
      emergencias
    });
  } catch (error) {
    console.error('Error al checar emergencias activas:', error);
    return res.status(500).json({ error: 'Error al verificar alertas de emergencia' });
  }
});

// POST /api/logbook - Register new event / incident / emergency
router.post('/', verifyToken, uploadEvidencia.single('fotografia'), async (req, res) => {
  try {
    const {
      id_servicio,
      tipo_evento = 'Rondín',
      descripcion,
      nivel_prioridad,
      foto_base64,
      fecha_hora_registro
    } = req.body;

    if (!descripcion || descripcion.trim() === '') {
      return res.status(400).json({ error: 'La descripción del evento es obligatoria' });
    }

    const targetService = id_servicio || req.user.id_servicio_asignado;
    if (!targetService) {
      return res.status(400).json({ error: 'Debe especificar el servicio o tener uno asignado' });
    }

    let fotoFilename = null;
    if (req.file) {
      fotoFilename = req.file.filename;
    } else if (foto_base64) {
      fotoFilename = saveBase64Image(foto_base64);
    }

    // Default priority based on event type
    let calculatedPriority = nivel_prioridad || 'Baja';
    if (tipo_evento === 'Emergencia') {
      calculatedPriority = 'Emergencia';
    } else if (tipo_evento === 'Incidencia Operativa' && !nivel_prioridad) {
      calculatedPriority = 'Media';
    }

    const fechaFinal = fecha_hora_registro || new Date().toISOString().replace('T', ' ').substring(0, 19);

    const result = await db.run(
      `INSERT INTO bitacoras (
        id_servicio, id_guardia, tipo_evento, descripcion,
        fotografia_adjunta, nivel_prioridad, atendida_supervisor,
        fecha_hora_registro
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        Number(targetService),
        req.user.id_usuario,
        tipo_evento,
        descripcion.trim(),
        fotoFilename,
        calculatedPriority,
        fechaFinal
      ]
    );

    const esEmergencia = calculatedPriority === 'Emergencia' || tipo_evento === 'Emergencia';

    return res.status(201).json({
      message: esEmergencia
        ? '¡ALERTA DE EMERGENCIA REGISTRADA! Notificando a supervisores en tiempo real.'
        : 'Evento de bitácora registrado exitosamente',
      id_bitacora: result.insertId,
      esEmergencia,
      fotografia_adjunta: fotoFilename
    });
  } catch (error) {
    console.error('Error al registrar en bitácora:', error);
    return res.status(500).json({ error: 'Error al registrar evento en bitácora' });
  }
});

// POST /api/logbook/batch-sync - Batch sync from offline storage
router.post('/batch-sync', verifyToken, async (req, res) => {
  try {
    const { registros } = req.body;

    if (!Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: 'No se enviaron eventos de bitácora válidos' });
    }

    const insertedIds = [];

    for (const item of registros) {
      const targetService = item.id_servicio || req.user.id_servicio_asignado;
      let fotoFilename = null;

      if (item.foto_base64) {
        fotoFilename = saveBase64Image(item.foto_base64);
      }

      const result = await db.run(
        `INSERT INTO bitacoras (
          id_servicio, id_guardia, tipo_evento, descripcion,
          fotografia_adjunta, nivel_prioridad, atendida_supervisor,
          fecha_hora_registro
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          Number(targetService),
          req.user.id_usuario,
          item.tipo_evento || 'Rondín',
          item.descripcion || 'Registro sincronizado offline',
          fotoFilename,
          item.nivel_prioridad || 'Baja',
          item.fecha_hora_registro || new Date().toISOString().replace('T', ' ').substring(0, 19)
        ]
      );

      insertedIds.push({ clientUid: item.uid, serverId: result.insertId });
    }

    return res.json({
      message: `Se sincronizaron exitosamente ${insertedIds.length} eventos de bitácora`,
      syncedCount: insertedIds.length,
      items: insertedIds
    });
  } catch (error) {
    console.error('Error en batch-sync de bitácora:', error);
    return res.status(500).json({ error: 'Error al sincronizar bitácora offline' });
  }
});

// PUT /api/logbook/:id/atender - Supervisor resolution / acknowledgment
router.put('/:id/atender', verifyToken, requireRole('Administrador', 'Supervisor'), async (req, res) => {
  try {
    const { notas_supervisor } = req.body;

    const fechaAtencion = new Date().toISOString().replace('T', ' ').substring(0, 19);

    await db.run(
      `UPDATE bitacoras SET
        atendida_supervisor = 1,
        fecha_atencion = ?,
        notas_supervisor = ?
      WHERE id_bitacora = ?`,
      [
        fechaAtencion,
        notas_supervisor || 'Emergencia atendida y confirmada por supervisión en campo.',
        req.params.id
      ]
    );

    return res.json({ message: 'Evento marcado como atendido por supervisión' });
  } catch (error) {
    console.error('Error al atender incidencia:', error);
    return res.status(500).json({ error: 'Error al marcar evento como atendido' });
  }
});

module.exports = router;
