const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { uploadEvidencia, evidenciasDir } = require('../middleware/upload');

// Helper to save base64 image if submitted from camera
function saveBase64Image(dataUri) {
  if (!dataUri || !dataUri.startsWith('data:image')) return null;
  const matches = dataUri.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;
  const ext = matches[1].replace('jpeg', 'jpg');
  const filename = `camera_${Date.now()}_${Math.round(Math.random() * 1e6)}.${ext}`;
  const filePath = path.join(evidenciasDir, filename);
  fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
  return filename;
}

// GET /api/access - List access records with comprehensive filters
router.get('/', verifyToken, async (req, res) => {
  try {
    const {
      id_servicio,
      tipo_movimiento,
      tipo_visitante,
      fecha_inicio,
      fecha_fin,
      search,
      limit = 100,
      offset = 0
    } = req.query;

    let sql = `
      SELECT a.*,
             s.nombre_cliente_o_lugar as nombre_servicio,
             u.nombre_completo as nombre_guardia,
             u.num_empleado_placa as placa_guardia
      FROM accesos a
      LEFT JOIN servicios s ON a.id_servicio = s.id_servicio
      LEFT JOIN usuarios u ON a.id_guardia = u.id_usuario
      WHERE 1=1
    `;
    const params = [];

    // Filter by user role/service assignment if Guard
    if (req.user.rol === 'Guardia' && req.user.id_servicio_asignado) {
      sql += ' AND a.id_servicio = ?';
      params.push(req.user.id_servicio_asignado);
    } else if (id_servicio) {
      sql += ' AND a.id_servicio = ?';
      params.push(Number(id_servicio));
    }

    if (tipo_movimiento) {
      sql += ' AND a.tipo_movimiento = ?';
      params.push(tipo_movimiento);
    }

    if (tipo_visitante) {
      sql += ' AND a.tipo_visitante = ?';
      params.push(tipo_visitante);
    }

    if (fecha_inicio) {
      sql += ' AND a.fecha_hora >= ?';
      params.push(fecha_inicio.length === 10 ? `${fecha_inicio} 00:00:00` : fecha_inicio);
    }

    if (fecha_fin) {
      sql += ' AND a.fecha_hora <= ?';
      params.push(fecha_fin.length === 10 ? `${fecha_fin} 23:59:59` : fecha_fin);
    }

    if (search) {
      sql += ' AND (a.nombre_visitante LIKE ? OR a.placas LIKE ? OR a.motivo_o_destino LIKE ? OR a.identificacion_num LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY a.fecha_hora DESC, a.id_acceso DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const accesos = await db.query(sql, params);
    return res.json({ accesos });
  } catch (error) {
    console.error('Error al listar accesos:', error);
    return res.status(500).json({ error: 'Error al consultar registros de acceso' });
  }
});

// POST /api/access - Register single access record
router.post('/', verifyToken, uploadEvidencia.single('fotografia'), async (req, res) => {
  try {
    const {
      id_servicio,
      tipo_movimiento = 'Entrada',
      tipo_visitante = 'Peatón',
      nombre_visitante,
      identificacion_tipo,
      identificacion_num,
      datos_vehiculo,
      placas,
      motivo_o_destino,
      observaciones,
      foto_base64,
      fecha_hora
    } = req.body;

    if (!nombre_visitante) {
      return res.status(400).json({ error: 'El nombre del visitante o conductor es obligatorio' });
    }

    // Determine service ID
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

    const fechaFinal = fecha_hora || new Date().toISOString().replace('T', ' ').substring(0, 19);

    const result = await db.run(
      `INSERT INTO accesos (
        id_servicio, id_guardia, tipo_movimiento, tipo_visitante,
        nombre_visitante, identificacion_tipo, identificacion_num,
        datos_vehiculo, placas, motivo_o_destino, fotografia_evidencia,
        fecha_hora, observaciones, sincronizado_offline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        Number(targetService),
        req.user.id_usuario,
        tipo_movimiento,
        tipo_visitante,
        nombre_visitante.trim(),
        identificacion_tipo || null,
        identificacion_num || null,
        datos_vehiculo || null,
        placas ? placas.toUpperCase().trim() : null,
        motivo_o_destino || null,
        fotoFilename,
        fechaFinal,
        observaciones || null
      ]
    );

    return res.status(201).json({
      message: 'Acceso registrado correctamente',
      id_acceso: result.insertId,
      fotografia_evidencia: fotoFilename
    });
  } catch (error) {
    console.error('Error al registrar acceso:', error);
    return res.status(500).json({ error: 'Error al registrar el acceso' });
  }
});

// POST /api/access/batch-sync - Batch sync from PWA Offline mode (IndexedDB)
router.post('/batch-sync', verifyToken, async (req, res) => {
  try {
    const { registros } = req.body;

    if (!Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: 'No se enviaron registros válidos para sincronización' });
    }

    const insertedIds = [];

    for (const item of registros) {
      const targetService = item.id_servicio || req.user.id_servicio_asignado;
      let fotoFilename = null;

      if (item.foto_base64) {
        fotoFilename = saveBase64Image(item.foto_base64);
      }

      const result = await db.run(
        `INSERT INTO accesos (
          id_servicio, id_guardia, tipo_movimiento, tipo_visitante,
          nombre_visitante, identificacion_tipo, identificacion_num,
          datos_vehiculo, placas, motivo_o_destino, fotografia_evidencia,
          fecha_hora, observaciones, sincronizado_offline
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          Number(targetService),
          req.user.id_usuario,
          item.tipo_movimiento || 'Entrada',
          item.tipo_visitante || 'Peatón',
          item.nombre_visitante || 'Visitante no especificado',
          item.identificacion_tipo || null,
          item.identificacion_num || null,
          item.datos_vehiculo || null,
          item.placas ? item.placas.toUpperCase().trim() : null,
          item.motivo_o_destino || null,
          fotoFilename,
          item.fecha_hora || new Date().toISOString().replace('T', ' ').substring(0, 19),
          item.observaciones || null
        ]
      );

      insertedIds.push({ clientUid: item.uid, serverId: result.insertId });
    }

    return res.json({
      message: `Se sincronizaron exitosamente ${insertedIds.length} registros de acceso`,
      syncedCount: insertedIds.length,
      items: insertedIds
    });
  } catch (error) {
    console.error('Error en batch-sync de accesos:', error);
    return res.status(500).json({ error: 'Error al sincronizar registros de acceso offline' });
  }
});

module.exports = router;
